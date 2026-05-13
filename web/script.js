'use strict';

// ---------- Constants ----------

const TILE = 32;
const W = 30;
const H = 20;
const TICK_MS = 100;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const ITEM_COLOR = {
  iron_ore:   '#e2843a',
  iron_plate: '#d8d8d8',
  iron_gear:  '#f0c860',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tickEl = document.getElementById('tick');
const infoEl = document.getElementById('info');

canvas.width = W * TILE;
canvas.height = H * TILE;

// ---------- State ----------

let state = null;        // most recent server snapshot
let prevState = null;    // snapshot before that, for item interpolation
let stateReceivedAt = performance.now();

let tool = 'belt';
let dir = 1;
let hover = { x: -1, y: -1, inside: false };

// Cached ground layer (full ground stays static, redraw only on receipt of new state)
const groundCanvas = document.createElement('canvas');
groundCanvas.width = W * TILE;
groundCanvas.height = H * TILE;
const groundCtx = groundCanvas.getContext('2d');
let groundReady = false;
let groundSignature = '';

// ---------- Tools / input ----------

function selectTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === t);
  });
}

document.querySelectorAll('.tool').forEach(el => {
  el.addEventListener('click', () => selectTool(el.dataset.tool));
});

document.getElementById('rotate').addEventListener('click', () => {
  dir = (dir + 1) % 4;
});

document.getElementById('reset').addEventListener('click', async () => {
  if (!confirm('Remove every building?')) return;
  await fetch('/api/reset', { method: 'POST' });
  pollNow();
});

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if      (e.key === '1') selectTool('miner');
  else if (e.key === '2') selectTool('belt');
  else if (e.key === '3') selectTool('furnace');
  else if (e.key === '4') selectTool('assembler');
  else if (e.key === '5') selectTool('chest');
  else if (e.key === 'x' || e.key === 'X') selectTool('remove');
  else if (e.key === 'r' || e.key === 'R') dir = (dir + 1) % 4;
  else if (e.key === 'Escape') selectTool('belt');
});

function eventToTile(e) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  const px = (e.clientX - r.left) * sx;
  const py = (e.clientY - r.top) * sy;
  return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
}

canvas.addEventListener('pointermove', e => {
  const t = eventToTile(e);
  hover.x = t.x; hover.y = t.y;
  hover.inside = t.x >= 0 && t.x < W && t.y >= 0 && t.y < H;
});

canvas.addEventListener('pointerleave', () => { hover.inside = false; });

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
  e.preventDefault();
  const t = eventToTile(e);
  hover.x = t.x; hover.y = t.y;
  hover.inside = t.x >= 0 && t.x < W && t.y >= 0 && t.y < H;
  if (!hover.inside) return;
  if (e.button === 2 || tool === 'remove') doRemove(t.x, t.y);
  else doPlace(t.x, t.y, tool, dir);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Networking ----------

async function doPlace(x, y, type, d) {
  try {
    await fetch('/api/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, type, dir: d }),
    });
  } catch (_) {}
  pollNow();
}

