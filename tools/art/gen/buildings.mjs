// Buildings: front-facing cottages with shingle roofs. Every building returns { day, glow }:
// `day` is the sprite, `glow` holds only the warm lit windows/doorway so the game can add it at night.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';

// Shingled trapezoid roof. Ridge spans [rx0, rx1] at y0, eaves span [ex0, ex1] at y0 + h.
export function roof(img, { y0, h, rx0, rx1, ex0, ex1, ramp, seed = 1, row = 4 }) {
  const rng = new Rng(seed);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const xl = Math.round(rx0 + (ex0 - rx0) * t), xr = Math.round(rx1 + (ex1 - rx1) * t);
    const r = Math.floor(y / row), ry = y % row;
    const offs = (r % 2) * 3;
    for (let x = xl; x <= xr; x++) {
      const sx = (x - xl + offs) % 6;
      let col = ramp[3];
      if (ry === row - 1) col = ramp[1];                  // shadow under each course
      else if (ry === 0) col = ramp[4];                   // lit upper edge
      else if (ry === 1) col = ramp[3];
      else col = ramp[2];
      if (sx === 5) col = ramp[1];                        // gap between shingles
      if (sx === 0 && ry < row - 1) col = ramp[4];
      if (rng.next() < 0.04 && ry > 0 && ry < row - 1) col = ramp[5] ?? ramp[4]; // glints
      img.set(x, y0 + y, col);
    }
    // eave edge
    img.set(xl, y0 + y, ramp[1]); img.set(xr, y0 + y, ramp[1]);
  }
  // ridge cap
  for (let x = rx0; x <= rx1; x++) { img.set(x, y0, ramp[5] ?? ramp[4]); img.set(x, y0 + 1, ramp[4]); }
  // eave shadow line
  for (let x = ex0; x <= ex1; x++) img.set(x, y0 + h - 1, ramp[0]);
}

// Plaster wall with timber frame.
export function wall(img, { x0, y0, w, h, plaster = R.cream, beam = R.wood, seed = 1, timber = true }) {
  const rng = new Rng(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = plaster[2];
    if (rng.next() < 0.05) c = plaster[1];
    if (y < 3) c = plaster[0];          // shadow beneath the eaves
    else if (y < 4) c = plaster[1];
    img.set(x0 + x, y0 + y, c);
  }
  if (!timber) return;
  const post = (x) => { for (let y = 0; y < h; y++) { img.set(x, y0 + y, beam[3]); img.set(x + 1, y0 + y, beam[2]); } };
  post(x0); post(x0 + w - 2);
  for (let x = 0; x < w; x++) { img.set(x0 + x, y0 + 3, beam[2]); img.set(x0 + x, y0 + 4, beam[1]); }
}

export function foundation(img, { x0, y0, w, h = 4 }) {
  const rng = new Rng(7);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const brick = ((x + (y % 2 ? 4 : 0)) % 8) === 0 || y === 0;
    img.set(x0 + x, y0 + y, brick ? R.stone[1] : rng.next() < 0.2 ? R.stone[4] : R.stone[3]);
  }
}

