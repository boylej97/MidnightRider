'use strict';

const TILE = 32;
const W = 30;
const H = 20;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tickEl = document.getElementById('tick');
const infoEl = document.getElementById('info');

let state = null;
let tool = 'belt';
let dir = 1;
let hover = { x: -1, y: -1 };
let lastSent = 0;

const ITEM_COLOR = {
  iron_ore:   '#d77a2e',
  iron_plate: '#c8c8c8',
  iron_gear:  '#e8c050',
};

function selectTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === t);
  });
}

document.querySelectorAll('.tool').forEach(el => {
  el.addEventListener('click', () => selectTool(el.dataset.tool));
});

window.addEventListener('keydown', e => {
  if      (e.key === '1') selectTool('miner');
  else if (e.key === '2') selectTool('belt');
  else if (e.key === '3') selectTool('furnace');
  else if (e.key === '4') selectTool('assembler');
  else if (e.key === '5') selectTool('chest');
  else if (e.key === 'x' || e.key === 'X') selectTool('remove');
  else if (e.key === 'r' || e.key === 'R') { dir = (dir + 1) % 4; draw(); }
  else if (e.key === 'Escape') selectTool('belt');
});

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  hover.x = Math.floor((e.clientX - r.left) / TILE);
  hover.y = Math.floor((e.clientY - r.top) / TILE);
  draw();
  updateInfo();
});

canvas.addEventListener('mouseleave', () => {
  hover.x = -1; hover.y = -1; draw(); updateInfo();
});

canvas.addEventListener('click', e => {
  e.preventDefault();
  if (hover.x < 0 || hover.x >= W || hover.y < 0 || hover.y >= H) return;
  if (tool === 'remove') doRemove(hover.x, hover.y);
  else doPlace(hover.x, hover.y, tool, dir);
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (hover.x < 0 || hover.x >= W || hover.y < 0 || hover.y >= H) return;
  doRemove(hover.x, hover.y);
});

document.getElementById('reset').addEventListener('click', async () => {
  if (!confirm('Remove every building?')) return;
  await fetch('/api/reset', { method: 'POST' });
  pull();
});

async function doPlace(x, y, type, d) {
  await fetch('/api/place', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, type, dir: d }),
  });
  pull();
}

async function doRemove(x, y) {
  await fetch('/api/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y }),
  });
  pull();
}

async function pull() {
  try {
    const r = await fetch('/api/state');
    if (!r.ok) return;
    state = await r.json();
    tickEl.textContent = state.tick;
    draw();
    updateInfo();
  } catch (_) {}
}

selectTool('belt');
pull();
setInterval(pull, 150);

// ---------- Rendering ----------

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state) return;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = state.ground[y][x];
      ctx.fillStyle = g === 'ore' ? '#8b6914' : '#2a3a1a';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (g === 'ore') {
        ctx.fillStyle = '#a07a20';
        ctx.fillRect(x * TILE + 5,  y * TILE + 6,  4, 4);
        ctx.fillRect(x * TILE + 18, y * TILE + 22, 4, 4);
        ctx.fillRect(x * TILE + 22, y * TILE + 9,  3, 3);
      }
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x++) {
    ctx.beginPath(); ctx.moveTo(x * TILE + 0.5, 0); ctx.lineTo(x * TILE + 0.5, H * TILE); ctx.stroke();
  }
  for (let y = 0; y <= H; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * TILE + 0.5); ctx.lineTo(W * TILE, y * TILE + 0.5); ctx.stroke();
  }

  for (const b of state.buildings) drawBuilding(b);

  if (hover.x >= 0 && hover.x < W && hover.y >= 0 && hover.y < H) {
    if (tool === 'remove') {
      ctx.fillStyle = 'rgba(255, 80, 80, 0.3)';
      ctx.fillRect(hover.x * TILE, hover.y * TILE, TILE, TILE);
      ctx.strokeStyle = '#ff6060';
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
    } else {
      ctx.globalAlpha = 0.55;
      drawBuilding({ x: hover.x, y: hover.y, dir, type: tool });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#f0a020';
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * TILE + 1, hover.y * TILE + 1, TILE - 2, TILE - 2);
    }
  }
}

