// Interiors: floors, wall pieces and furniture. Seen from the front, lit warm from inside.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';

const T = 16;
const out = (img) => img.outline((c) => outlineOf(c));

// ------------------------------------------------------------------ the dark timber around a room

const shiftRgb = (c, d) => {
  const f = (v) => Math.max(0, Math.min(255, v + d));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};

// What lies beyond a small room on a tall screen: upright boards with seams, joints, nails and a few knots, dark enough that the room is
// what the eye goes to. Tiles both ways, 32 x 64.
export function timber() {
  const W = 32, H = 64;
  const img = new Img(W, H);
  const rng = new Rng(404);
  const tones = [0x4a2b25, 0x52302a, 0x472922, 0x4e2e28];
  for (let k = 0; k < 4; k++) {
    const x0 = k * 8;
    const tone = tones[k];
    img.rect(x0, 0, 8, H, tone);
    for (let g = 0; g < 9; g++) {
      const gx = x0 + 2 + rng.int(0, 5);
      const gy = rng.int(0, H - 8);
      img.vline(gx, gy, rng.int(3, 8), shiftRgb(tone, -9));
    }
    img.vline(x0 + 1, 0, H, shiftRgb(tone, 9));
    img.vline(x0, 0, H, R.ink[0]);
    const joint = (k * 23 + 11) % H;
    img.hline(x0, joint, 8, R.ink[0]);
    img.hline(x0 + 1, (joint + 1) % H, 7, shiftRgb(tone, 7));
    for (const nx of [x0 + 2, x0 + 5]) { img.set(nx, (joint + 4) % H, R.ink[0]); img.set(nx, (joint + H - 4) % H, R.ink[0]); }
    const kx = x0 + rng.int(2, 5), ky = (joint + 24 + rng.int(0, 10)) % (H - 4);
    img.set(kx, ky, shiftRgb(tone, -16)); img.set(kx + 1, ky, shiftRgb(tone, -16)); img.set(kx, ky + 1, shiftRgb(tone, -12)); img.set(kx + 1, ky + 1, shiftRgb(tone, -16));
  }
  return img;
}

// ------------------------------------------------------------------ floors

export function floorWood(v = 0) {
  const img = new Img(T, T);
  const rng = new Rng(100 + v * 7);
  for (let r = 0; r < 2; r++) {
    const y0 = r * 8;
    const odd = (r + v) % 2 === 1;
    const base = odd ? R.wood[4] : R.wood[3];
    const seam = (rng.int(3, 12) + r * 7) % T;
    for (let y = 0; y < 8; y++) for (let x = 0; x < T; x++) {
      let c = base;
      if (y === 0) c = odd ? R.wood[5] : R.wood[4];
      if (y === 7) c = R.wood[2];
      if (x === seam && y < 7) c = R.wood[2];
      img.set(x, y0 + y, c);
    }
    // two faint grain streaks and one nail head per board
    const gx = rng.int(0, T - 6);
    img.hline(gx, y0 + 3, 5, odd ? R.wood[3] : R.wood[2]);
    img.hline((gx + 7) % (T - 4), y0 + 5, 3, odd ? R.wood[3] : R.wood[2]);
    img.set((seam + 2) % T, y0 + 2, R.wood[1]);
  }
  return img;
}

export function floorCheck(v = 0) {
  const img = new Img(T, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const sq = ((x >> 3) + (y >> 3) + v) % 2 === 1;
    let c = sq ? R.cream[1] : R.dirt[5];
    if (x % 8 === 0 || y % 8 === 0) c = sq ? R.cream[2] : R.dirt[6];
    if (x % 8 === 7 || y % 8 === 7) c = sq ? R.cream[0] : R.dirt[4];
    img.set(x, y, c);
  }
  const rng = new Rng(300 + v);
  for (let i = 0; i < 6; i++) img.set(rng.int(1, 14), rng.int(1, 14), rng.chance(0.5) ? R.cream[0] : R.dirt[4]);
  return img;
}

