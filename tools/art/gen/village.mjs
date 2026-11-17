// The village: shops, cottages, the hall and the lantern shrine, plus the street furniture around them.
// Buildings return { day, glow } like the farmhouse. Ground line is the bottom row of the image.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';
import { drawText } from '../font.mjs';
import { roof, wall, foundation, window as win, door, chimney } from './buildings.mjs';

const outline = (img) => img.outline((c) => outlineOf(c));

// A striped cloth awning with a scalloped lip.
function awning(img, x0, y0, w, h, c1, c2) {
  for (let x = 0; x < w; x++) {
    const stripe = Math.floor(x / 4) % 2 === 0;
    const ramp = stripe ? c1 : c2;
    for (let y = 0; y < h; y++) {
      let c = ramp[3];
      if (y === 0) c = ramp[4];
      else if (y >= h - 2) c = ramp[2];
      img.set(x0 + x, y0 + y, c);
    }
    // scallops
    const m = x % 4;
    img.set(x0 + x, y0 + h, m === 1 || m === 2 ? ramp[2] : ramp[1]);
    if (m === 1 || m === 2) img.set(x0 + x, y0 + h + 1, ramp[1]);
  }
}

function signBoard(img, cx, y, text, plank = R.wood, ink = R.cream[3]) {
  const w = text.length * 5 + 8;
  const x = Math.round(cx - w / 2);
  img.rect(x, y, w, 11, plank[3]);
  img.hline(x, y, w, plank[4]); img.hline(x, y + 10, w, plank[1]);
  img.vline(x, y, 11, plank[2]); img.vline(x + w - 1, y, 11, plank[1]);
  drawText(img, x + 4, y + 1, text, ink);
  // two little chains
  img.set(x + 3, y - 1, R.ink[2]); img.set(x + w - 4, y - 1, R.ink[2]);
}

function body({ W, H, roofH, roofRamp, plaster, beam = R.wood, seed, rx = 14 }) {
  const day = new Img(W, H), glow = new Img(W, H);
  const wallTop = roofH + 10;
  const wallH = H - wallTop - 4;
  roof(day, { y0: 10, h: roofH, rx0: rx, rx1: W - 1 - rx, ex0: 1, ex1: W - 2, ramp: roofRamp, seed });
  wall(day, { x0: 5, y0: wallTop, w: W - 10, h: wallH, plaster, beam, seed });
  foundation(day, { x0: 4, y0: wallTop + wallH, w: W - 8, h: 4 });
  day.hline(1, wallTop, W - 2, roofRamp[0]); day.hline(2, wallTop + 1, W - 4, roofRamp[1]);
  return { day, glow, wallTop, wallH };
}

export function store() {
  const W = 96, H = 92;
  const b = body({ W, H, roofH: 28, roofRamp: R.blue, plaster: R.cream, seed: 11 });
  const { day, glow } = b;
  const dy = b.wallTop + 18;
  win(day, glow, { x: 12, y: dy - 2, w: 20, h: 16, box: false });
  win(day, glow, { x: 64, y: dy - 2, w: 20, h: 16, box: false });
  // goods on the sills: little crates of colour
  for (const [x, c] of [[14, R.red], [19, R.yellow], [24, R.leaf]]) { day.rect(x, dy + 12, 4, 3, c[3]); day.hline(x, dy + 12, 4, c[4]); }
  for (const [x, c] of [[66, R.orange], [71, R.pink], [76, R.purple]]) { day.rect(x, dy + 12, 4, 3, c[3]); day.hline(x, dy + 12, 4, c[4]); }
  door(day, glow, { x: 41, y: dy - 2, w: 14, h: H - dy - 2, color: R.wood, lantern: false });
  awning(day, 6, dy - 8, W - 12, 6, R.red, R.cream);
  signBoard(day, 48, 34, 'STORE');
  outline(day); glow.outline(() => null);
  return { day, glow };
}

export function cafe() {
  const W = 104, H = 92;
  const b = body({ W, H, roofH: 28, roofRamp: R.orange, plaster: R.sand, seed: 12 });
  const { day, glow } = b;
  chimney(day, { x: 78, y: 2, w: 10, h: 22 });
  const dy = b.wallTop + 18;
  win(day, glow, { x: 12, y: dy - 2, w: 20, h: 16, box: true, boxColor: R.pink });
  win(day, glow, { x: 72, y: dy - 2, w: 20, h: 16, box: true, boxColor: R.yellow });
  door(day, glow, { x: 45, y: dy - 2, w: 14, h: H - dy - 2, color: R.leaf, lantern: false });
  awning(day, 6, dy - 8, W - 12, 6, R.leaf, R.cream);
  signBoard(day, 52, 34, 'CAFE', R.wood);
  // a steaming cup painted on the sign side
  day.rect(W - 26, 36, 5, 4, R.cream[3]); day.hline(W - 26, 36, 5, R.cream[2]); day.set(W - 21, 37, R.cream[2]);
  outline(day); glow.outline(() => null);
  return { day, glow };
}

