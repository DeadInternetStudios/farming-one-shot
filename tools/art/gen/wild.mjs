// The wild places: forage, the forest mine mouth, the lake hut, animals and the cave tileset.
import { Img } from '../px.mjs';
import { R, mix, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';
import { drawText } from '../font.mjs';
import { foliage } from './objects.mjs';
import { roof, wall, foundation, window as win, door } from './buildings.mjs';

const out = (img) => img.outline((c) => outlineOf(c));

// ------------------------------------------------------------------ forage

export function mushroom(v = 0) {
  const img = new Img(16, 16);
  const cap = (cx, cy, rx, ry, spots) => {
    const a = new Img(16, 16);
    a.shaded(cx, cy, rx, ry, R.red, { dither: 0.35 });
    for (let y = Math.round(cy + ry * 0.35); y < 16; y++) for (let x = 0; x < 16; x++) a.set(x, y, null);
    for (const [sx, sy] of spots) a.set(Math.round(cx + sx), Math.round(cy + sy), R.cream[3]);
    return a;
  };
  const stalk = (x, y, w, h) => {
    img.rect(x, y, w, h, R.cream[2]); img.vline(x, y, h, R.cream[3]); img.vline(x + w - 1, y, h, R.cream[0]);
    img.hline(x - 1, y + h - 1, w + 2, R.cream[0]);
  };
  if (v === 0) {
    stalk(6, 9, 4, 5);
    img.blit(cap(8, 9, 6, 5.2, [[-2, -3], [2, -2], [0, -4], [-4, -1], [3, -4]]), 0, 0);
    img.hline(3, 9, 10, R.red[0]);
  } else {
    stalk(4, 10, 3, 4); stalk(10, 12, 2, 2);
    img.blit(cap(5.5, 10, 4.6, 4, [[-1, -2], [2, -1]]), 0, 0);
    img.blit(cap(11, 12, 3.2, 2.8, [[0, -1]]), 0, 0);
    img.hline(2, 10, 8, R.red[0]); img.hline(8, 12, 6, R.red[0]);
  }
  return out(img);
}

export function berries(v = 0) {
  const img = new Img(16, 16);
  const rng = new Rng(40 + v * 9);
  foliage(img, [{ x: 8, y: 9, r: 6.2, z: 0 }, { x: 4.5, y: 10.5, r: 4.4, z: 0.4 }, { x: 11.5, y: 10.5, r: 4.4, z: 0.4 }, { x: 8, y: 6.5, r: 4.2, z: 0.8 }], R.leaf, { dither: 0.45 });
  img.rect(0, 14, 16, 2, null);
  const spots = [[5, 7], [9, 5], [11, 9], [6, 11], [9, 10], [3, 10], [12, 12]];
  for (const [bx, by] of spots) {
    if (!rng.chance(0.82)) continue;
    const x = bx + (v ? 1 : 0);
    img.set(x, by, R.red[3]); img.set(x + 1, by, R.red[2]); img.set(x, by + 1, R.red[1]); img.set(x + 1, by + 1, R.red[1]);
    img.set(x, by, R.red[5]);
  }
  return out(img);
}

export function clay() {
  const img = new Img(16, 12);
  img.ellipse(8, 7, 7.2, 4.2, null, (x, y, nx, ny) => {
    const e = nx * nx + ny * ny;
    if (e > 0.72) return R.dirt[2];
    return ny < -0.15 ? R.dirt[4] : R.dirt[3];
  });
  img.ellipse(6.5, 6, 3.2, 1.5, R.dirt[5]);
  img.hline(4, 6, 4, R.dirt[6]); img.set(10, 8, R.dirt[2]); img.set(11, 6, R.dirt[2]);
  img.set(12, 5, R.stone[3]); img.set(3, 8, R.stone[3]);
  return out(img);
}

// ------------------------------------------------------------------ the mine mouth

export function mineEntrance() {
  const W = 72, H = 60;
  const day = new Img(W, H);
  foliage(day, [
    { x: 36, y: 34, r: 30, z: 0 }, { x: 14, y: 42, r: 15, z: 1 }, { x: 58, y: 42, r: 15, z: 1 },
    { x: 24, y: 24, r: 18, z: 0.5 }, { x: 48, y: 24, r: 18, z: 0.5 }, { x: 36, y: 16, r: 14, z: 0.8 },
  ], R.stone, { dither: 0.5, gain: 1.05 });
  day.rect(0, 54, W, 6, null);
  const rng = new Rng(8);
  for (let i = 0; i < 40; i++) {
    const x = rng.int(4, W - 5), y = rng.int(6, 50);
    if (day.col(x, y) !== null) day.set(x, y, rng.chance(0.5) ? R.stone[2] : R.stone[4]);
  }
  // mossy top
  for (let x = 14; x < 58; x++) for (let y = 3; y < 9; y++) if (day.col(x, y) !== null && rng.chance(0.45 - (y - 3) * 0.06)) day.set(x, y, rng.pick([R.leaf[3], R.leaf[4], R.leaf[2]]));
  // the opening
  const ax = 36, ay0 = 24;
  for (let y = ay0; y < 56; y++) {
    const half = y < ay0 + 7 ? 6 + (y - ay0) * 0.9 : 12.3;
    for (let x = 0; x < W; x++) if (Math.abs(x + 0.5 - ax) <= half) day.set(x, y, y > 48 ? R.ink[1] : R.ink[0]);
  }
  for (let y = 32; y < 56; y++) { day.set(ax - 5, y, R.ink[1]); day.set(ax + 4, y, R.ink[1]); }
  // timber frame
  for (const px of [ax - 13, ax + 11]) { day.rect(px, 28, 3, 28, R.wood[3]); day.vline(px, 28, 28, R.wood[4]); day.vline(px + 2, 28, 28, R.wood[1]); }
  day.rect(ax - 15, 22, 31, 5, R.wood[3]); day.hline(ax - 15, 22, 31, R.wood[5]); day.hline(ax - 15, 26, 31, R.wood[1]);
  day.rect(ax - 12, 27, 3, 5, R.wood[2]); day.rect(ax + 10, 27, 3, 5, R.wood[2]);
  // a little sign
  day.rect(ax - 11, 14, 23, 9, R.wood[4]); day.hline(ax - 11, 14, 23, R.wood[5]); day.hline(ax - 11, 22, 23, R.wood[1]);
  drawText(day, ax - 9, 15, 'MINE', R.ink[1]);
  day.set(ax - 9, 22, R.ink[2]); day.set(ax + 9, 22, R.ink[2]);
  // a hanging lantern
  day.vline(ax + 14, 27, 4, R.ink[2]); day.rect(ax + 13, 31, 3, 5, R.ink[1]); day.rect(ax + 14, 32, 1, 3, R.glow[3]);
  // rails
  day.hline(ax - 6, 54, 12, R.ink[3]);
  return out(day);
}

// ------------------------------------------------------------------ the lake hut

export function shack() {
  const W = 80, H = 72;
  const day = new Img(W, H), glow = new Img(W, H);
  const plank = [R.wood[2], R.wood[3], R.wood[4]];
  roof(day, { y0: 6, h: 22, rx0: 14, rx1: W - 15, ex0: 1, ex1: W - 2, ramp: R.teal, seed: 77 });
  const wallTop = 32;
  wall(day, { x0: 6, y0: wallTop, w: W - 12, h: 32, plaster: plank, beam: R.wood, seed: 5 });
  // plank lines
  for (let y = wallTop + 6; y < wallTop + 32; y += 5) day.hline(8, y, W - 16, R.wood[1]);
  foundation(day, { x0: 5, y0: wallTop + 32, w: W - 10, h: 4 });
  day.hline(1, wallTop, W - 2, R.teal[0]); day.hline(2, wallTop + 1, W - 4, R.teal[1]);
  win(day, glow, { x: 12, y: wallTop + 10, w: 13, h: 12, box: false });
  door(day, glow, { x: 48, y: wallTop + 6, w: 14, h: 30, color: R.blue, lantern: true });
  // a net and an oar
  day.line(66, 40, 72, 54, R.cream[0]); day.line(72, 40, 66, 54, R.cream[0]); day.line(66, 47, 72, 47, R.cream[0]); day.line(67, 52, 71, 52, R.cream[0]);
  day.vline(4, 38, 28, R.wood[4]); day.rect(2, 38, 4, 7, R.wood[5]);
  // a few drying fish on a line
  day.hline(26, 30, 18, R.ink[2]);
  for (const x of [28, 34, 40]) { day.rect(x, 31, 3, 6, R.teal[4]); day.set(x + 1, 37, R.teal[3]); }
  out(day); glow.outline(() => null);
  return { day, glow };
}

export function rowboat() {
  const img = new Img(40, 16);
  img.poly([[2, 5], [37, 5], [33, 13], [7, 13]], R.wood[3]);
  img.hline(2, 5, 36, R.wood[5]); img.hline(4, 6, 32, R.wood[4]);
  for (let x = 8; x < 34; x += 6) img.vline(x, 7, 6, R.wood[2]);
  img.hline(7, 12, 27, R.wood[1]); img.hline(8, 13, 25, R.wood[0]);
  img.rect(14, 4, 2, 2, R.wood[1]); img.rect(26, 4, 2, 2, R.wood[1]);
  img.line(28, 2, 38, 8, R.wood[4]);
  return out(img);
}

// ------------------------------------------------------------------ animals

export function coop() {
  const W = 64, H = 64;
  const day = new Img(W, H), glow = new Img(W, H);
  roof(day, { y0: 6, h: 20, rx0: 12, rx1: W - 13, ex0: 1, ex1: W - 2, ramp: R.red, seed: 31 });
  const wallTop = 30;
  wall(day, { x0: 5, y0: wallTop, w: W - 10, h: 28, plaster: [R.cream[0], R.cream[1], R.cream[2]], beam: R.wood, seed: 9 });
  foundation(day, { x0: 4, y0: wallTop + 28, w: W - 8, h: 4 });
  day.hline(1, wallTop, W - 2, R.red[0]); day.hline(2, wallTop + 1, W - 4, R.red[1]);
  win(day, glow, { x: 12, y: wallTop + 8, w: 11, h: 10, box: false });
  // the hen door and a ramp
  day.rect(36, wallTop + 14, 12, 18, R.wood[2]); day.rect(37, wallTop + 15, 10, 17, R.ink[0]);
  day.frame(36, wallTop + 14, 12, 18, R.wood[4]);
  day.poly([[37, 62], [47, 62], [50, 63], [34, 63]], R.wood[3]);
  for (let x = 35; x < 49; x += 3) day.vline(x, 60, 3, R.wood[1]);
  glow.rect(37, wallTop + 15, 10, 17, R.glow[1]);
  // a pile of hay on the side
  for (let i = 0; i < 18; i++) day.set(50 + (i % 6), 60 - Math.floor(i / 6), i % 2 ? R.yellow[3] : R.yellow[2]);
  out(day); glow.outline(() => null);
  return { day, glow };
}

const henColors = {
  white: { body: R.cream[3], shade: R.cream[1], wing: R.cream[2], comb: R.red[3] },
  brown: { body: R.dirt[4], shade: R.dirt[2], wing: R.dirt[3], comb: R.red[3] },
};

// A hen facing right. 14 x 13. pose: 'idle' | 'walk0' | 'walk1' | 'peck0' | 'peck1'
export function hen(kind = 'white', pose = 'idle') {
  const c = henColors[kind];
  const img = new Img(14, 13);
  const peck = pose.startsWith('peck');
  const dip = pose === 'peck1' ? 3 : 0;
  img.ellipse(6.5, 7.5, 5, 3.6, c.body); img.hline(3, 9, 7, c.shade);
  img.ellipse(5.5, 7.5, 2.6, 1.8, c.wing);
  // tail
  img.poly([[1, 4], [3, 6], [2, 9]], c.body); img.set(1, 5, c.shade);
  // head
  const hx = peck ? 11 : 10, hy = peck ? 4 + dip : 3;
  img.rect(hx - 1, hy - 1, 3, 3, c.body);
  img.set(hx + 1, hy, R.ink[0]);
  img.set(hx + 2, hy + 1, R.orange[4]); img.set(hx + 2, hy + 2, R.orange[3]);
  img.set(hx - 1, hy - 2, c.comb); img.set(hx, hy - 2, c.comb);
  if (!peck) { img.vline(9, 4, 3, c.body); } else { img.line(9, 5, hx, hy, c.body); }
  // legs
  const l = pose === 'walk0' ? [5, 8] : pose === 'walk1' ? [6, 7] : [6, 8];
  img.vline(l[0], 11, 2, R.orange[3]); img.vline(l[1], 11, 2, R.orange[3]);
  img.set(l[0] + 1, 12, R.orange[3]); img.set(l[1] + 1, 12, R.orange[3]);
  return out(img);
}

export function chick(pose = 'idle') {
  const img = new Img(9, 9);
  img.ellipse(4.5, 5.2, 3.4, 2.8, R.yellow[3]); img.hline(2, 7, 5, R.yellow[2]);
  img.rect(5, 1, 3, 3, R.yellow[3]); img.set(7, 2, R.ink[0]); img.set(8, 3, R.orange[3]);
  const o = pose === 'walk' ? 1 : 0;
  img.vline(3 + o, 8, 1, R.orange[3]); img.vline(5 - o, 8, 1, R.orange[3]);
  return out(img);
}

// A cat in profile facing right. 18 x 15. pose: 'sit' | 'walk0' | 'walk1' | 'sleep'
export function cat(pose = 'sit') {
  const body = R.orange[3], dark = R.orange[2], light = R.cream[2];
  const img = new Img(18, 15);
  if (pose === 'sleep') {
    img.ellipse(9, 10, 7.5, 4, body); img.hline(3, 12, 12, dark);
    img.ellipse(13, 9, 3.2, 2.8, body); img.set(11, 6, dark); img.set(14, 6, dark); img.set(11, 7, body); img.set(14, 7, body);
    img.hline(12, 9, 2, R.ink[1]); img.line(2, 11, 6, 13, dark); img.hline(5, 13, 7, light);
    return out(img);
  }
  if (pose === 'sit') {
    img.ellipse(8, 9.5, 4.2, 4.8, body); img.vline(6, 7, 6, dark); img.ellipse(8, 11, 2, 2.4, light);
    img.ellipse(10.5, 5, 3.2, 3, body);
    img.poly([[8, 3], [9, 0], [11, 3]], body); img.poly([[11, 3], [13, 0], [14, 3]], body);
    img.set(9, 1, R.pink[3]); img.set(13, 1, R.pink[3]);
    img.set(11, 5, R.ink[0]); img.set(13, 5, R.ink[0]); img.set(12, 6, R.pink[3]);
    img.line(4, 13, 1, 9, dark); img.line(1, 9, 2, 6, body);
    img.rect(5, 13, 3, 1, light); img.rect(9, 13, 3, 1, light);
    return out(img);
  }
  const a = pose === 'walk0' ? 0 : 1;
  img.ellipse(8, 8, 6, 3.2, body); img.hline(3, 10, 10, dark);
  img.ellipse(14, 6, 3, 2.7, body);
  img.poly([[12, 4], [13, 1], [14, 4]], body); img.poly([[14, 4], [16, 1], [17, 4]], body);
  img.set(15, 6, R.ink[0]); img.set(17, 7, R.pink[3]);
  img.line(2, 8, 0, 4, body); img.set(0, 3, dark);
  for (const [x, lift] of [[4, a], [6, 1 - a], [10, a], [12, 1 - a]]) img.vline(x, 10 + lift, 3 - lift, light);
  return out(img);
}

export function eggBasket() {
  const img = new Img(16, 14);
  img.ellipse(8, 9, 7, 3.6, R.wood[3]); img.hline(2, 9, 12, R.wood[4]); img.hline(3, 11, 10, R.wood[1]);
  for (let x = 3; x < 14; x += 3) img.vline(x, 8, 5, R.wood[2]);
  for (const [x, y] of [[5, 5], [8, 4], [11, 5], [7, 7]]) { img.ellipse(x, y, 2.2, 2.7, R.cream[3]); img.set(x - 1, y - 1, R.snow[4]); img.set(x + 1, y + 1, R.cream[1]); }
  return out(img);
}

// ------------------------------------------------------------------ fishing

export function bobber(up = false) {
  const img = new Img(8, 10);
  const y = up ? 0 : 2;
  img.ellipse(4, y + 3, 2.6, 2.6, R.cream[3]); img.rect(1, y + 3, 6, 3, R.red[3]); img.hline(1, y + 3, 6, R.red[4]); img.hline(2, y + 6, 4, R.red[1]);
  img.vline(4, y - 1 < 0 ? 0 : y - 1, 2, R.ink[2]);
  return out(img);
}

// 14 x 14 nine-slice frames for the fishing bar.
export function fishTrack() {
  const img = new Img(14, 14);
  img.roundRect(0, 0, 14, 14, 4, R.ink[0]); img.roundRect(1, 1, 12, 12, 3, R.water[0]);
  for (let y = 2; y < 12; y++) img.hline(2, y, 10, y < 4 ? R.water[1] : R.water[0]);
  return img;
}
export function fishZone() {
  const img = new Img(14, 14);
  img.roundRect(0, 0, 14, 14, 4, R.leaf[1]); img.roundRect(1, 1, 12, 12, 3, R.leaf[4]);
  img.hline(3, 2, 8, R.leaf[5]); img.hline(2, 11, 10, R.leaf[3]);
  return img;
}
export function fishMeter() {
  const img = new Img(14, 14);
  img.roundRect(0, 0, 14, 14, 4, R.ink[0]); img.roundRect(1, 1, 12, 12, 3, R.yellow[2]);
  img.hline(3, 2, 8, R.yellow[4]); img.hline(2, 11, 10, R.yellow[1]);
  return img;
}

// ------------------------------------------------------------------ the cave tileset

const T = 16;
const floorBase = (v) => {
  const img = new Img(T, T);
  const rng = new Rng(900 + v * 17);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, R.stone[2]);
  for (let i = 0; i < 26; i++) { const x = rng.int(0, 15), y = rng.int(0, 15); img.set(x, y, rng.chance(0.55) ? R.stone[1] : R.stone[3]); }
  if (v === 1) { img.line(3, 4, 7, 6, R.stone[1]); img.line(7, 6, 9, 11, R.stone[1]); }
  if (v === 2) { for (const [x, y] of [[11, 3], [12, 3], [11, 4]]) img.set(x, y, R.stone[4]); img.set(4, 12, R.stone[4]); img.set(5, 12, R.stone[1]); }
  if (v === 3) { img.ellipse(5, 10, 2.5, 1.5, R.stone[1]); img.hline(4, 9, 3, R.stone[3]); }
  return img;
};