export function floorStone(v = 0) {
  const img = new Img(T, T);
  const rng = new Rng(500 + v * 11);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 3, off = row ? 4 : 0;
    const cx = (x + off) % 8;
    let c = R.stone[3];
    if (y % 8 === 7 || cx === 7) c = R.stone[1];
    else if (y % 8 === 0) c = R.stone[4];
    else if (cx === 0) c = R.stone[4];
    else if (rng.chance(0.14)) c = R.stone[2];
    img.set(x, y, c);
  }
  return img;
}

// ------------------------------------------------------------------ wall pieces

const PAPER = {
  cream: { base: R.cream[1], dark: R.cream[0], light: R.cream[2], dot: R.blossom[3] },
  teal: { base: R.teal[3], dark: R.teal[2], light: R.teal[4], dot: R.cream[1] },
  blossom: { base: R.blossom[4], dark: R.blossom[3], light: R.blossom[5], dot: R.cream[2] },
  stone: { base: R.stone[2], dark: R.stone[1], light: R.stone[3], dot: R.stone[4] },
};
export const WALL_THEMES = Object.keys(PAPER);

function paper(img, theme, y0, y1) {
  const p = PAPER[theme];
  for (let y = y0; y < y1; y++) for (let x = 0; x < T; x++) {
    let c = p.base;
    if (theme === 'stone') {
      const row = Math.floor(y / 4), off = (row % 2) * 4;
      if (y % 4 === 3 || (x + off) % 8 === 7) c = p.dark;
      else if (y % 4 === 0) c = p.light;
    } else {
      if (x % 8 === 0) c = p.dark;
      else if (x % 8 === 1) c = p.light;
      if (x % 8 === 4 && y % 8 === 3) c = p.dot;
    }
    img.set(x, y, c);
  }
}

function cap(img, side) {
  // outer wall top surface seen from above: timber with a lit inner edge
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(x, y, (x + y) % 7 === 0 ? R.wood[1] : R.wood[0]);
  const edge = (x, y, w, h) => { img.rect(x, y, w, h, R.wood[3]); };
  if (side.includes('R')) { edge(14, 0, 2, T); img.vline(13, 0, T, R.wood[2]); }
  if (side.includes('L')) { edge(0, 0, 2, T); img.vline(2, 0, T, R.wood[2]); }
  if (side.includes('B')) { edge(0, 0, T, 2); img.hline(0, 2, T, R.wood[2]); }
}

// theme wall rows: row 0 is the upper wall with a crown moulding, row 1 the lower wall with wainscot
export function wallRow(theme, row, capSide = '') {
  const img = new Img(T, T);
  if (row === 0) {
    paper(img, theme, 0, T);
    img.hline(0, 0, T, R.wood[2]); img.hline(0, 1, T, R.wood[4]); img.hline(0, 2, T, R.wood[3]); img.hline(0, 3, T, R.wood[1]);
    img.hline(0, 4, T, PAPER[theme].dark);
  } else {
    paper(img, theme, 0, 9);
    img.hline(0, 9, T, R.wood[5]); img.hline(0, 10, T, R.wood[3]);
    for (let y = 11; y < 15; y++) for (let x = 0; x < T; x++) img.set(x, y, x % 8 === 0 ? R.wood[1] : y === 11 ? R.wood[4] : R.wood[3]);
    img.hline(0, 15, T, R.wood[1]);
  }
  if (capSide.includes('L')) { img.rect(0, 0, 3, T, R.wood[0]); img.vline(3, 0, T, R.wood[2]); }
  if (capSide.includes('R')) { img.rect(13, 0, 3, T, R.wood[0]); img.vline(12, 0, T, R.wood[2]); }
  return img;
}

export const capL = () => { const i = new Img(T, T); cap(i, 'R'); return i; };
export const capR = () => { const i = new Img(T, T); cap(i, 'L'); return i; };
export const capB = () => { const i = new Img(T, T); cap(i, 'B'); return i; };
export const capBL = () => { const i = new Img(T, T); cap(i, 'RB'); return i; };
export const capBR = () => { const i = new Img(T, T); cap(i, 'LB'); return i; };