// A 14 x 16-ish window with frame, mullions and optional flower box.
export function window(img, glow, { x, y, w = 14, h = 14, box = false, boxColor = R.blossom, shutters = false }) {
  const f = R.wood;
  img.rect(x - 1, y - 1, w + 2, h + 2, f[1]);
  img.rect(x, y, w, h, f[3]);
  img.rect(x + 1, y + 1, w - 2, h - 2, R.water[2]);
  // glass sky reflection
  for (let i = 0; i < h - 2; i++) img.hline(x + 1, y + 1 + i, w - 2, i < 3 ? R.water[4] : i < h / 2 ? R.water[3] : R.water[2]);
  img.line(x + 2, y + h - 3, x + 5, y + 2, R.water[5]);
  // mullions
  img.vline(x + Math.floor(w / 2), y, h, f[2]); img.hline(x, y + Math.floor(h / 2), w, f[2]);
  img.hline(x - 1, y + h + 1, w + 2, f[4]);              // sill highlight
  img.hline(x - 1, y + h + 2, w + 2, f[1]);
  if (shutters) {
    img.rect(x - 5, y - 1, 4, h + 2, R.teal[2]); img.rect(x + w + 1, y - 1, 4, h + 2, R.teal[2]);
    for (let i = 2; i < h; i += 3) { img.hline(x - 5, y + i, 4, R.teal[1]); img.hline(x + w + 1, y + i, 4, R.teal[1]); }
  }
  if (box) {
    img.rect(x - 2, y + h + 2, w + 4, 4, f[2]); img.hline(x - 2, y + h + 2, w + 4, f[4]); img.hline(x - 2, y + h + 5, w + 4, f[0]);
    for (let i = 0; i < w + 2; i += 2) {
      img.set(x - 1 + i, y + h + 1, R.leaf[3]); img.set(x - 1 + i, y + h, boxColor[(i >> 1) % 2 ? 3 : 4]);
    }
  }
  // lit version: panes become a warm glow (cross frame kept dark)
  glow.rect(x + 1, y + 1, w - 2, h - 2, R.glow[2]);
  for (let i = 0; i < h - 2; i++) glow.hline(x + 1, y + 1 + i, w - 2, i < 2 ? R.glow[3] : R.glow[2]);
  glow.vline(x + Math.floor(w / 2), y, h, R.wood[2]); glow.hline(x, y + Math.floor(h / 2), w, R.wood[2]);
}

export function door(img, glow, { x, y, w = 14, h = 24, color = R.wood, lantern = true, knob = true }) {
  img.rect(x - 1, y - 1, w + 2, h + 1, color[0]);
  img.rect(x, y, w, h, color[3]);
  for (let i = 0; i < w; i += 3) img.vline(x + i, y, h, color[2]);
  img.vline(x, y, h, color[4]);
  // arch top
  img.hline(x, y, 2, color[0]); img.hline(x + w - 2, y, 2, color[0]);
  // planks and iron strap
  img.hline(x + 1, y + 6, w - 2, color[1]); img.hline(x + 1, y + h - 7, w - 2, color[1]);
  if (knob) { img.set(x + w - 4, y + 13, R.yellow[3]); img.set(x + w - 4, y + 14, R.yellow[1]); }
  // little round window
  img.disc(x + w / 2, y + 6, 2.2, R.water[3]);
  glow.disc(x + w / 2, y + 6, 2.2, R.glow[3]);
  // stone step
  img.rect(x - 3, y + h, w + 6, 3, R.stone[3]); img.hline(x - 3, y + h, w + 6, R.stone[4]); img.hline(x - 3, y + h + 2, w + 6, R.stone[1]);
  if (lantern) {
    img.rect(x + w + 3, y + 3, 4, 6, R.ink[1]);
    img.rect(x + w + 4, y + 4, 2, 4, R.glow[3]);
    img.set(x + w + 4, y - 1, R.ink[1]); img.set(x + w + 5, y - 1, R.ink[1]); img.vline(x + w + 5, y - 3, 3, R.ink[2]);
    glow.rect(x + w + 4, y + 4, 2, 4, R.glow[4]);
  }
}

export function chimney(img, { x, y, w = 10, h = 22 }) {
  const rng = new Rng(3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const brick = (j % 4 === 0) || ((i + (Math.floor(j / 4) % 2) * 3) % 6 === 0);
    img.set(x + i, y + j, brick ? R.stone[1] : (i < 3 ? R.stone[4] : i > w - 3 ? R.stone[2] : R.stone[3]));
  }
  img.rect(x - 1, y - 2, w + 2, 3, R.stone[2]); img.hline(x - 1, y - 2, w + 2, R.stone[4]);
  img.rect(x + 2, y - 1, w - 4, 1, R.ink[1]);
}

