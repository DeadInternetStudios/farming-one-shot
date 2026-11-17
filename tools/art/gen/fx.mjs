// Effects and particles: puffs, sparkles, drops, leaves, glows, shadows.
import { Img } from '../px.mjs';
import { R } from '../palette.mjs';
import { Rng } from '../rng.mjs';

// Radial soft glow in white, alpha falls off smoothly; tinted at runtime.
export function glow(size = 128, power = 2.2) {
  const img = new Img(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
    const a = Math.max(0, 1 - d);
    img.set(x, y, 0xffffff, Math.round(255 * Math.pow(a, power)));
  }
  return img;
}

// Flat, round shadow blob for characters and props.
export function shadow(w, h, alpha = 70) {
  const img = new Img(w, h);
  img.ellipse(w / 2, h / 2, w / 2, h / 2, R.ink[0]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (img.solid(x, y)) img.set(x, y, R.ink[0], alpha); }
  return img;
}

// Dust puff, 4 growing frames, 12 x 12.
export function dust(i) {
  const img = new Img(12, 12);
  const r = 2 + i * 1.2, a = [200, 170, 120, 70][i];
  const rng = new Rng(11 + i);
  const puffs = [[6, 6, r], [6 - r * 0.6, 6 + 0.5, r * 0.65], [6 + r * 0.6, 6 + 0.5, r * 0.65]];
  for (const [x, y, rr] of puffs) img.ellipse(x, y, rr, rr * 0.9, R.cream[1]);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if (!img.solid(x, y)) continue;
    const lit = y < 6;
    img.set(x, y, lit ? R.cream[2] : R.cream[0], a);
    if (rng.next() < 0.05) img.set(x, y, null);
  }
  return img;
}

// 4-point sparkle, 5 frames (grow then shrink), 9 x 9.
export function sparkle(i, color = R.cream) {
  const img = new Img(9, 9);
  const arms = [1, 2, 3, 2, 1][i];
  img.set(4, 4, color[3] ?? 0xffffff);
  for (let k = 1; k <= arms; k++) {
    const c = k === arms ? (color[1] ?? color[0]) : color[3] ?? 0xffffff;
    img.set(4 + k, 4, c); img.set(4 - k, 4, c); img.set(4, 4 + k, c); img.set(4, 4 - k, c);
  }
  return img;
}

export function waterDrop() {
  const img = new Img(4, 5);
  img.set(1, 0, R.water[5]); img.set(2, 0, R.water[4]);
  img.rect(0, 1, 4, 3, R.water[4]); img.set(1, 4, R.water[3]); img.set(2, 4, R.water[3]);
  img.set(0, 1, R.water[6]); img.set(1, 1, R.water[6]); img.set(3, 3, R.water[3]);
  return img;
}

export function splash(i) {
  const img = new Img(14, 8);
  const r = [2, 4, 6][i];
  for (let a = 0; a < 7; a++) {
    const t = (a / 7) * Math.PI; const x = Math.round(7 + Math.cos(t) * r), y = Math.round(6 - Math.sin(t) * r * (i === 0 ? 1 : 0.9));
    img.set(x, y, R.water[5]); if (i < 2) img.set(x, y + 1, R.water[3]);
  }
  img.set(7, 6, R.water[4]);
  return img;
}

export function ripple(i) {
  const img = new Img(16, 8);
  const rx = [3, 5.5, 7.5][i], ry = [1.2, 2.4, 3.4][i];
  img.ellipse(8, 4, rx, ry, null, (x, y, nx, ny) => (nx * nx + ny * ny > 0.62 ? R.cream[3] : undefined));
  const a = [230, 170, 90][i];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) if (img.solid(x, y)) img.set(x, y, R.cream[3], a);
  return img;
}

// Falling leaf in a ramp's colours, 3 frames, 6 x 6.
export function leaf(i, ramp = R.autumn) {
  const img = new Img(6, 6);
  const shapes = [
    [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    [[1, 3], [2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3], [5, 3]],
    [[3, 1], [3, 2], [2, 2], [3, 3], [4, 3], [3, 4], [2, 4]],
  ][i];
  shapes.forEach(([x, y], k) => img.set(x, y, ramp[k % 2 ? 3 : 4]));
  return img;
}

export function petal() {
  const img = new Img(4, 4);
  img.set(1, 0, R.blossom[4]); img.set(2, 1, R.blossom[3]); img.set(1, 1, R.blossom[4]); img.set(1, 2, R.blossom[3]); img.set(2, 2, R.blossom[2]);
  return img;
}

export function snowflake() { const img = new Img(3, 3); img.set(1, 1, R.cream[3]); img.set(1, 0, R.snow[1]); img.set(0, 1, R.snow[1]); img.set(2, 1, R.snow[1]); img.set(1, 2, R.snow[1]); return img; }
export function rainStreak() { const img = new Img(2, 7); img.set(1, 0, R.water[4], 90); img.set(1, 1, R.water[4], 150); img.set(0, 2, R.water[5], 200); img.set(0, 3, R.water[5], 230); img.set(0, 4, R.water[4], 230); img.set(0, 5, R.water[3], 200); return img; }
export function raindrop() { const img = new Img(5, 3); img.set(2, 0, R.water[5]); img.set(1, 1, R.water[4]); img.set(3, 1, R.water[4]); return img; }

export function heartFx() {
  const img = new Img(7, 6);
  for (const [x, y] of [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [3, 4]]) img.set(x, y, y === 0 || y === 1 && x < 3 ? R.pink[4] : R.pink[3]);
  img.outline(() => R.red[1]);
  return img;
}

export function firefly(i) { const img = new Img(3, 3); const a = [255, 180][i]; img.set(1, 1, R.glow[4], a); img.set(1, 0, R.glow[3], a >> 1); img.set(0, 1, R.glow[3], a >> 1); img.set(2, 1, R.glow[3], a >> 1); img.set(1, 2, R.glow[3], a >> 1); return img; }

// Chimney smoke puff, 4 frames, 10 x 10.
export function smoke(i) {
  const img = new Img(10, 10);
  const r = 2 + i * 0.9;
  img.ellipse(5, 5, r, r, R.snow[3]);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (img.solid(x, y)) img.set(x, y, y < 5 ? R.snow[3] : R.snow[1], [150, 120, 85, 50][i]);
  return img;
}

export function note(i) { const img = new Img(5, 7); img.vline(3, 0, 5, R.cream[3]); img.rect(1, 4, 3, 2, R.cream[3]); if (i) img.set(4, 1, R.cream[3]); return img; }

export function zzz() { const img = new Img(7, 7); img.hline(1, 1, 5, R.cream[3]); img.line(5, 1, 1, 5, R.cream[3]); img.hline(1, 5, 5, R.cream[3]); img.outline(() => R.ink[1]); return img; }

// Tile highlight shown where the hoe/seed will land, 16 x 16.
export function cursorTile() {
  const img = new Img(16, 16);
  const c = R.cream[3];
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
    img.set(x, y, c); img.set(x + dx, y, c); img.set(x, y + dy, c); img.set(x + 2 * dx, y, c); img.set(x, y + 2 * dy, c);
  }
  return img;
}

// A tiny exclamation / interaction marker, 7 x 12.
export function exclaim() {
  const img = new Img(7, 12);
  img.rect(2, 0, 3, 7, R.yellow[3]); img.rect(2, 9, 3, 3, R.yellow[3]); img.vline(2, 0, 7, R.yellow[4]);
  img.outline(() => R.ink[0]);
  return img;
}