// soft shadows laid over the floor next to walls (transparent tiles)
function shadowTile(kind) {
  const img = new Img(T, T);
  const a = [95, 62, 36, 16];
  for (let d = 0; d < 4; d++) {
    if (kind.includes('T')) for (let x = 0; x < T; x++) img.set(x, d, R.ink[0], a[d]);
    if (kind.includes('L')) for (let y = 0; y < T; y++) img.over(d, y, R.ink[0], a[d]);
    if (kind.includes('R')) for (let y = 0; y < T; y++) img.over(T - 1 - d, y, R.ink[0], a[d]);
  }
  return img;
}
export const shadows = () => ({ L: shadowTile('L'), R: shadowTile('R'), T: shadowTile('T'), TL: shadowTile('TL'), TR: shadowTile('TR') });

// ------------------------------------------------------------------ furniture

export function bed(quilt = R.blossom) {
  const img = new Img(32, 38);
  img.rect(1, 2, 30, 34, R.wood[2]);
  img.rect(1, 2, 30, 9, R.wood[3]); img.hline(1, 2, 30, R.wood[5]); img.hline(2, 3, 28, R.wood[4]);
  img.rect(3, 12, 26, 22, R.cream[2]);
  img.rect(3, 12, 26, 22, R.cream[1]);
  // pillows
  img.roundRect(5, 12, 10, 7, 3, R.cream[3]); img.roundRect(17, 12, 10, 7, 3, R.cream[3]);
  img.hline(7, 13, 6, R.cream[3]); img.hline(19, 13, 6, R.cream[3]);
  img.hline(6, 18, 8, R.cream[0]); img.hline(18, 18, 8, R.cream[0]);
  // quilt with stitched squares
  img.rect(3, 20, 26, 14, quilt[3]);
  img.hline(3, 20, 26, quilt[4]); img.hline(3, 21, 26, quilt[3]);
  for (let y = 22; y < 33; y += 4) for (let x = 5; x < 28; x += 4) { img.set(x, y, quilt[4]); img.set(x + 1, y + 1, quilt[2]); }
  img.hline(3, 33, 26, quilt[1]);
  // footboard and posts
  img.rect(1, 33, 30, 4, R.wood[3]); img.hline(1, 33, 30, R.wood[5]); img.hline(1, 36, 30, R.wood[1]);
  img.rect(1, 0, 3, 5, R.wood[4]); img.rect(28, 0, 3, 5, R.wood[4]);
  img.set(2, 0, R.yellow[3]); img.set(29, 0, R.yellow[3]);
  return out(img);
}

export function table(w = 32, flowers = true) {
  const img = new Img(w, 26);
  img.rect(2, 12, 3, 12, R.wood[1]); img.rect(w - 5, 12, 3, 12, R.wood[1]);
  img.rect(0, 6, w, 7, R.wood[3]);
  img.rect(0, 4, w, 4, R.wood[5]); img.hline(0, 4, w, R.wood[6]);
  img.hline(0, 8, w, R.wood[4]);
  img.hline(0, 12, w, R.wood[1]);
  img.rect(1, 13, w - 2, 2, R.ink[0]);
  if (flowers) {
    img.rect(w / 2 - 2, 1, 4, 4, R.water[3]); img.hline(w / 2 - 2, 1, 4, R.water[5]);
    img.set(w / 2 - 3, -1 + 1, R.blossom[4]); img.set(w / 2, 0, R.yellow[3]); img.set(w / 2 + 2, 0, R.blossom[3]);
  }
  return out(img.pad(1, 1, 1, 0));
}

export function chair(color = R.wood) {
  const img = new Img(14, 22);
  img.rect(2, 0, 10, 12, color[3]); img.hline(2, 0, 10, color[5]); img.rect(3, 2, 8, 8, color[2]);
  img.vline(2, 0, 12, color[4]);
  img.rect(1, 12, 12, 4, color[4]); img.hline(1, 12, 12, color[5]); img.hline(1, 15, 12, color[1]);
  img.rect(2, 16, 2, 6, color[1]); img.rect(10, 16, 2, 6, color[1]);
  return out(img);
}