// A floor tile darkened toward walls. mask bits: 1 wall above, 2 wall left, 4 wall right.
export function caveFloor(v = 0, mask = 0) {
  const img = floorBase(v);
  const dark = R.ink[0];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let t = 0;
    if (mask & 1) t = Math.max(t, Math.max(0, 0.7 - y * 0.11));
    if (mask & 2) t = Math.max(t, Math.max(0, 0.5 - x * 0.12));
    if (mask & 4) t = Math.max(t, Math.max(0, 0.5 - (T - 1 - x) * 0.12));
    if (t > 0.05) img.set(x, y, mix(img.col(x, y), dark, t));
  }
  return img;
}

// Solid rock seen from above.
export function caveMass(v = 0) {
  const img = new Img(T, T);
  const rng = new Rng(1200 + v * 23);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, R.ink[1]);
  for (let i = 0; i < 34; i++) { const x = rng.int(0, 15), y = rng.int(0, 15); img.set(x, y, rng.chance(0.6) ? R.ink[2] : R.ink[0]); }
  for (let i = 0; i < 4; i++) { const x = rng.int(1, 12), y = rng.int(1, 13); img.hline(x, y, 3, R.ink[2]); img.hline(x + 1, y + 1, 2, R.ink[0]); }
  return img;
}

