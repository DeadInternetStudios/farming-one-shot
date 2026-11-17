// The title screen: dusk hills with a lit village far away, sunset clouds, a moon, paper lanterns,
// a wax seal for the opening letter, and the logo. Everything repeats cleanly or is a single piece.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng, bayer4, hash2 } from '../rng.mjs';
import { advance, glyphImg } from '../font.mjs';

export const HILL_W = 320;
const TAU = Math.PI * 2;

// A ridge line that repeats every HILL_W pixels: a few whole-number waves added together.
function ridge(seed, base, waves) {
  const r = new Rng(seed);
  const parts = waves.map(([k, amp]) => ({ k, amp, ph: r.range(0, TAU) }));
  return (x) => base + parts.reduce((a, p) => a + p.amp * Math.sin((TAU * p.k * x) / HILL_W + p.ph), 0);
}

const KINDS = {
  far: {
    h: 62, seed: 11, base: 22, waves: [[1, 8], [2, 5], [3, 3], [5, 1.6]],
    fill: [R.purple[1], R.purple[2], R.purple[2], R.purple[3]], rim: R.purple[4],
    house: { wall: R.purple[1], roof: R.ink[2], win: R.glow[2], count: 9, size: 1 },
    trees: 0,
  },
  mid: {
    h: 70, seed: 23, base: 26, waves: [[1, 9], [2, 6], [4, 3], [7, 1.4]],
    fill: [R.teal[0], R.teal[1], R.teal[1], R.teal[2]], rim: R.teal[3],
    house: null,
    trees: 46, treeRamp: [R.teal[0], R.teal[1], R.teal[2]],
  },
  near: {
    h: 82, seed: 37, base: 30, waves: [[1, 10], [2, 5], [3, 3], [6, 1.5]],
    fill: [R.leaf[0], R.leaf[0], R.leaf[1], R.leaf[1]], rim: R.leaf[3],
    house: null,
    trees: 30, treeRamp: [R.leaf[0], R.leaf[1], R.leaf[2]],
  },
};

// Draw wherever x lands, wrapping across the seam so the strip tiles.
function wrapped(img, x, draw) {
  draw(x);
  if (x < 24) draw(x + HILL_W);
  if (x > HILL_W - 24) draw(x - HILL_W);
}

function pine(img, x, baseY, h, ramp) {
  const w = Math.max(3, Math.round(h * 0.55));
  for (let j = 0; j < h; j++) {
    const half = Math.round(((j + 1) / h) * (w / 2));
    const col = j < h * 0.3 ? ramp[2] : j < h * 0.65 ? ramp[1] : ramp[0];
    for (let i = -half; i <= half; i++) img.set(x + i, baseY - h + j, col);
  }
  img.vline(x, baseY, 2, ramp[0]);
}

function roundTree(img, x, baseY, h, ramp) {
  const r = h * 0.42;
  img.vline(x, baseY - Math.round(h * 0.3), Math.round(h * 0.34), ramp[0]);
  img.ellipse(x + 0.5, baseY - h + r, r, r * 1.05, null, (px, py, nx, ny) => (nx * -0.5 + ny * -0.6 > 0.35 ? ramp[2] : nx * 0.4 + ny * 0.5 > 0.2 ? ramp[0] : ramp[1]));
}

function cottage(img, x, baseY, spec, rng) {
  const w = rng.int(5, 8), h = rng.int(3, 5);
  img.rect(x, baseY - h, w, h, spec.wall);
  const roofH = rng.int(2, 3);
  for (let j = 0; j < roofH; j++) img.hline(x - 1 + j, baseY - h - roofH + j, w + 2 - j * 2, spec.roof);
  const lit = rng.chance(0.85);
  if (lit) img.set(x + 1 + rng.int(0, Math.max(0, w - 3)), baseY - h + 1, spec.win);
  if (lit && w >= 6 && rng.chance(0.6)) img.set(x + w - 2, baseY - h + 1, spec.win);
}