export function stove() {
  const img = new Img(32, 40);
  const g = new Img(32, 40);
  img.rect(11, 0, 4, 12, R.stone[1]); img.vline(11, 0, 12, R.stone[3]); img.rect(10, 0, 6, 2, R.stone[2]);
  img.rect(2, 10, 28, 28, R.stone[1]);
  img.rect(2, 10, 28, 5, R.stone[2]); img.hline(2, 10, 28, R.stone[4]);
  img.rect(3, 15, 26, 22, R.ink[2]);
  img.hline(3, 15, 26, R.ink[3]);
  // door with glass
  img.rect(7, 19, 18, 14, R.ink[1]); img.frame(7, 19, 18, 14, R.stone[3]);
  img.rect(9, 21, 14, 10, R.orange[0]);
  g.rect(9, 21, 14, 10, R.glow[2]); g.rect(11, 23, 10, 6, R.glow[3]); g.rect(14, 24, 4, 4, R.glow[4]);
  img.set(15, 33, R.yellow[3]); img.hline(10, 34, 12, R.stone[4]);
  // knobs
  for (const x of [6, 12, 20, 26]) img.set(x, 17, R.yellow[2]);
  // pot on top
  img.rect(14, 5, 12, 6, R.ink[3]); img.hline(14, 5, 12, R.stone[4]); img.rect(26, 7, 2, 2, R.ink[3]);
  img.rect(3, 38, 4, 2, R.ink[0]); img.rect(25, 38, 4, 2, R.ink[0]);
  out(img);
  g.outline(() => null);
  return { day: img, glow: g };
}

export function counter() {
  const img = new Img(32, 30);
  img.rect(0, 4, 32, 5, R.stone[5]); img.hline(0, 4, 32, R.stone[6]); img.hline(0, 8, 32, R.stone[3]);
  img.rect(1, 9, 30, 20, R.wood[3]); img.hline(1, 9, 30, R.wood[1]);
  img.vline(16, 10, 18, R.wood[1]);
  for (const x of [3, 18]) { img.rect(x, 11, 12, 15, R.wood[2]); img.frame(x, 11, 12, 15, R.wood[4]); img.set(x + 9, 17, R.yellow[3]); }
  img.hline(1, 28, 30, R.wood[0]);
  // sink and tap
  img.rect(4, 4, 10, 3, R.water[2]); img.hline(4, 4, 10, R.water[4]);
  img.rect(14, 0, 2, 6, R.stone[4]); img.hline(11, 0, 5, R.stone[4]); img.set(11, 1, R.stone[4]);
  // a loaf and a jar
  img.rect(21, 1, 8, 4, R.orange[3]); img.hline(21, 1, 8, R.orange[4]);
  img.rect(19, 2, 2, 3, R.purple[3]);
  return out(img);
}

export function bookshelf() {
  const img = new Img(32, 42);
  img.rect(0, 0, 32, 42, R.wood[1]);
  img.rect(1, 1, 30, 40, R.wood[2]);
  img.hline(0, 0, 32, R.wood[4]);
  const rng = new Rng(77);
  const cols = [R.red[3], R.teal[3], R.leaf[4], R.yellow[3], R.purple[3], R.blossom[4], R.orange[3], R.water[4]];
  for (let s = 0; s < 3; s++) {
    const y = 4 + s * 13;
    img.rect(2, y, 28, 10, R.wood[0]);
    let x = 3;
    while (x < 28) {
      const w = rng.int(2, 4), h = rng.int(6, 9);
      const c = rng.pick(cols);
      img.rect(x, y + 10 - h, w, h, c); img.vline(x, y + 10 - h, h, R.cream[2]); img.hline(x, y + 10 - h, w, R.cream[2]);
      x += w + (rng.chance(0.15) ? 2 : 0);
      if (rng.chance(0.08)) x += 3;
    }
    img.hline(1, y + 10, 30, R.wood[4]); img.hline(1, y + 11, 30, R.wood[0]);
  }
  return out(img);
}