async function doRemove(x, y) {
  try {
    await fetch('/api/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  } catch (_) {}
  pollNow();
}

let polling = false;
let nextPollScheduled = false;

async function poll() {
  if (polling) { nextPollScheduled = true; return; }
  polling = true;
  try {
    const r = await fetch('/api/state');
    if (!r.ok) return;
    const s = await r.json();
    indexBuildings(s);
    // Only replace prevState when the tick actually advanced — that way
    // rapid double-polls (place + auto) don't lose the previous-tick reference.
    if (!state || s.tick !== state.tick) {
      prevState = state;
      stateReceivedAt = performance.now();
    }
    state = s;
    tickEl.textContent = state.tick;
  } catch (_) {} finally {
    polling = false;
    if (nextPollScheduled) {
      nextPollScheduled = false;
      poll();
    }
  }
}

function pollNow() { poll(); }

selectTool('belt');
poll();
setInterval(poll, TICK_MS);

// ---------- Lookup helpers ----------

function indexBuildings(s) {
  if (!s || s._grid) return;
  const g = Array(H);
  for (let y = 0; y < H; y++) g[y] = Array(W).fill(null);
  for (const b of s.buildings) g[b.y][b.x] = b;
  s._grid = g;
}

function buildingAt(s, x, y) {
  if (!s || x < 0 || y < 0 || x >= W || y >= H) return null;
  return s._grid ? s._grid[y][x] : null;
}

// ---------- Ground (cached) ----------

function renderGround() {
  if (!state) return;
  const sig = state.ground.map(row => row.join('')).join('|');
  if (sig === groundSignature) return;
  groundSignature = sig;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = state.ground[y][x];
      const px = x * TILE, py = y * TILE;

      if (g === 'ore') {
        const grad = groundCtx.createLinearGradient(px, py, px, py + TILE);
        grad.addColorStop(0, '#9a7820');
        grad.addColorStop(1, '#6a4810');
        groundCtx.fillStyle = grad;
        groundCtx.fillRect(px, py, TILE, TILE);
        groundCtx.fillStyle = '#c08828';
        groundCtx.fillRect(px + 5,  py + 6,  4, 4);
        groundCtx.fillRect(px + 19, py + 22, 4, 4);
        groundCtx.fillRect(px + 22, py + 9,  3, 3);
        groundCtx.fillStyle = '#5a3a08';
        groundCtx.fillRect(px + 10, py + 18, 2, 2);
        groundCtx.fillRect(px + 25, py + 24, 2, 2);
      } else {
        const grad = groundCtx.createLinearGradient(px, py, px, py + TILE);
        grad.addColorStop(0, '#2d3e1c');
        grad.addColorStop(1, '#23311a');
        groundCtx.fillStyle = grad;
        groundCtx.fillRect(px, py, TILE, TILE);
        // Faint speckles
        const seed = (x * 2654435761 ^ y * 1597334677) >>> 0;
        const r1 = (seed % 31) / 31;
        const r2 = ((seed >> 5) % 31) / 31;
        const r3 = ((seed >> 10) % 31) / 31;
        groundCtx.fillStyle = 'rgba(80,100,60,0.25)';
        groundCtx.fillRect(px + r1 * (TILE - 4), py + r2 * (TILE - 4), 2, 2);
        groundCtx.fillStyle = 'rgba(40,60,30,0.4)';
        groundCtx.fillRect(px + r2 * (TILE - 3), py + r3 * (TILE - 3), 1, 1);
      }
    }
  }

  // Soft grid lines on top
  groundCtx.strokeStyle = 'rgba(0,0,0,0.18)';
  groundCtx.lineWidth = 1;
  for (let x = 0; x <= W; x++) {
    groundCtx.beginPath();
    groundCtx.moveTo(x * TILE + 0.5, 0);
    groundCtx.lineTo(x * TILE + 0.5, H * TILE);
    groundCtx.stroke();
  }
  for (let y = 0; y <= H; y++) {
    groundCtx.beginPath();
    groundCtx.moveTo(0, y * TILE + 0.5);
    groundCtx.lineTo(W * TILE, y * TILE + 0.5);
    groundCtx.stroke();
  }

  groundReady = true;
}

// ---------- Render loop ----------

function frame(now) {
  if (state) {
    renderGround();
    draw(now);
    updateInfo();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (groundReady) ctx.drawImage(groundCanvas, 0, 0);

  const t = Math.max(0, Math.min(1, (now - stateReceivedAt) / TICK_MS));

  // Pass 1: belts (and their static parts)
  for (const b of state.buildings) {
    if (b.type === 'belt') drawBelt(b, now);
  }

  // Pass 2: belt items (with sliding animation)
  for (const b of state.buildings) {
    if (b.type === 'belt' && b.item) drawAnimatedItem(b, t);
  }

  // Pass 3: machines/chests on top
  for (const b of state.buildings) {
    if (b.type !== 'belt') drawMachine(b, now);
  }

  // Hover ghost
  if (hover.inside) drawGhost(now);
}

// ---------- Drawing primitives ----------

function drawBelt(b, now) {
  const px = b.x * TILE, py = b.y * TILE;

  // Base
  const grad = ctx.createLinearGradient(px, py, px, py + TILE);
  grad.addColorStop(0, '#e0a838');
  grad.addColorStop(1, '#a87018');
  ctx.fillStyle = grad;
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);

  // Animated stripes (continuous via `now`)
  drawBeltStripes(px, py, b.dir, now);

  // Inner shadow
  ctx.strokeStyle = 'rgba(40, 24, 8, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);

  // Arrow
  drawArrow(px, py, b.dir, 'rgba(40, 24, 8, 0.7)');
}