export function hills(kind) {
  const k = KINDS[kind];
  const img = new Img(HILL_W, k.h);
  const line = ridge(k.seed, k.base, k.waves);
  const rng = new Rng(k.seed * 7);
  const tops = new Array(HILL_W).fill(0).map((_, x) => Math.round(line(x)));
  for (let x = 0; x < HILL_W; x++) {
    const top = tops[x];
    for (let y = top; y < k.h; y++) {
      const t = (y - top) / Math.max(1, k.h - top);
      const f = t * (k.fill.length - 1) * 0.55 + (bayer4(x, y) - 0.5) * 0.7;
      const idx = Math.max(0, Math.min(k.fill.length - 1, Math.round(f)));
      img.set(x, y, k.fill[idx]);
    }
    img.set(x, top, k.rim);
  }
  if (k.house) {
    for (let n = 0; n < k.house.count; n++) {
      const x = Math.floor(((n + rng.range(0.15, 0.85)) / k.house.count) * HILL_W);
      cottage(img, x, tops[Math.min(HILL_W - 1, x + 3)] + 1, k.house, rng);
    }
  }
  for (let n = 0; n < k.trees; n++) {
    const x = Math.floor(((n + rng.range(0.1, 0.9)) / k.trees) * HILL_W);
    const base = tops[x] + 2;
    const h = rng.int(kind === 'near' ? 12 : 8, kind === 'near' ? 22 : 15);
    const round = kind === 'near' && rng.chance(0.3);
    wrapped(img, x, (px) => (round ? roundTree(img, px, base, h, k.treeRamp) : pine(img, px, base, h, k.treeRamp)));
  }
  return img;
}

// Sunset clouds: lit pink on top, plum underneath. Three shapes.
export function cloud(i) {
  const spec = [
    { w: 72, h: 18, puffs: [[16, 11, 14, 7], [36, 8, 18, 8], [54, 11, 14, 6], [30, 12, 26, 5]] },
    { w: 96, h: 20, puffs: [[18, 12, 16, 7], [40, 9, 20, 9], [64, 11, 18, 8], [80, 13, 12, 5], [46, 14, 36, 5]] },
    { w: 52, h: 14, puffs: [[14, 9, 11, 5], [28, 7, 14, 6], [40, 9, 10, 4], [26, 10, 22, 4]] },
  ][i];
  const img = new Img(spec.w, spec.h);
  const mask = new Img(spec.w, spec.h);
  for (const [cx, cy, rx, ry] of spec.puffs) mask.ellipse(cx, cy, rx, ry, 1);
  for (let y = 0; y < spec.h; y++) {
    for (let x = 0; x < spec.w; x++) {
      if (!mask.solid(x, y)) continue;
      // find the cloud's top edge in this column, so the colour follows the shape
      let top = y;
      while (top > 0 && mask.solid(x, top - 1)) top--;
      const depth = y - top;
      const c = depth < 1 ? R.blossom[5] : depth < 3 ? R.blossom[4] : depth < 5 ? R.blossom[3] : depth < 7 ? R.pink[1] : R.purple[2];
      const wob = bayer4(x, y) > 0.55 && depth >= 2 && depth % 2 === 0;
      img.set(x, y, wob ? R.blossom[2] : c);
    }
  }
  return img;
}

export function moon() {
  const img = new Img(30, 30);
  img.shaded(15, 15, 13.2, 13.2, [R.cream[0], R.cream[1], R.cream[2], R.cream[3]], { light: [-0.45, -0.6], lz: 0.9, dither: 0.35 });
  for (const [cx, cy, r] of [[11, 12, 2.6], [19, 9, 1.8], [18, 19, 3], [9, 20, 1.6]]) img.disc(cx, cy, r, R.cream[0]);
  img.outline(R.dirt[3]);
  return img;
}

// A paper lantern, a little taller than wide, with ribs and a warm bright middle.
export function lantern(kind) {
  const ramp = { red: R.red, gold: R.yellow, pink: R.pink }[kind];
  const img = new Img(12, 19);
  const body = (x, y, nx, ny) => {
    const rib = Math.abs(nx) < 0.18 ? 1 : Math.abs(nx) > 0.78 ? -2 : 0;
    const bright = ny > -0.5 && ny < 0.4 && Math.abs(nx) < 0.7 ? 1 : 0;
    const idx = Math.max(0, Math.min(ramp.length - 1, 2 + rib + bright + (ny < -0.7 || ny > 0.8 ? -1 : 0)));
    return ramp[idx];
  };
  img.ellipse(6, 10, 5.2, 6.6, null, body);
  img.rect(3, 3, 6, 2, R.dirt[1]); img.hline(4, 3, 4, R.dirt[3]);
  img.rect(3, 15, 6, 2, R.dirt[1]); img.hline(4, 16, 4, R.dirt[2]);
  img.vline(6, 0, 3, R.dirt[2]);
  img.vline(6, 17, 2, R.glow[1]); img.set(6, 18, R.glow[2]);
  img.set(5, 9, R.glow[4]); img.set(6, 9, R.glow[4]); img.set(6, 10, R.glow[3]);
  img.outline((c) => outlineOf(c, 0));
  return img;
}