export function chest(open = false) {
  const img = new Img(18, open ? 20 : 17);
  const y0 = open ? 5 : 0;
  img.rect(1, y0 + 6, 16, 10, R.wood[3]); img.hline(1, y0 + 6, 16, R.wood[5]);
  img.hline(1, y0 + 15, 16, R.wood[1]);
  img.rect(1, y0 + 8, 16, 2, R.ink[3]); img.rect(1, y0 + 12, 16, 1, R.wood[2]);
  if (open) {
    img.rect(1, 0, 16, 6, R.wood[2]); img.hline(1, 0, 16, R.wood[4]); img.rect(2, 1, 14, 3, R.wood[1]);
    img.rect(3, y0 + 2, 12, 5, R.yellow[2]); img.hline(3, y0 + 2, 12, R.yellow[4]);
  } else {
    img.rect(1, 1, 16, 6, R.wood[4]); img.hline(1, 1, 16, R.wood[6]); img.hline(1, 6, 16, R.wood[2]);
    img.rect(1, 3, 16, 1, R.ink[3]);
  }
  img.rect(8, y0 + 8, 3, 4, R.yellow[3]); img.set(9, y0 + 10, R.ink[1]);
  img.rect(1, y0 + 6, 2, 10, R.ink[3]); img.rect(15, y0 + 6, 2, 10, R.ink[3]);
  return out(img);
}

export function rug(w = 48, h = 32, c = R.red, trim = R.cream) {
  const img = new Img(w, h);
  img.roundRect(0, 0, w, h, 3, c[1]);
  img.roundRect(1, 1, w - 2, h - 2, 3, trim[2]);
  img.roundRect(3, 3, w - 6, h - 6, 2, c[3]);
  img.roundRect(5, 5, w - 10, h - 10, 2, c[2]);
  // diamond pattern in the middle
  const cx = w / 2, cy = h / 2;
  for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) {
    const d = Math.abs(x + 0.5 - cx) / 6 + Math.abs(y + 0.5 - cy) / 4;
    if (d < 1 && (Math.round(d * 4) % 2 === 0)) img.set(x, y, trim[1]);
    else if (d < 1.2 && d >= 1) img.set(x, y, c[4]);
  }
  for (let x = 4; x < w - 4; x += 3) { img.set(x, 1, c[3]); img.set(x, h - 2, c[3]); }
  return img;
}

export function windowPiece(night = false) {
  const img = new Img(22, 28);
  img.rect(0, 0, 22, 28, R.wood[1]);
  img.rect(1, 1, 20, 26, R.wood[3]); img.hline(1, 1, 20, R.wood[5]);
  for (let y = 0; y < 22; y++) {
    const c = night ? (y < 8 ? R.teal[0] : R.teal[1]) : (y < 6 ? R.water[4] : y < 14 ? R.water[5] : R.sand[3]);
    img.hline(3, 3 + y, 16, c);
  }
  if (night) {
    for (const [x, y] of [[6, 5], [14, 8], [10, 4], [16, 14], [5, 13]]) img.set(x, y, R.cream[3]);
    img.disc(15, 7, 2.6, R.cream[3]); img.disc(16, 6.4, 2.2, R.teal[1]);
  } else {
    img.disc(7, 7, 2.5, R.yellow[4]); img.line(10, 10, 16, 20, R.cream[3]);
    img.hline(4, 18, 6, R.leaf[4]); img.hline(11, 17, 7, R.leaf[3]); img.hline(5, 19, 12, R.leaf[2]);
  }
  img.vline(11, 3, 22, R.wood[3]); img.hline(3, 13, 16, R.wood[3]);
  img.rect(0, 25, 22, 3, R.wood[4]); img.hline(0, 25, 22, R.wood[5]); img.hline(0, 27, 22, R.wood[1]);
  return out(img);
}

export function plant(kind = 0) {
  const img = new Img(16, 26);
  const leaf = kind === 1 ? R.teal : R.leaf;
  img.rect(4, 17, 8, 8, R.orange[2]); img.hline(3, 16, 10, R.orange[3]); img.hline(4, 24, 8, R.orange[0]);
  img.rect(5, 18, 2, 6, R.orange[3]);
  for (const [x, y, w] of [[2, 4, 6], [7, 2, 7], [3, 9, 5], [8, 8, 6], [5, 0, 5]]) {
    img.roundRect(x, y, w, 5, 2, leaf[3]); img.hline(x + 1, y, w - 2, leaf[5]); img.hline(x + 1, y + 4, w - 2, leaf[2]);
  }
  img.vline(8, 10, 8, leaf[2]);
  if (kind === 2) for (const [x, y] of [[4, 5], [10, 3], [8, 10]]) { img.set(x, y, R.blossom[4]); img.set(x + 1, y, R.blossom[3]); }
  return out(img);
}