function drawBeltStripes(px, py, d, now) {
  ctx.fillStyle = 'rgba(140, 90, 20, 0.65)';
  const speedPxPerMs = TILE / TICK_MS;
  const off = ((now * speedPxPerMs) % 8 + 8) % 8;
  if (d === 1 || d === 3) {
    for (let i = -8; i < TILE; i += 8) {
      const sx = d === 1 ? i + off : TILE - i - off - 4;
      ctx.fillRect(px + sx, py + 6, 3, TILE - 12);
    }
  } else {
    for (let i = -8; i < TILE; i += 8) {
      const sy = d === 2 ? i + off : TILE - i - off - 4;
      ctx.fillRect(px + 6, py + sy, TILE - 12, 3);
    }
  }
}

function drawMachine(b, now) {
  const px = b.x * TILE, py = b.y * TILE;

  switch (b.type) {
    case 'miner': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 4, py + 4, TILE - 4, TILE - 4);
      // Body
      const grad = ctx.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, '#9a9a9a');
      grad.addColorStop(1, '#4a4a4a');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      // Inner drill housing
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
      // Spinning drill head
      const onOre = b.pending || (b.progress != null && b.progress > 0);
      const spin = onOre ? now * 0.012 : 0;
      ctx.save();
      ctx.translate(px + TILE / 2, py + TILE / 2);
      ctx.rotate(spin);
      ctx.fillStyle = '#b8b8b8';
      ctx.fillRect(-5, -1.5, 10, 3);
      ctx.fillRect(-1.5, -5, 3, 10);
      ctx.restore();
      // Arrow
      drawArrow(px, py, b.dir, '#ffaa00');
      // Progress
      if (b.goal) drawProgressBar(px, py, b.progress / b.goal, '#ffaa00');
      break;
    }

    case 'furnace': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 4, py + 4, TILE - 4, TILE - 4);
      // Body
      const grad = ctx.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, '#7a3820');
      grad.addColorStop(1, '#3a1808');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = '#1a0a04';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      // Burning core
      const burning = b.input > 0 || b.pending != null;
      if (burning) {
        const flicker = 0.7 + 0.3 * Math.sin(now * 0.02);
        ctx.fillStyle = `rgba(232, 80, 32, ${flicker})`;
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
        const flicker2 = 0.6 + 0.4 * Math.sin(now * 0.03 + 1.2);
        ctx.fillStyle = `rgba(255, 208, 96, ${flicker2})`;
        ctx.fillRect(px + 12, py + 12, TILE - 24, TILE - 24);
        // Glow
        const r = ctx.createRadialGradient(
          px + TILE / 2, py + TILE / 2, 2,
          px + TILE / 2, py + TILE / 2, TILE
        );
        r.addColorStop(0, 'rgba(255, 180, 80, 0.25)');
        r.addColorStop(1, 'rgba(255, 180, 80, 0)');
        ctx.fillStyle = r;
        ctx.fillRect(px - 6, py - 6, TILE + 12, TILE + 12);
      } else {
        ctx.fillStyle = '#241008';
        ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
      }
      drawArrow(px, py, b.dir, '#ffaa00');
      if (b.input > 0) drawBadge(px, py, b.input, '#e2843a');
      if (b.goal) drawProgressBar(px, py, b.progress / b.goal, '#ff6020');
      break;
    }

    case 'assembler': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 4, py + 4, TILE - 4, TILE - 4);
      // Body
      const grad = ctx.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, '#4070a8');
      grad.addColorStop(1, '#1a3868');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = '#0a1828';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      // Rotating gear
      const working = b.pending || (b.progress != null && b.progress > 0);
      const angle = working ? now * 0.005 : 0;
      ctx.save();
      ctx.translate(px + TILE / 2, py + TILE / 2);
      ctx.rotate(angle);
      // Teeth
      ctx.fillStyle = '#a0c0d8';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        ctx.fillRect(-1.5, -8, 3, 4);
        ctx.restore();
      }
      // Body
      ctx.fillStyle = '#6090c0';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a0c0e0';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Center
      ctx.fillStyle = '#1a3868';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawArrow(px, py, b.dir, '#ffaa00');
      if (b.plates > 0) drawBadge(px, py, b.plates, '#d8d8d8');
      if (b.goal) drawProgressBar(px, py, b.progress / b.goal, '#80c0e0');
      break;
    }

    case 'chest': {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 5, py + 5, TILE - 6, TILE - 6);
      // Body
      const grad = ctx.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, '#8a5828');
      grad.addColorStop(1, '#4a2a10');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = '#2a1808';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
      // Wood plank seam
      ctx.fillStyle = '#2a1808';
      ctx.fillRect(px + TILE / 2 - 1, py + 4, 2, TILE - 8);
      // Latch
      ctx.fillStyle = '#cca050';
      ctx.fillRect(px + TILE / 2 - 2, py + TILE / 2 - 2, 4, 4);

      let total = 0;
      if (b.contents) for (const k in b.contents) total += b.contents[k];
      if (total > 0) drawBadge(px, py, total, '#ffd060');
      break;
    }
  }
}