// A wax seal: round, with a tiny lantern pressed into it.
export function seal() {
  const img = new Img(16, 16);
  img.shaded(8, 8, 7, 7, [R.red[0], R.red[1], R.red[2], R.red[3]], { light: [-0.5, -0.7], dither: 0.4 });
  for (let a = 0; a < 12; a++) { const t = (a / 12) * TAU; img.set(Math.round(8 + Math.cos(t) * 6.4), Math.round(8 + Math.sin(t) * 6.4), R.red[1]); }
  img.rect(6, 5, 4, 1, R.red[4]); img.rect(5, 6, 6, 5, R.red[4]); img.rect(6, 11, 4, 1, R.red[4]);
  img.rect(7, 7, 2, 3, R.red[1]); img.set(7, 4, R.red[4]); img.set(8, 4, R.red[4]);
  img.outline(R.red[0]);
  return img;
}

// The logo: LANTERN over HOLLOW in the game's own letters, enlarged, with a lit gradient,
// a dark outline and a soft drop shadow. Returns one image.
const SCALE = 4;
function wordMask(word) {
  let w = 0;
  for (const ch of word) w += advance(ch);
  const m = new Img(w - 1, 7);
  let x = 0;
  for (const ch of word) {
    const g = glyphImg(ch);
    if (g) m.blit(g, x, 0);
    x += advance(ch);
  }
  return m.scale(SCALE);
}

export function logo() {
  const lines = [wordMask('LANTERN'), wordMask('HOLLOW')];
  const gap = 4;
  const pad = 6;
  const W = Math.max(...lines.map((l) => l.w)) + pad * 2;
  const H = lines.reduce((a, l) => a + l.h, 0) + gap + pad * 2 + 4;
  const mask = new Img(W, H);
  let y = pad;
  for (const l of lines) {
    mask.blit(l, Math.floor((W - l.w) / 2), y);
    y += l.h + gap;
  }
  // fatten the strokes by a pixel all round, so the letters read as chunky, not thin
  mask.outline(R.ink[0], { diag: true });
  const ramp = [R.cream[3], R.yellow[4], R.yellow[3], R.yellow[3], R.yellow[2], R.orange[4], R.orange[3], R.orange[2]];
  const out = new Img(W, H);
  // drop shadow first, so the letters sit on top
  const shadow = mask.clone().silhouette(R.ink[0]);
  shadow.outline(R.ink[0], { diag: true });
  shadow.outline(R.ink[0], { diag: true });
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) if (shadow.solid(sx, sy)) out.over(sx, sy + 3, R.ink[0], 150);
  // the dark outline, two pixels thick, in wine then plum
  const edge = mask.clone().silhouette(R.red[0]);
  edge.outline(R.red[0], { diag: true });
  edge.outline(R.ink[0], { diag: true });
  out.blit(edge, 0, 0);
  // letters: a vertical gradient per line, light along the top, deep along the bottom
  const lineTops = [];
  let top = pad;
  for (const l of lines) { lineTops.push(top); top += l.h + gap; }
  // colour by position inside each line, using the fattened mask
  const lineOf = (py) => lineTops.findIndex((t, i) => py >= t - 2 && py < t + lines[i].h + 2);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      if (!mask.solid(px, py)) continue;
      const li = lineOf(py);
      if (li < 0) continue;
      const t = (py - (lineTops[li] - 1)) / (lines[li].h + 2);
      const f = t * (ramp.length - 1) + (bayer4(px, py) - 0.5) * 0.9;
      let col = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(f)))];
      const up = mask.solid(px, py - 1), down = mask.solid(px, py + 1);
      const left = mask.solid(px - 1, py), right = mask.solid(px + 1, py);
      if (!up) col = R.cream[3];
      else if (!mask.solid(px, py - 2)) col = R.yellow[4];
      if (!down) col = R.orange[1];
      else if (!mask.solid(px, py + 2)) col = R.orange[2];
      const sideOk = (dx) => !mask.solid(px + dx, py - 1) && !mask.solid(px + dx, py + 1);
      if (!left && sideOk(-1) && up && down) col = R.yellow[4];
      if (!right && sideOk(1) && up && down) col = R.orange[2];
      out.set(px, py, col);
    }
  }
  return out;
}

// Soft stars of two sizes, one frame each: a dot and a little plus.
export function star(kind) {
  if (kind === 0) return new Img(1, 1).set(0, 0, R.cream[3]);
  const img = new Img(3, 3);
  img.set(1, 0, R.cream[2]); img.set(0, 1, R.cream[2]); img.set(2, 1, R.cream[2]); img.set(1, 2, R.cream[2]); img.set(1, 1, R.cream[3]);
  return img;
}
