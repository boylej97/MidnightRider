import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {
    static final int W = 30, H = 20;
    static final int TICK_MS = 100;

    static final int[] DX = {0, 1, 0, -1};
    static final int[] DY = {-1, 0, 1, 0};

    static final int MINER_TICKS = 10;
    static final int FURNACE_TICKS = 20;
    static final int ASSEMBLER_TICKS = 30;
    static final int FURNACE_BUFFER = 3;
    static final int ASSEMBLER_BUFFER = 4;

    static final World world = new World();

    public static void main(String[] args) throws IOException {
        int port = 8080;
        if (args.length > 0) {
            try { port = Integer.parseInt(args[0]); } catch (NumberFormatException ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/state", new StateHandler());
        server.createContext("/api/place", new PlaceHandler());
        server.createContext("/api/remove", new RemoveHandler());
        server.createContext("/api/reset", new ResetHandler());
        server.createContext("/", new StaticHandler());
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(
            () -> { try { synchronized (world) { world.tick(); } } catch (Throwable t) { t.printStackTrace(); } },
            TICK_MS, TICK_MS, TimeUnit.MILLISECONDS
        );

        System.out.println("Factory game running at http://localhost:" + port);
    }

    static boolean inBounds(int x, int y) { return x >= 0 && y >= 0 && x < W && y < H; }

    // ===== World =====

    static class World {
        final String[][] ground = new String[H][W];
        final Building[][] grid = new Building[H][W];
        long tick = 0;

        World() { generate(); }

        void generate() {
            Random rng = new Random(42);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    ground[y][x] = "grass";
            placeOrePatch(5, 5, 3, rng);
            placeOrePatch(22, 4, 3, rng);
            placeOrePatch(8, 14, 2, rng);
            placeOrePatch(20, 15, 3, rng);
        }

        void placeOrePatch(int cx, int cy, int r, Random rng) {
            for (int y = cy - r; y <= cy + r; y++) {
                for (int x = cx - r; x <= cx + r; x++) {
                    if (!inBounds(x, y)) continue;
                    int d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                    if (d2 <= r * r && rng.nextDouble() < 0.85) {
                        ground[y][x] = "ore";
                    }
                }
            }
        }

        void tick() {
            tick++;
            List<Building> buildings = allBuildings();

            for (Building b : buildings) b.preTick();

            for (Building b : buildings) {
                if (b instanceof Belt) ((Belt) b).processedThisTick = false;
            }
            boolean changed = true;
            int safety = 0;
            while (changed && safety++ < 500) {
                changed = false;
                for (Building b : buildings) {
                    if (!(b instanceof Belt)) continue;
                    Belt belt = (Belt) b;
                    if (belt.processedThisTick || belt.item == null) continue;
                    int tx = belt.x + DX[belt.dir];
                    int ty = belt.y + DY[belt.dir];
                    if (!inBounds(tx, ty)) continue;
                    Building target = grid[ty][tx];
                    if (target == null) continue;
                    if (target instanceof Belt) {
                        Belt tb = (Belt) target;
                        if (tb.item != null) continue;
                        tb.item = belt.item;
                        belt.item = null;
                        belt.processedThisTick = true;
                        tb.processedThisTick = true;
                        changed = true;
                    } else if (target.acceptItem(belt.item)) {
                        belt.item = null;
                        belt.processedThisTick = true;
                        changed = true;
                    }
                }
            }

            for (Building b : buildings) b.postTick();
        }

        List<Building> allBuildings() {
            List<Building> list = new ArrayList<>();
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    if (grid[y][x] != null) list.add(grid[y][x]);
            return list;
        }

        boolean place(int x, int y, String type, int dir) {
            if (!inBounds(x, y)) return false;
            if (grid[y][x] != null) return false;
            if (dir < 0 || dir > 3) return false;
            Building b;
            switch (type) {
                case "miner":     b = new Miner(x, y, dir); break;
                case "belt":      b = new Belt(x, y, dir); break;
                case "furnace":   b = new Furnace(x, y, dir); break;
                case "assembler": b = new Assembler(x, y, dir); break;
                case "chest":     b = new Chest(x, y, dir); break;
                default: return false;
            }
            grid[y][x] = b;
            return true;
        }

        boolean remove(int x, int y) {
            if (!inBounds(x, y) || grid[y][x] == null) return false;
            grid[y][x] = null;
            return true;
        }

        void clear() {
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    grid[y][x] = null;
        }

        String toJson() {
            StringBuilder sb = new StringBuilder(8192);
            sb.append("{\"w\":").append(W).append(",\"h\":").append(H);
            sb.append(",\"tick\":").append(tick);
            sb.append(",\"ground\":[");
            for (int y = 0; y < H; y++) {
                if (y > 0) sb.append(',');
                sb.append('[');
                for (int x = 0; x < W; x++) {
                    if (x > 0) sb.append(',');
                    sb.append('"').append(ground[y][x]).append('"');
                }
                sb.append(']');
            }
            sb.append("],\"buildings\":[");
            boolean first = true;
            for (int y = 0; y < H; y++) {
                for (int x = 0; x < W; x++) {
                    Building b = grid[y][x];
                    if (b == null) continue;
                    if (!first) sb.append(',');
                    first = false;
                    sb.append("{\"x\":").append(b.x)
                      .append(",\"y\":").append(b.y)
                      .append(",\"dir\":").append(b.dir)
                      .append(",\"type\":\"").append(b.type).append('"');
                    b.appendExtra(sb);
                    sb.append('}');
                }
            }
            sb.append("]}");
            return sb.toString();
        }
    }

    // ===== Buildings =====

    static abstract class Building {
        final int x, y, dir;
        final String type;
        Building(int x, int y, int dir, String type) {
            this.x = x; this.y = y; this.dir = dir; this.type = type;
        }
        void preTick() {}
        void postTick() {}
        boolean acceptItem(String item) { return false; }
        void appendExtra(StringBuilder sb) {}

        boolean tryPushForward(String item) {
            int tx = x + DX[dir], ty = y + DY[dir];
            if (!inBounds(tx, ty)) return false;
            Building t = world.grid[ty][tx];
            if (t == null) return false;
            if (t instanceof Belt) {
                Belt b = (Belt) t;
                if (b.item != null) return false;
                b.item = item;
                return true;
            }
            return t.acceptItem(item);
        }
    }

    static class Miner extends Building {
        int progress;
        String pending;
        Miner(int x, int y, int dir) { super(x, y, dir, "miner"); }
        void preTick() {
            if (pending == null && "ore".equals(world.ground[y][x])) {
                if (++progress >= MINER_TICKS) { progress = 0; pending = "iron_ore"; }
            }
        }
        void postTick() {
            if (pending != null && tryPushForward(pending)) pending = null;
        }
        void appendExtra(StringBuilder sb) {
            sb.append(",\"progress\":").append(progress);
            sb.append(",\"goal\":").append(MINER_TICKS);
            if (pending != null) sb.append(",\"pending\":\"").append(pending).append('"');
        }
    }

    static class Belt extends Building {
        String item;
        boolean processedThisTick;
        Belt(int x, int y, int dir) { super(x, y, dir, "belt"); }
        boolean acceptItem(String it) {
            if (item != null) return false;
            item = it;
            return true;
        }
        void appendExtra(StringBuilder sb) {
            if (item != null) sb.append(",\"item\":\"").append(item).append('"');
        }
    }

    static class Furnace extends Building {
        int input;
        int progress;
        String pending;
        Furnace(int x, int y, int dir) { super(x, y, dir, "furnace"); }
        void preTick() {
            if (pending == null && input > 0) {
                if (++progress >= FURNACE_TICKS) { progress = 0; input--; pending = "iron_plate"; }
            }
        }
        void postTick() {
            if (pending != null && tryPushForward(pending)) pending = null;
        }
        boolean acceptItem(String it) {
            if (!"iron_ore".equals(it)) return false;
            if (input >= FURNACE_BUFFER) return false;
            input++;
            return true;
        }
        void appendExtra(StringBuilder sb) {
            sb.append(",\"input\":").append(input);
            sb.append(",\"progress\":").append(progress);
            sb.append(",\"goal\":").append(FURNACE_TICKS);
            if (pending != null) sb.append(",\"pending\":\"").append(pending).append('"');
        }
    }

    static class Assembler extends Building {
        int plates;
        int progress;
        String pending;
        Assembler(int x, int y, int dir) { super(x, y, dir, "assembler"); }
        void preTick() {
            if (pending == null && plates >= 2) {
                if (++progress >= ASSEMBLER_TICKS) { progress = 0; plates -= 2; pending = "iron_gear"; }
            }
        }
        void postTick() {
            if (pending != null && tryPushForward(pending)) pending = null;
        }
        boolean acceptItem(String it) {
            if (!"iron_plate".equals(it)) return false;
            if (plates >= ASSEMBLER_BUFFER) return false;
            plates++;
            return true;
        }
        void appendExtra(StringBuilder sb) {
            sb.append(",\"plates\":").append(plates);
            sb.append(",\"progress\":").append(progress);
            sb.append(",\"goal\":").append(ASSEMBLER_TICKS);
            if (pending != null) sb.append(",\"pending\":\"").append(pending).append('"');
        }
    }

    static class Chest extends Building {
        final Map<String, Integer> contents = new HashMap<>();
        Chest(int x, int y, int dir) { super(x, y, dir, "chest"); }
        boolean acceptItem(String it) {
            contents.merge(it, 1, Integer::sum);
            return true;
        }
        void appendExtra(StringBuilder sb) {
            sb.append(",\"contents\":{");
            boolean first = true;
            for (Map.Entry<String, Integer> e : contents.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append('"').append(e.getKey()).append("\":").append(e.getValue());
            }
            sb.append('}');
        }
    }

    // ===== HTTP =====

    static class StateHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            String body;
            synchronized (world) { body = world.toJson(); }
            sendJson(ex, 200, body);
        }
    }

    static class PlaceHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (!"POST".equals(ex.getRequestMethod())) { ex.sendResponseHeaders(405, -1); return; }
            Map<String, Object> req = parseFlatJson(readBody(ex));
            int x = intArg(req, "x");
            int y = intArg(req, "y");
            int dir = intArg(req, "dir");
            String type = (String) req.get("type");
            boolean ok;
            synchronized (world) { ok = world.place(x, y, type, dir); }
            sendJson(ex, 200, "{\"ok\":" + ok + "}");
        }
    }

    static class RemoveHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (!"POST".equals(ex.getRequestMethod())) { ex.sendResponseHeaders(405, -1); return; }
            Map<String, Object> req = parseFlatJson(readBody(ex));
            int x = intArg(req, "x");
            int y = intArg(req, "y");
            boolean ok;
            synchronized (world) { ok = world.remove(x, y); }
            sendJson(ex, 200, "{\"ok\":" + ok + "}");
        }
    }

    static class ResetHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            if (!"POST".equals(ex.getRequestMethod())) { ex.sendResponseHeaders(405, -1); return; }
            synchronized (world) { world.clear(); }
            sendJson(ex, 200, "{\"ok\":true}");
        }
    }

    static final Path WEB_ROOT = Paths.get("web").toAbsolutePath().normalize();

    static class StaticHandler implements HttpHandler {
        public void handle(HttpExchange ex) throws IOException {
            String path = ex.getRequestURI().getPath();
            if ("/".equals(path)) path = "/index.html";
            Path p = WEB_ROOT.resolve(path.substring(1)).normalize();
            if (!p.startsWith(WEB_ROOT) || !Files.isRegularFile(p)) {
                ex.sendResponseHeaders(404, -1);
                return;
            }
            byte[] bytes = Files.readAllBytes(p);
            String ct = "application/octet-stream";
            String name = p.getFileName().toString();
            if (name.endsWith(".html")) ct = "text/html; charset=utf-8";
            else if (name.endsWith(".js")) ct = "application/javascript; charset=utf-8";
            else if (name.endsWith(".css")) ct = "text/css; charset=utf-8";
            ex.getResponseHeaders().set("Content-Type", ct);
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(bytes); }
        }
    }

    static String readBody(HttpExchange ex) throws IOException {
        return new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    static void sendJson(HttpExchange ex, int code, String body) throws IOException {
        byte[] b = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, b.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(b); }
    }

    static int intArg(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v instanceof Integer) return (Integer) v;
        if (v instanceof String)  return Integer.parseInt((String) v);
        return 0;
    }

    static final Pattern JSON_ENTRY =
        Pattern.compile("\"(\\w+)\"\\s*:\\s*(\"[^\"]*\"|-?\\d+|true|false|null)");

    static Map<String, Object> parseFlatJson(String json) {
        Map<String, Object> m = new HashMap<>();
        Matcher mm = JSON_ENTRY.matcher(json);
        while (mm.find()) {
            String k = mm.group(1);
            String v = mm.group(2);
            if (v.charAt(0) == '"')       m.put(k, v.substring(1, v.length() - 1));
            else if (v.equals("true"))    m.put(k, Boolean.TRUE);
            else if (v.equals("false"))   m.put(k, Boolean.FALSE);
            else if (v.equals("null"))    m.put(k, null);
            else                          m.put(k, Integer.parseInt(v));
        }
        return m;
    }
}