// The front face of a wall: what you see of rock standing above the floor.
export function caveFace(v = 0) {
  const img = new Img(T, T);
  const rng = new Rng(1500 + v * 29);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let c = R.stone[1];
    if (y < 3) c = R.stone[3];
    else if (y < 5) c = R.stone[2];
    else if (y > 13) c = R.ink[1];
    img.set(x, y, c);
  }
  for (let i = 0; i < 4; i++) {
    const x = rng.int(1, 14), y0 = rng.int(4, 8), h = rng.int(3, 7);
    img.vline(x, y0, h, R.stone[2]); img.vline(x + 1, y0 + 1, h - 1, R.ink[1]);
  }
  img.hline(0, 0, T, R.stone[4]);
  for (let x = 0; x < T; x++) if (rng.chance(0.3)) img.set(x, 1, R.stone[4]);
  img.hline(0, 15, T, R.ink[0]);
  return img;
}

export function caveHole() {
  const img = floorBase(0);
  img.ellipse(8, 8, 6.5, 5.5, R.ink[0]); img.ellipse(8, 9, 5.2, 4, R.ink[1]);
  img.hline(3, 5, 10, R.stone[4]); img.hline(4, 4, 8, R.stone[3]);
  // rungs going down
  for (const y of [7, 10, 13]) { img.hline(5, y, 6, R.wood[3]); img.hline(5, y + 1, 6, R.wood[1]); }
  img.vline(5, 6, 8, R.wood[2]); img.vline(10, 6, 8, R.wood[2]);
  return img;
}