export function smithy() {
  const W = 104, H = 92;
  const b = body({ W, H, roofH: 26, roofRamp: R.purple, plaster: R.stone, beam: R.dirt, seed: 13 });
  const { day, glow } = b;
  chimney(day, { x: 18, y: 0, w: 14, h: 26 });
  const dy = b.wallTop + 16;
  // open forge window with fire
  day.rect(60, dy, 32, 22, R.ink[1]); day.rect(61, dy + 1, 30, 20, R.ink[2]);
  day.rect(64, dy + 12, 24, 9, R.stone[2]); day.hline(64, dy + 12, 24, R.stone[4]);
  day.ellipse(76, dy + 14, 8, 4, R.orange[2]); day.ellipse(76, dy + 13, 5, 3, R.glow[2]); day.ellipse(76, dy + 13, 2.4, 1.6, R.glow[4]);
  glow.ellipse(76, dy + 14, 8, 4, R.orange[3]); glow.ellipse(76, dy + 13, 5, 3, R.glow[3]); glow.ellipse(76, dy + 13, 2.4, 1.6, R.glow[4]);
  day.hline(58, dy - 1, 36, R.wood[2]); day.hline(58, dy + 22, 36, R.wood[1]);
  win(day, glow, { x: 12, y: dy, w: 16, h: 14, shutters: true });
  door(day, glow, { x: 36, y: dy - 4, w: 14, h: H - dy - 0 - 0, color: R.wood, lantern: false });
  // anvil sign
  day.rect(40, 31, 22, 11, R.wood[3]); day.hline(40, 31, 22, R.wood[4]); day.hline(40, 41, 22, R.wood[1]);
  day.rect(45, 34, 12, 2, R.ink[3]); day.rect(48, 36, 6, 2, R.ink[3]); day.rect(46, 38, 10, 1, R.ink[2]); day.set(44, 34, R.ink[3]); day.set(57, 34, R.ink[3]);
  outline(day); glow.outline(() => null);
  return { day, glow };
}

export function hall() {
  const W = 144, H = 112;
  const day = new Img(W, H), glow = new Img(W, H);
  // central gable tower
  roof(day, { y0: 6, h: 34, rx0: 52, rx1: 91, ex0: 36, ex1: 107, ramp: R.teal, seed: 5 });
  roof(day, { y0: 34, h: 28, rx0: 22, rx1: 121, ex0: 1, ex1: W - 2, ramp: R.teal, seed: 6 });
  wall(day, { x0: 36, y0: 40, w: 72, h: 22, plaster: R.cream, beam: R.wood, seed: 3 });
  const wallTop = 66, wallH = H - wallTop - 4;
  wall(day, { x0: 5, y0: wallTop, w: W - 10, h: wallH, plaster: R.cream, beam: R.wood, seed: 4 });
  foundation(day, { x0: 4, y0: wallTop + wallH, w: W - 8, h: 4 });
  day.hline(1, wallTop, W - 2, R.teal[0]); day.hline(2, wallTop + 1, W - 4, R.teal[1]);
  // a big round lantern emblem on the gable
  day.disc(72, 52, 7, R.wood[2]); day.disc(72, 52, 5.4, R.glow[2]); day.disc(72, 52, 3, R.glow[3]); day.set(71, 51, R.glow[4]);
  glow.disc(72, 52, 5.4, R.glow[3]); glow.disc(72, 52, 3, R.glow[4]);
  const dy = wallTop + 16;
  for (const x of [14, 34, 100, 120]) win(day, glow, { x, y: dy, w: 14, h: 16, box: x === 34 || x === 100, boxColor: R.blossom });
  // double door
  door(day, glow, { x: 58, y: dy - 6, w: 13, h: H - dy + 2 - 4 + 0, color: R.wood, lantern: false });
  door(day, glow, { x: 73, y: dy - 6, w: 13, h: H - dy + 2 - 4 + 0, color: R.wood, lantern: false });
  // steps
  day.rect(52, H - 6, 40, 3, R.stone[3]); day.hline(52, H - 6, 40, R.stone[4]);
  // two hanging lanterns by the door
  for (const x of [50, 94]) { day.vline(x, dy - 4, 4, R.ink[2]); day.rect(x - 2, dy, 5, 7, R.ink[1]); day.rect(x - 1, dy + 1, 3, 5, R.glow[3]); glow.rect(x - 1, dy + 1, 3, 5, R.glow[4]); }
  outline(day); glow.outline(() => null);
  return { day, glow };
}