function drawAnimatedItem(belt, t) {
  // Look up what was on this belt's tile in the previous tick.
  const prev = prevState ? buildingAt(prevState, belt.x, belt.y) : null;
  const wasHere = prev && prev.type === 'belt' && prev.item === belt.item;
  // If item wasn't on this belt last tick, animate it sliding in from upstream
  const off = wasHere ? 0 : (t - 1);
  const cx = belt.x * TILE + TILE / 2 + DX[belt.dir] * off * TILE;
  const cy = belt.y * TILE + TILE / 2 + DY[belt.dir] * off * TILE;
  drawItem(cx, cy, belt.item);
}

function drawItem(cx, cy, item) {
  const color = ITEM_COLOR[item] || '#fff';
  // Soft glow
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 9);
  g.addColorStop(0, color);
  g.addColorStop(0.6, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 9, cy - 9, 18, 18);

  // Solid core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(cx - 1.5, cy - 1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawArrow(px, py, d, color) {
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const dx = DX[d], dy = DY[d];
  const tipX = cx + dx * 10, tipY = cy + dy * 10;
  const baseX = cx - dx * 4, baseY = cy - dy * 4;
  const perpX = -dy * 5, perpY = dx * 5;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX + perpX, baseY + perpY);
  ctx.lineTo(baseX - perpX, baseY - perpY);
  ctx.closePath();
  ctx.fill();
}

function drawProgressBar(px, py, frac, color) {
  const w = TILE - 6;
  const v = Math.max(0, Math.min(1, frac || 0));
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px + 3, py + TILE - 5, w, 3);
  ctx.fillStyle = color;
  ctx.fillRect(px + 3, py + TILE - 5, w * v, 3);
}

function drawBadge(px, py, n, color) {
  const text = String(n);
  const w = 7 * text.length + 4;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(px + 1, py + 1, w, 11);
  ctx.fillStyle = color;
  ctx.font = 'bold 9px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(text, px + 3, py + 2);
}

function drawGhost(now) {
  const px = hover.x * TILE, py = hover.y * TILE;

  if (tool === 'remove') {
    const a = 0.25 + 0.15 * Math.sin(now * 0.008);
    ctx.fillStyle = `rgba(255, 80, 80, ${a})`;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = '#ff6060';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    // X mark
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + TILE - 8, py + TILE - 8);
    ctx.moveTo(px + TILE - 8, py + 8); ctx.lineTo(px + 8, py + TILE - 8);
    ctx.stroke();
    return;
  }

  ctx.globalAlpha = 0.55;
  if (tool === 'belt') {
    drawBelt({ x: hover.x, y: hover.y, dir, type: 'belt' }, now);
  } else {
    drawMachine({ x: hover.x, y: hover.y, dir, type: tool, progress: 0, plates: 0, input: 0, contents: {} }, now);
  }
  ctx.globalAlpha = 1;

  const a = 0.6 + 0.3 * Math.sin(now * 0.008);
  ctx.strokeStyle = `rgba(240, 160, 32, ${a})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
}

// ---------- Info bar ----------

function updateInfo() {
  if (!state) return;
  const parts = [];
  parts.push(`Tool: ${tool}`);
  parts.push(`Rot: ${'NESW'[dir]}`);
  if (hover.inside) {
    parts.push(`(${hover.x}, ${hover.y})`);
    parts.push(`Ground: ${state.ground[hover.y][hover.x]}`);
    const b = buildingAt(state, hover.x, hover.y);
    if (b) {
      let s = b.type;
      if (b.item)            s += `  carrying:${b.item}`;
      if (b.pending)         s += `  pending:${b.pending}`;
      if (b.input != null)   s += `  ore:${b.input}`;
      if (b.plates != null)  s += `  plates:${b.plates}`;
      if (b.contents) {
        const items = Object.entries(b.contents).map(([k, v]) => `${k}:${v}`).join(', ');
        if (items) s += `  { ${items} }`;
      }
      parts.push(`Building: ${s}`);
    }
  }
  infoEl.textContent = parts.join('  |  ');
}