// The cosy farmhouse. 96 x 88; ground line at y = 85.
export function farmhouse() {
  const day = new Img(96, 88), glow = new Img(96, 88);
  chimney(day, { x: 66, y: 4, w: 10, h: 26 });
  roof(day, { y0: 14, h: 34, rx0: 16, rx1: 80, ex0: 1, ex1: 94, ramp: R.red, seed: 2 });
  wall(day, { x0: 5, y0: 48, w: 86, h: 33, plaster: R.cream, beam: R.wood });
  foundation(day, { x0: 4, y0: 81, w: 88, h: 4 });
  window(day, glow, { x: 14, y: 56, w: 15, h: 13, box: true, boxColor: R.blossom });
  window(day, glow, { x: 67, y: 56, w: 15, h: 13, box: true, boxColor: R.yellow });
  door(day, glow, { x: 41, y: 56, w: 14, h: 25, color: R.teal });
  // eave overhang shadow cast on the wall and a roof-edge trim
  day.hline(1, 48, 94, R.red[0]); day.hline(2, 49, 92, R.red[1]);
  // moss and a climbing vine on the left corner
  const rng = new Rng(9);
  for (let i = 0; i < 26; i++) { day.set(6 + rng.int(0, 5), 52 + rng.int(0, 28), R.leaf[rng.int(2, 4)]); }
  day.outline((c) => outlineOf(c));
  glow.outline(() => null);
  return { day, glow };
}

// Shipping bin: a wooden crate with a hinged lid, 24 x 24.
export function shippingBin() {
  const day = new Img(24, 24);
  day.rect(1, 9, 22, 13, R.wood[3]);
  for (let x = 1; x < 23; x += 4) day.vline(x, 9, 13, R.wood[2]);
  day.hline(1, 21, 22, R.wood[1]); day.hline(1, 9, 22, R.wood[4]);
  // lid
  day.rect(0, 5, 24, 6, R.wood[4]); day.hline(0, 5, 24, R.wood[5]); day.hline(0, 10, 24, R.wood[2]);
  day.rect(10, 13, 4, 2, R.yellow[2]); day.set(10, 13, R.yellow[4]);
  day.outline((c) => outlineOf(c));
  const open = new Img(24, 24);
  open.rect(1, 9, 22, 13, R.wood[3]);
  for (let x = 1; x < 23; x += 4) open.vline(x, 9, 13, R.wood[2]);
  open.hline(1, 21, 22, R.wood[1]); open.hline(1, 9, 22, R.wood[4]);
  open.rect(3, 9, 18, 3, R.ink[1]);                    // dark inside
  open.rect(0, 1, 24, 5, R.wood[4]); open.hline(0, 1, 24, R.wood[5]); open.hline(0, 5, 24, R.wood[2]);
  open.rect(10, 8, 4, 1, R.yellow[2]);
  open.outline((c) => outlineOf(c));
  return { closed: day, open };
}

// Little mailbox / signpost etc. live with props; here is a lantern post, 8 x 28.
export function lanternPost() {
  const day = new Img(12, 30), glow = new Img(12, 30);
  day.rect(5, 8, 2, 21, R.ink[2]); day.vline(5, 8, 21, R.ink[3]);
  day.rect(3, 27, 6, 3, R.stone[2]); day.hline(3, 27, 6, R.stone[4]);
  day.rect(2, 2, 8, 8, R.ink[1]);
  day.rect(3, 3, 6, 6, R.glow[2]); day.rect(4, 4, 4, 4, R.glow[3]); day.set(5, 5, R.glow[4]);
  day.hline(1, 1, 10, R.ink[2]); day.hline(4, 0, 4, R.ink[2]);
  day.outline((c) => outlineOf(c));
  glow.rect(3, 3, 6, 6, R.glow[3]); glow.rect(4, 4, 4, 4, R.glow[4]);
  return { day, glow };
}

// Wooden sign, 16 x 20.
export function sign(color = R.wood) {
  const img = new Img(16, 22);
  img.rect(7, 10, 2, 11, color[1]); img.vline(7, 10, 11, color[2]);
  img.rect(1, 2, 14, 9, color[3]); img.hline(1, 2, 14, color[4]); img.hline(1, 10, 14, color[1]);
  img.hline(3, 5, 10, color[1]); img.hline(3, 7, 7, color[1]);
  img.outline((c) => outlineOf(c));
  return img;
}