// Small homes in a few colour schemes.
export function home(kind = 0) {
  const looks = [
    { roof: R.orange, plaster: R.cream, door: R.blue, box: R.blossom },
    { roof: R.leaf, plaster: R.sand, door: R.red, box: R.yellow },
    { roof: R.purple, plaster: R.cream, door: R.teal, box: R.pink },
  ];
  const L = looks[kind % 3];
  const W = 72, H = 76;
  const b = body({ W, H, roofH: 24, roofRamp: L.roof, plaster: L.plaster, seed: 20 + kind, rx: 12 });
  const { day, glow } = b;
  const dy = b.wallTop + 12;
  if (kind === 1) chimney(day, { x: 52, y: 4, w: 9, h: 18 });
  win(day, glow, { x: 11, y: dy, w: 13, h: 12, box: true, boxColor: L.box });
  door(day, glow, { x: 46, y: dy - 4, w: 14, h: H - dy - 0, color: L.door, lantern: kind !== 2 });
  outline(day); glow.outline(() => null);
  return { day, glow };
}

// ---------------------------------------------------------------- the shrine

// Seven lanterns on a beam between two stone posts. `lit` of them glow.
export function shrine(lit) {
  const W = 96, H = 80;
  const day = new Img(W, H), glow = new Img(W, H);
  const stone = R.stone;
  for (const x0 of [6, 78]) {
    day.rect(x0, 16, 12, 62, stone[3]);
    day.vline(x0, 16, 62, stone[4]); day.vline(x0 + 11, 16, 62, stone[1]);
    for (let y = 22; y < 76; y += 8) day.hline(x0, y, 12, stone[2]);
    day.rect(x0 - 2, 10, 16, 8, stone[4]); day.hline(x0 - 2, 10, 16, stone[5]); day.hline(x0 - 2, 17, 16, stone[2]);
    day.rect(x0 - 2, 74, 16, 5, stone[2]); day.hline(x0 - 2, 74, 16, stone[4]);
  }
  roof(day, { y0: 0, h: 12, rx0: 18, rx1: 77, ex0: 2, ex1: W - 3, ramp: R.red, seed: 8, row: 3 });
  day.rect(14, 12, 68, 5, R.wood[3]); day.hline(14, 12, 68, R.wood[4]); day.hline(14, 16, 68, R.wood[1]);
  const xs = [22, 31, 40, 48, 56, 65, 74];
  const lanterns = [];
  xs.forEach((x, i) => {
    const drop = 10 + (i % 2) * 6 + (i === 3 ? 4 : 0);
    lanterns.push({ x, y: 17 + drop + 6 });
    day.vline(x, 17, drop, R.ink[3]);
    const y = 17 + drop;
    day.rect(x - 3, y, 7, 11, R.ink[1]);
    day.hline(x - 4, y - 1, 9, R.ink[2]); day.hline(x - 2, y + 11, 5, R.ink[2]);
    if (i < lit) {
      day.rect(x - 2, y + 1, 5, 9, R.glow[2]); day.rect(x - 1, y + 2, 3, 7, R.glow[3]); day.vline(x, y + 3, 4, R.glow[4]);
      glow.rect(x - 2, y + 1, 5, 9, R.glow[3]); glow.rect(x - 1, y + 2, 3, 7, R.glow[4]);
    } else {
      day.rect(x - 2, y + 1, 5, 9, R.ink[3]); day.rect(x - 1, y + 2, 3, 7, R.ink[2]); day.set(x - 1, y + 3, R.ink[4]);
    }
  });
  outline(day); glow.outline(() => null);
  return { day, glow, xs, lanterns };
}

// ---------------------------------------------------------------- street furniture

