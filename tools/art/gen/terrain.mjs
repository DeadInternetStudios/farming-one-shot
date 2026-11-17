// Terrain: tileable grass, and 47-tile blob autotiles for land over water, paths and soil.
import { Img } from '../px.mjs';
import { R } from '../palette.mjs';
import { Rng, tileNoise, bayer4, hash2 } from '../rng.mjs';

export const T = 16;
export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

export function reduceMask(m) {
  if (!(m & N && m & E)) m &= ~NE;
  if (!(m & E && m & S)) m &= ~SE;
  if (!(m & S && m & W)) m &= ~SW;
  if (!(m & W && m & N)) m &= ~NW;
  return m;
}
export const BLOB_MASKS = [...new Set(Array.from({ length: 256 }, (_, m) => reduceMask(m)))].sort((a, b) => a - b);
export const BLOB_INDEX = Array.from({ length: 256 }, (_, m) => BLOB_MASKS.indexOf(reduceMask(m)));
if (BLOB_MASKS.length !== 47) throw new Error('blob set should have 47 tiles, got ' + BLOB_MASKS.length);

const BUMP = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];

// One blob tile for a neighbour mask. interior(x, y) gives colours, rim and outer give edge art.
export function blobTile(mask, o) {
  const M = o.inset ?? 2, Rr = o.radius ?? 5, Rn = o.notch ?? 3;
  const has = (bit) => (mask & bit) !== 0;
  const grid = Array.from({ length: T }, () => new Array(T).fill(false));
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const qx = x < 8 ? 0 : 1, qy = y < 8 ? 0 : 1;
    const hN = qx === 0 ? has(W) : has(E);
    const vN = qy === 0 ? has(N) : has(S);
    const cN = qx === 0 ? (qy === 0 ? has(NW) : has(SW)) : (qy === 0 ? has(NE) : has(SE));
    const u = qx === 0 ? x : T - 1 - x, v = qy === 0 ? y : T - 1 - y;
    let ins;
    if (hN && vN) ins = cN ? true : (u + 0.5) * (u + 0.5) + (v + 0.5) * (v + 0.5) >= Rn * Rn;
    else if (hN) ins = v >= M + BUMP[x];
    else if (vN) ins = u >= M + BUMP[y];
    else {
      const cu = u - M, cv = v - M;
      if (cu < 0 || cv < 0) ins = false;
      else if (cu < Rr && cv < Rr) { const du = Rr - (cu + 0.5), dv = Rr - (cv + 0.5); ins = du * du + dv * dv <= Rr * Rr; }
      else ins = true;
    }
    grid[y][x] = ins;
  }
  const inside = (x, y) => {
    if (x >= 0 && x < T && y >= 0 && y < T) return grid[y][x];
    const dx = x < 0 ? -1 : x >= T ? 1 : 0, dy = y < 0 ? -1 : y >= T ? 1 : 0;
    const bit = dy === -1 ? (dx === -1 ? NW : dx === 1 ? NE : N) : dy === 1 ? (dx === -1 ? SW : dx === 1 ? SE : S) : (dx === -1 ? W : E);
    return has(bit);
  };
  const img = new Img(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!grid[y][x]) continue;
    const c = o.interior(x, y);
    const ex = { x, y, top: !inside(x, y - 1), bottom: !inside(x, y + 1), left: !inside(x - 1, y), right: !inside(x + 1, y), c };
    const edge = ex.top || ex.bottom || ex.left || ex.right;
    let d = 2;
    if (edge) d = 0;
    else if (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2) || !inside(x - 1, y - 1) || !inside(x + 1, y - 1) || !inside(x - 1, y + 1) || !inside(x + 1, y + 1)) d = 1;
    ex.d = d;
    img.set(x, y, o.rim && d < (o.rimDepth ?? 1) ? (o.rim(ex) ?? c) : c);
  }
  if (o.outer) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (grid[y][x]) continue;
      const ex = { x, y, below: inside(x, y - 1), above: inside(x, y + 1), right: inside(x - 1, y), left: inside(x + 1, y) };
      const r = o.outer(ex);
      if (r) img.set(x, y, r.c, r.a ?? 255);
    }
  }
  return img;
}

// A fully inside tile (all neighbours present) with a given interior.
export function fullTile(interior) {
  const img = new Img(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, interior(x, y));
  return img;
}

// ---------- grass ----------