export function caveLadderUp() {
  const img = floorBase(1);
  img.rect(4, 0, 8, 16, R.ink[2]);
  img.rect(5, 0, 6, 16, R.glow[1]);
  img.rect(6, 0, 4, 16, R.glow[3]);
  img.vline(4, 0, 16, R.wood[2]); img.vline(11, 0, 16, R.wood[2]);
  for (let y = 1; y < 16; y += 4) { img.hline(4, y, 8, R.wood[4]); img.hline(4, y + 1, 8, R.wood[1]); }
  return img;
}

// Glowing crystals for the cave walls and floor. 14 x 18.
export function caveCrystal(ramp = R.purple, seed = 1) {
  const img = new Img(16, 18);
  const rng = new Rng(seed * 31);
  const spike = (x, h, w) => {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const half = Math.max(0.5, (w / 2) * (0.25 + t * 0.75));
      for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
        if (Math.abs(dx + 0.5) > half) continue;
        const px = x + dx, py = 17 - h + y;
        img.set(px, py, dx < 0 ? ramp[4] : dx === 0 ? ramp[3] : ramp[1]);
      }
    }
    img.set(x - 1, 17 - h + 1, ramp[4]);
  };
  spike(8, 14, 5); spike(4, 9, 4); spike(12, 8, 4);
  img.rect(2, 15, 12, 2, R.stone[2]); img.hline(3, 15, 10, R.stone[3]);
  if (rng.chance(0.5)) img.set(6, 4, R.cream[3]);
  return out(img);
}

export function caveCrystalGlow(ramp = R.purple) {
  const img = new Img(16, 18);
  img.ellipse(8, 10, 5, 7, ramp[3]); img.ellipse(8, 10, 2.5, 4.5, ramp[4]);
  return img;
}

export function caveMushroom() {
  const img = new Img(16, 14);
  for (const [x, y, r] of [[5, 9, 3.4], [11, 10, 2.6], [8, 6, 2.2]]) {
    img.vline(Math.round(x), Math.round(y), 4, R.teal[4]);
    img.ellipse(x, y, r, r * 0.8, R.teal[3]); img.hline(Math.round(x - r + 1), Math.round(y - 1), Math.round(r), R.teal[4]);
    img.set(Math.round(x), Math.round(y - 1), R.cream[3]);
  }
  return out(img);
}