export function fountain(frame = 0) {
  const img = new Img(40, 40);
  img.ellipse(20, 31, 19, 8.4, R.stone[2]);
  img.ellipse(20, 30, 19, 8.4, R.stone[4]);
  img.ellipse(20, 30, 15.6, 6.2, R.stone[3]);
  img.ellipse(20, 30, 14, 5.2, R.water[3]);
  img.ellipse(20, 30, 14, 5.2, null, (x, y, nx, ny) => (ny < -0.2 ? R.water[4] : undefined));
  // centre basin and spout
  img.rect(17, 14, 6, 14, R.stone[3]); img.vline(17, 14, 14, R.stone[4]); img.vline(22, 14, 14, R.stone[1]);
  img.ellipse(20, 15, 8, 3, R.stone[4]); img.ellipse(20, 15, 6, 2, R.water[3]);
  const jets = [[20, 4, 2], [18, 6, 1], [22, 6, 1]];
  for (const [x, y, h] of jets) { img.vline(x, y + (frame % 2), h + 7, R.water[5]); }
  img.set(20, 3 + (frame % 2), R.snow[4]); img.set(17, 9, R.water[4]); img.set(23, 9, R.water[4]);
  for (const x of [8, 14, 26, 32]) img.set(x + (frame % 2), 32, R.water[5]);
  outline(img);
  return img;
}

export function bench() {
  const img = new Img(28, 18);
  img.rect(2, 4, 24, 4, R.wood[4]); img.hline(2, 4, 24, R.wood[5]); img.hline(2, 7, 24, R.wood[2]);
  img.rect(2, 9, 24, 3, R.wood[3]); img.hline(2, 9, 24, R.wood[4]); img.hline(2, 11, 24, R.wood[1]);
  for (const x of [4, 22]) { img.rect(x, 12, 2, 5, R.ink[2]); img.rect(x, 3, 2, 3, R.ink[2]); }
  outline(img);
  return img;
}

export function noticeBoard() {
  const img = new Img(40, 42);
  img.rect(5, 12, 3, 28, R.wood[2]); img.rect(32, 12, 3, 28, R.wood[2]);
  img.rect(2, 3, 36, 26, R.wood[3]); img.rect(4, 5, 32, 22, R.dirt[4]);
  img.hline(2, 3, 36, R.wood[5]); img.hline(2, 28, 36, R.wood[1]);
  img.rect(0, 0, 40, 4, R.red[3]); img.hline(0, 0, 40, R.red[4]); img.hline(0, 3, 40, R.red[1]);
  const paper = (x, y, w, h, c, tilt = 0) => { img.rect(x, y, w, h, c[3]); img.hline(x, y, w, c[4]); img.hline(x + 1, y + 2, w - 3, R.ink[3]); img.hline(x + 1, y + 4, w - 4, R.ink[3]); img.set(x + w / 2 | 0, y, R.red[3]); };
  paper(7, 8, 10, 12, R.cream); paper(19, 7, 8, 9, R.yellow); paper(28, 10, 7, 13, R.cream); paper(10, 21, 12, 5, R.blossom);
  outline(img);
  return img;
}

export function stall(c1 = R.red, c2 = R.cream) {
  const img = new Img(48, 44);
  img.rect(4, 14, 3, 28, R.wood[2]); img.rect(41, 14, 3, 28, R.wood[2]);
  img.rect(4, 28, 40, 14, R.wood[3]); img.hline(4, 28, 40, R.wood[5]); img.hline(4, 41, 40, R.wood[1]);
  for (let x = 8; x < 44; x += 6) img.vline(x, 30, 11, R.wood[2]);
  awning(img, 0, 6, 48, 9, c1, c2);
  // goods on the counter
  for (const [x, c] of [[10, R.red], [16, R.yellow], [22, R.leaf], [29, R.orange], [35, R.pink]]) { img.rect(x, 24, 5, 4, c[3]); img.hline(x, 24, 5, c[4]); }
  outline(img);
  return img;
}

export function barrel() {
  const img = new Img(16, 20);
  img.ellipse(8, 10, 7, 9, R.wood[3]);
  img.ellipse(8, 10, 7, 9, null, (x, y, nx) => (nx < -0.4 ? R.wood[4] : nx > 0.5 ? R.wood[1] : undefined));
  img.hline(2, 5, 12, R.ink[3]); img.hline(2, 14, 12, R.ink[3]);
  img.ellipse(8, 3, 6, 2.4, R.wood[2]); img.ellipse(8, 3, 4.6, 1.6, R.wood[4]);
  outline(img);
  return img;
}