export function grassInterior(seed, ramp = R.grass, o = {}) {
  const rng = new Rng(seed * 7919 + 13);
  const g = ramp;
  const cells = Array.from({ length: T }, () => new Array(T).fill(g[3]));
  // very soft ground variation, only a little dither so tiles never read as squares
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = tileNoise(x, y, T, seed, 4);
    if (n < 0.22 && bayer4(x, y) > 0.55) cells[y][x] = g[2];
    else if (n > 0.8 && bayer4(x, y) > 0.55) cells[y][x] = g[4];
  }
  // scattered single pixels
  for (let i = 0; i < (o.flecks ?? 9); i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = g[2];
  for (let i = 0; i < (o.lights ?? 6); i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = g[4];
  // little blades: dark foot, light tip
  for (let i = 0; i < (o.blades ?? 4); i++) {
    const x = rng.int(1, T - 2), y = rng.int(1, T - 2);
    cells[y + 1][x] = g[2];
    cells[y][x] = g[4];
    if (rng.chance(0.5)) { cells[y][x + 1] = g[3]; cells[y - 1][x] = g[5]; }
  }
  for (let i = 0; i < (o.sparkles ?? 1); i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = g[5];
  if (o.specks) {
    for (let i = 0; i < o.specks.n; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = rng.pick(o.specks.colors);
  }
  return (x, y) => cells[y][x];
}

// ---------- sand ----------

export function sandInterior(seed) {
  const rng = new Rng(seed * 131 + 7);
  const s = R.sand;
  const cells = Array.from({ length: T }, () => new Array(T).fill(s[2]));
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = tileNoise(x, y, T, seed + 40, 8);
    if (n < 0.3) cells[y][x] = s[1];
    else if (n > 0.7) cells[y][x] = s[3];
  }
  for (let i = 0; i < 10; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = rng.chance(0.5) ? s[1] : s[3];
  for (let i = 0; i < 2; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = s[4];
  for (let i = 0; i < 2; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = s[0];
  return (x, y) => cells[y][x];
}

// ---------- snow ----------

export function snowInterior(seed) {
  const rng = new Rng(seed * 311 + 5);
  const s = R.snow;
  const cells = Array.from({ length: T }, () => new Array(T).fill(s[3]));
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = tileNoise(x, y, T, seed + 90, 8);
    if (n < 0.3) cells[y][x] = s[2];
    else if (n > 0.72) cells[y][x] = s[4];
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.int(0, T - 1), y = rng.int(0, T - 1);
    cells[y][x] = s[2];
    cells[(y + 1) % T][x] = s[1];
  }
  for (let i = 0; i < 3; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = s[4];
  // a few dark grass tips still poking through
  for (let i = 0; i < 2; i++) { const x = rng.int(1, T - 2), y = rng.int(1, T - 2); cells[y][x] = R.grassFall[0]; cells[y - 1][x] = R.grassFall[1]; }
  return (x, y) => cells[y][x];
}

// ---------- path (packed earth) ----------

export function pathInterior(seed = 1) {
  const rng = new Rng(seed * 17 + 3);
  const d = R.dirt;
  const cells = Array.from({ length: T }, () => new Array(T).fill(d[4]));
  for (let i = 0; i < 12; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = d[3];
  for (let i = 0; i < 8; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = d[5];
  for (let i = 0; i < 2; i++) { const x = rng.int(1, T - 3), y = rng.int(1, T - 3); cells[y][x] = d[2]; cells[y][x + 1] = d[3]; }
  return (x, y) => cells[y][x];
}

export const pathRim = (e) => {
  if (e.bottom || e.right) return R.dirt[2];
  if (e.top || e.left) return R.dirt[3];
  return undefined;
};

// ---------- cobblestone (village paths) ----------

export function cobbleInterior(seed = 1) {
  const s = R.stone;
  const rng = new Rng(seed * 29 + 1);
  const cells = Array.from({ length: T }, () => new Array(T).fill(s[3]));
  // brick-like cobbles: rows 5 tall, staggered, 1px mortar
  const rowsY = [0, 5, 10, 16];
  for (let r = 0; r < 3; r++) {
    const y0 = rowsY[r], y1 = rowsY[r + 1];
    const off = r % 2 === 0 ? 0 : 4;
    for (let x = 0; x < T; x++) {
      const cx = (x + off) % 8;
      for (let y = y0; y < y1; y++) {
        const mortar = y === y1 - 1 || cx === 7;
        let c;
        if (mortar) c = s[1];
        else if (y === y0) c = s[5];
        else if (cx === 0) c = s[4];
        else c = s[3];
        if (!mortar && rng.chance(0.12)) c = s[2];
        cells[y][x] = c;
      }
    }
  }
  return (x, y) => cells[y][x];
}
export const cobbleRim = (e) => {
  if (e.bottom || e.right) return R.stone[1];
  if (e.top || e.left) return R.stone[4];
  return undefined;
};

// ---------- tilled soil ----------

export function soilInterior(wet, seed = 1) {
  const rng = new Rng(seed * 53 + (wet ? 9 : 2));
  const base = wet ? R.wet[2] : R.dirt[2];
  const ridge = wet ? R.wet[3] : R.dirt[3];
  const groove = wet ? R.wet[1] : R.dirt[1];
  const hi = wet ? R.wet[4] : R.dirt[4];
  const cells = Array.from({ length: T }, () => new Array(T).fill(base));
  // furrows that wobble and break, so it reads as turned earth and not as planks
  const rows = [2, 6, 10, 14];
  for (const r0 of rows) {
    const shiftAt = [rng.int(3, 6), rng.int(9, 12)];
    for (let x = 0; x < T; x++) {
      const y = (r0 + (x >= shiftAt[0] ? 1 : 0) - (x >= shiftAt[1] ? 1 : 0) + T) % T;
      if (!rng.chance(0.28)) cells[y][x] = groove;
      if (rng.chance(0.6)) cells[(y + T - 1) % T][x] = ridge;
      if (rng.chance(0.18)) cells[(y + 1) % T][x] = ridge;
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = rng.int(0, T - 1), y = rng.int(0, T - 1);
    cells[y][x] = rng.chance(0.5) ? ridge : groove;
  }
  for (let i = 0; i < 5; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = hi;
  if (wet) for (let i = 0; i < 4; i++) cells[rng.int(0, T - 1)][rng.int(0, T - 1)] = R.water[3];
  return (x, y) => cells[y][x];
}
export const soilRim = (wet) => (e) => {
  if (e.top || e.left) return wet ? R.wet[3] : R.dirt[4];
  if (e.bottom || e.right) return wet ? R.wet[0] : R.dirt[1];
  return undefined;
};

// ---------- land over water: sandy bank, foam and bank shadow ----------

export function bankRim(e) {
  if (e.d === 0) return e.top ? R.sand[3] : R.sand[2];
  return undefined;
}
bankRim.depth = 2;
export function bankOuter(e) {
  const touching = e.below || e.above || e.left || e.right;
  if (!touching) return null;
  if (e.below) return { c: R.water[5], a: 150 };
  if (e.above) return { c: R.water[1], a: 150 };
  return { c: R.water[5], a: 120 };
}

// ---------- water ----------

// Seamless animated water, size x size, looping smoothly. Used as a TileSprite under the land.
export function waterFrames(count = 6, size = 64) {
  const frames = [];
  const w = R.water;
  const rng = new Rng(4242);
  const dashes = Array.from({ length: Math.round((size * size) / 90) }, () => ({
    x: rng.int(0, size - 1), y: rng.int(0, size - 1), len: rng.int(3, 6), ph: rng.range(0, Math.PI * 2), tone: rng.chance(0.25) ? 5 : 4,
  }));
  const sparks = Array.from({ length: Math.round((size * size) / 260) }, () => ({ x: rng.int(0, size - 1), y: rng.int(0, size - 1), ph: rng.int(0, count - 1) }));
  for (let f = 0; f < count; f++) {
    const img = new Img(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let c = w[2];
      const n = tileNoise(x, y, size, 77, 8);
      if (n < 0.2 && bayer4(x, y) > 0.6) c = w[1];
      else if (n > 0.82 && bayer4(x, y) > 0.6) c = w[3];
      img.set(x, y, c);
    }
    for (const d of dashes) {
      const ox = Math.round(1.6 * Math.sin((f / count) * Math.PI * 2 + d.ph));
      for (let i = 0; i < d.len; i++) {
        const x = (d.x + ox + i + size) % size;
        img.set(x, d.y, w[d.tone]);
        if (i > 0 && i < d.len - 1) img.set(x, (d.y + 1) % size, w[3]);
      }
    }
    for (const s of sparks) {
      const on = (f + s.ph) % count;
      if (on === 0) { img.set(s.x, s.y, w[6]); img.set((s.x + 1) % size, s.y, w[5]); }
      else if (on === 1 || on === count - 1) img.set(s.x, s.y, w[5]);
    }
    frames.push(img);
  }
  return frames;
}