export function picture(kind = 0) {
  const img = new Img(16, 18);
  img.rect(0, 0, 16, 18, R.wood[1]); img.rect(1, 1, 14, 16, R.wood[4]);
  img.rect(2, 2, 12, 14, R.cream[1]);
  if (kind === 0) {           // a hill and a sun
    img.rect(3, 3, 10, 12, R.water[5]); img.disc(10, 6, 1.8, R.yellow[3]);
    img.ellipse(6, 15, 7, 5, R.leaf[3]); img.ellipse(12, 15, 5, 4, R.leaf[4]);
  } else if (kind === 1) {    // a lantern in the dark
    img.rect(3, 3, 10, 12, R.teal[1]); img.rect(7, 6, 2, 5, R.glow[3]); img.disc(8, 8.5, 3.6, R.glow[1]); img.rect(7, 6, 2, 5, R.glow[4]);
  } else {                    // a bowl of fruit
    img.rect(3, 3, 10, 12, R.blossom[5]); img.ellipse(8, 12, 4.5, 2.5, R.wood[3]);
    img.disc(6, 10, 2, R.red[3]); img.disc(10, 10, 2, R.yellow[3]); img.disc(8, 9, 2, R.leaf[4]);
  }
  return out(img);
}

export function doorMat() {
  const img = new Img(20, 9);
  img.roundRect(0, 0, 20, 9, 2, R.wood[1]);
  img.roundRect(1, 1, 18, 7, 2, R.cream[1]);
  for (let x = 3; x < 17; x += 2) img.vline(x, 3, 3, R.cream[0]);
  img.hline(3, 2, 14, R.red[3]); img.hline(3, 6, 14, R.red[3]);
  return img;
}

export function fireplace() {
  const day = new Img(40, 44), glow = new Img(40, 44);
  day.rect(2, 4, 36, 40, R.stone[3]);
  for (let y = 4; y < 44; y += 5) for (let x = 2 + ((y / 5) % 2) * 4; x < 38; x += 8) { day.vline(x, y, 5, R.stone[1]); }
  for (let y = 4; y < 44; y += 5) day.hline(2, y, 36, R.stone[1]);
  day.rect(0, 0, 40, 6, R.stone[4]); day.hline(0, 0, 40, R.stone[6]); day.hline(0, 5, 40, R.stone[2]);
  day.rect(8, 16, 24, 28, R.ink[1]); day.rect(10, 18, 20, 26, R.ink[0]);
  day.roundRect(9, 15, 22, 8, 4, R.ink[1]);
  day.rect(12, 38, 16, 3, R.wood[1]); day.rect(14, 36, 12, 3, R.wood[2]);
  // a fire is tongues, not an egg: a tall one in the middle and two shorter ones leaning in, each a layer hotter than the one around it
  const tongue = (cx, top, bottom, maxW, c) => {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const w = Math.max(1, Math.round(maxW * Math.pow(t, 0.75)));
      glow.hline(cx - Math.floor(w / 2) + (y < top + 4 ? (cx < 20 ? 1 : cx > 20 ? -1 : 0) : 0), y, w, c);
    }
  };
  tongue(20, 19, 38, 12, R.glow[1]); tongue(14, 27, 38, 6, R.glow[1]); tongue(26, 25, 38, 7, R.glow[1]);
  tongue(20, 23, 38, 9, R.glow[2]); tongue(26, 29, 38, 4, R.glow[2]); tongue(14, 31, 38, 3, R.glow[2]);
  tongue(20, 28, 38, 6, R.glow[3]);
  tongue(20, 33, 38, 3, R.glow[4]);
  glow.set(17, 22, R.glow[2]); glow.set(24, 21, R.glow[2]);
  out(day);
  return { day, glow };
}

export function hangLamp() {
  const day = new Img(10, 18), glow = new Img(10, 18);
  day.vline(5, 0, 5, R.ink[1]);
  day.rect(3, 5, 4, 2, R.ink[2]); day.rect(2, 7, 6, 7, R.ink[1]); day.rect(3, 8, 4, 5, R.glow[2]);
  day.rect(3, 14, 4, 2, R.ink[2]);
  glow.rect(3, 8, 4, 5, R.glow[3]); glow.rect(4, 9, 2, 3, R.glow[4]);
  out(day);
  return { day, glow };
}