export function crate() {
  const img = new Img(18, 16);
  img.rect(1, 2, 16, 13, R.wood[3]); img.hline(1, 2, 16, R.wood[5]); img.hline(1, 14, 16, R.wood[1]);
  img.rect(1, 2, 3, 13, R.wood[2]); img.rect(14, 2, 3, 13, R.wood[2]);
  img.line(4, 3, 13, 13, R.wood[2]);
  outline(img);
  return img;
}

export function well() {
  const img = new Img(32, 40);
  img.ellipse(16, 32, 13, 6, R.stone[2]); img.rect(3, 22, 26, 10, R.stone[3]);
  img.ellipse(16, 22, 13, 5, R.stone[4]); img.ellipse(16, 22, 10, 3.4, R.ink[1]);
  for (let x = 4; x < 28; x += 6) img.vline(x, 23, 9, R.stone[2]);
  img.rect(4, 6, 3, 18, R.wood[2]); img.rect(25, 6, 3, 18, R.wood[2]);
  roof(img, { y0: 0, h: 9, rx0: 8, rx1: 23, ex0: 1, ex1: 30, ramp: R.red, seed: 4, row: 3 });
  img.hline(7, 12, 18, R.ink[3]); img.vline(16, 12, 7, R.cream[0]); img.rect(14, 19, 5, 3, R.wood[3]);
  outline(img);
  return img;
}

export function hayBale() {
  const img = new Img(22, 18);
  img.rect(1, 3, 20, 14, R.sand[2]);
  img.hline(1, 3, 20, R.sand[3]); img.hline(1, 16, 20, R.sand[0]);
  for (let x = 3; x < 20; x += 3) img.vline(x, 4, 12, R.sand[1]);
  img.vline(7, 3, 14, R.red[3]); img.vline(15, 3, 14, R.red[3]);
  outline(img);
  return img;
}

export function signpost(label = 'FARM', arrow = 'left') {
  const img = new Img(40, 36);
  img.rect(18, 8, 4, 27, R.wood[2]); img.vline(18, 8, 27, R.wood[3]);
  const w = Math.max(24, label.length * 5 + 10);
  const x = Math.round(20 - w / 2);
  img.rect(x, 4, w, 12, R.wood[4]); img.hline(x, 4, w, R.wood[5]); img.hline(x, 15, w, R.wood[1]);
  if (arrow === 'left') { img.poly([[x - 4, 10], [x, 5], [x, 15]], R.wood[4]); } else { img.poly([[x + w + 4, 10], [x + w - 1, 5], [x + w - 1, 15]], R.wood[4]); }
  drawText(img, x + 5, 5, label, R.ink[0]);
  outline(img);
  return img;
}

// A string of flags for festival days. Four colour schemes, one per season.
export function bunting(season = 'spring') {
  const palettes = { spring: [R.pink, R.leaf, R.yellow, R.blossom], summer: [R.orange, R.blue, R.yellow, R.red], fall: [R.orange, R.red, R.yellow, R.autumn], winter: [R.snow, R.blue, R.glow, R.teal] };
  const cols = palettes[season];
  const W = 96, H = 16;
  const img = new Img(W, H);
  const sagAt = (x) => Math.round(Math.sin((x / (W - 1)) * Math.PI) * 5);
  for (let x = 0; x < W; x++) img.set(x, 1 + sagAt(x), R.ink[3]);
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 11;
    const m = cols[i % cols.length];
    for (let y = 0; y < 7; y++) {
      const w = 7 - y;
      img.hline(x - Math.floor(w / 2), 2 + sagAt(x) + y, w, y === 0 ? m[4] : m[3]);
    }
  }
  return img;
}

export function scarecrow() {
  const img = new Img(26, 36);
  img.rect(12, 14, 3, 21, R.wood[2]); img.hline(2, 16, 22, R.wood[3]); img.hline(2, 17, 22, R.wood[2]);
  img.rect(8, 14, 10, 12, R.red[3]); img.rect(8, 14, 10, 2, R.red[4]); img.rect(8, 24, 10, 2, R.red[1]);
  img.disc(13, 9, 5, R.sand[3]); img.set(11, 8, R.ink[0]); img.set(15, 8, R.ink[0]); img.hline(11, 11, 5, R.ink[1]);
  img.ellipse(13, 4, 9, 2.4, R.wood[3]); img.ellipse(13, 2, 5, 3, R.wood[4]); img.hline(8, 4, 10, R.red[3]);
  for (const x of [2, 4, 21, 23]) img.vline(x, 17, 4, R.sand[2]);
  outline(img);
  return img;
}
