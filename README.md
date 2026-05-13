# Mini Factory

A small Factorio-inspired factory builder. Java HTTP server simulates the world; the browser draws it.

## Requirements

- JDK 11 or newer (`javac` and `java` on your PATH)
- A modern browser

## Run locally

```
./run.sh
```

Then open <http://localhost:8080>. Different port: `./run.sh 9000`, or `PORT=9000 java Server`.

## Deploy from GitHub

The repo ships a `Dockerfile` so it'll run on anything that builds containers from a GitHub repo. The server honors `$PORT` for the platforms that inject one.

### Render (free tier, one click)

1. Push this repo to GitHub.
2. Go to <https://render.com/> → **New +** → **Blueprint** → point it at this repo.
3. Render reads `render.yaml`, picks up the `Dockerfile`, builds, and deploys. You get a `https://<name>.onrender.com` URL.

Notes: the free Render web tier sleeps after 15 minutes of inactivity. When it wakes up, the in-memory world resets — fine for a demo, not a save file. The whole site is also a single shared world; everyone visiting the URL edits the same factory.

### Fly.io

```
fly launch          # detects the Dockerfile, generates fly.toml
fly deploy
```

### Railway / Koyeb / any Docker host

Connect the GitHub repo. They'll auto-detect the `Dockerfile`. No env vars needed; `PORT` is read automatically if the platform sets it.

### Build the image yourself

```
docker build -t mini-factory .
docker run -p 8080:8080 mini-factory
```

## How to play

Pick a building from the toolbar (or press `1`–`5`), then click on the grid to place it. Press `R` to rotate before placing — the arrow on each building shows its output direction. Right-click (or pick **Remove** / press `X`) to delete a building.

### Buildings

| Building   | What it does                                                                |
|------------|-----------------------------------------------------------------------------|
| Miner      | Place on an ore patch. Produces 1 iron ore every 1s into the tile in front. |
| Belt       | Carries one item forward per tick. Chain them to route resources.           |
| Furnace    | Takes iron ore, produces 1 iron plate every 2s.                             |
| Assembler  | Takes 2 iron plates, produces 1 iron gear every 3s.                         |
| Chest      | Accepts anything pushed into it. Total count shown in the corner.           |

### A starter line

1. Place a **Miner** on the brown ore patch, arrow pointing at an empty tile.
2. Place a **Belt** in front of it, also pointing forward.
3. Add more belts, then a **Chest** at the end.
4. Watch iron ore pile up.

To smelt: put a **Furnace** in the path so the belt feeds into it, with another belt coming out the other side carrying plates onward. An **Assembler** at the end will turn 2 plates into 1 gear.

## Architecture

```
Server.java   — single-file Java HTTP server, game state, and tick loop (10 Hz)
web/
  index.html  — page layout
  script.js   — canvas rendering, input, polls /api/state
  style.css   — dark theme
```

### API

- `GET  /api/state` — full world JSON (ground, buildings, items on belts)
- `POST /api/place` — body `{"x":int,"y":int,"type":string,"dir":0..3}` (0=N,1=E,2=S,3=W)
- `POST /api/remove` — body `{"x":int,"y":int}`
- `POST /api/reset` — clears all buildings

### Tick model

Each tick (100 ms) runs three phases:

1. **preTick** — producers (miner / furnace / assembler) advance their progress and may queue a pending output.
2. **Belt movement** — every belt that has an item tries to push it to the tile in front. A belt that has already moved or received this tick can't move again; the loop iterates until no more moves are possible, which gives smooth flow even on long lines while still capping each item at 1 tile per tick.
3. **postTick** — producers try to drop their pending output onto the tile they're facing.