function drawBuilding(b) {
  const px = b.x * TILE;
  const py = b.y * TILE;

  switch (b.type) {
    case 'miner': {
      ctx.fillStyle = '#666';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(px + 9, py + 9, TILE - 18, TILE - 18);
      ctx.fillStyle = '#999';
      ctx.fillRect(px + 13, py + 13, 6, 6);
      drawArrow(px, py, b.dir, '#ffaa00');
      if (b.goal && b.progress != null) {
        drawProgressBar(px, py, b.progress / b.goal, '#ffaa00');
      }
      break;
    }
    case 'belt': {
      ctx.fillStyle = '#c89030';
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      drawBeltStripes(px, py, b.dir);
      drawArrow(px, py, b.dir, '#3a2410');
      if (b.item) drawItem(px + TILE / 2, py + TILE / 2, b.item);
      break;
    }
    case 'furnace': {
      ctx.fillStyle = '#5a2818';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      const burning = b.input > 0 || (b.pending != null);
      ctx.fillStyle = burning ? '#e85020' : '#3a1a10';
      ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
      if (burning) {
        ctx.fillStyle = '#ffd060';
        ctx.fillRect(px + 12, py + 12, TILE - 24, TILE - 24);
      }
      drawArrow(px, py, b.dir, '#ffaa00');
      if (b.input != null && b.input > 0) drawBadge(px, py, b.input, '#d77a2e');
      if (b.goal && b.progress != null) {
        drawProgressBar(px, py, b.progress / b.goal, '#ff6020');
      }
      break;
    }
    case 'assembler': {
      ctx.fillStyle = '#284878';
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#5080b0';
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#90c0e0';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawArrow(px, py, b.dir, '#ffaa00');
      if (b.plates != null && b.plates > 0) drawBadge(px, py, b.plates, '#c8c8c8');
      if (b.goal && b.progress != null) {
        drawProgressBar(px, py, b.progress / b.goal, '#80c0e0');
      }
      break;
    }
    case 'chest': {
      ctx.fillStyle = '#5a3818';
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = '#7a5028';
      ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      ctx.strokeStyle = '#3a2010';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(px + TILE / 2 - 2, py + 6, 4, TILE - 12);
      if (b.contents) {
        let total = 0;
        for (const k in b.contents) total += b.contents[k];
        if (total > 0) drawBadge(px, py, total, '#ffd060');
      }
      break;
    }
  }
}

function drawBeltStripes(px, py, d) {
  ctx.fillStyle = '#a07020';
  const phase = state ? Math.floor(state.tick) % 4 : 0;
  if (d === 1 || d === 3) {
    for (let i = -8 + phase * 2; i < TILE; i += 8) {
      const sx = d === 1 ? i : (TILE - i - 4);
      ctx.fillRect(px + sx, py + 6, 3, TILE - 12);
    }
  } else {
    for (let i = -8 + phase * 2; i < TILE; i += 8) {
      const sy = d === 2 ? i : (TILE - i - 4);
      ctx.fillRect(px + 6, py + sy, TILE - 12, 3);
    }
  }
}

function drawArrow(px, py, d, color) {
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d];
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

function drawItem(cx, cy, item) {
  ctx.fillStyle = ITEM_COLOR[item] || '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawProgressBar(px, py, frac, color) {
  const w = TILE - 6;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px + 3, py + TILE - 5, w, 3);
  ctx.fillStyle = color;
  ctx.fillRect(px + 3, py + TILE - 5, w * Math.max(0, Math.min(1, frac)), 3);
}

function drawBadge(px, py, n, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(px + 1, py + 1, 14, 11);
  ctx.fillStyle = color;
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(String(n), px + 3, py + 2);
}

function updateInfo() {
  if (!state) { infoEl.textContent = 'Loading...'; return; }
  const parts = [];
  parts.push(`Tool: ${tool}`);
  parts.push(`Rot: ${'NESW'[dir]}`);
  if (hover.x >= 0 && hover.x < W && hover.y >= 0 && hover.y < H) {
    parts.push(`(${hover.x}, ${hover.y})`);
    parts.push(`Ground: ${state.ground[hover.y][hover.x]}`);
    const b = state.buildings.find(b => b.x === hover.x && b.y === hover.y);
    if (b) {
      let s = b.type;
      if (b.item)       s += `  carrying:${b.item}`;
      if (b.pending)    s += `  pending:${b.pending}`;
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
