// Things you craft and place: sprinkler, furnace, chest. Each has a 16 x 16 icon and a world sprite.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';

const out = (img) => img.outline((c) => outlineOf(c));

export function sprinkler() {
  const img = new Img(16, 16);
  img.rect(7, 6, 2, 8, R.ink[3]); img.vline(7, 6, 8, R.ink[4]);
  img.rect(5, 12, 6, 3, R.ink[2]); img.hline(5, 12, 6, R.ink[4]);
  img.rect(4, 3, 8, 4, R.orange[3]); img.hline(4, 3, 8, R.orange[4]); img.hline(4, 6, 8, R.orange[1]);
  img.set(3, 4, R.orange[2]); img.set(12, 4, R.orange[2]); img.set(8, 2, R.water[5]); img.set(6, 1, R.water[4]); img.set(10, 1, R.water[4]);
  return out(img);
}

export function furnaceIcon() {
  const img = new Img(16, 16);
  img.rect(2, 4, 12, 11, R.stone[3]); img.hline(2, 4, 12, R.stone[5]); img.vline(2, 4, 11, R.stone[4]); img.vline(13, 4, 11, R.stone[1]);
  for (let y = 7; y < 15; y += 4) img.hline(2, y, 12, R.stone[2]);
  img.rect(5, 8, 6, 5, R.ink[0]); img.rect(6, 10, 4, 3, R.orange[3]); img.rect(7, 11, 2, 2, R.glow[3]);
  img.rect(5, 1, 6, 4, R.stone[2]); img.hline(5, 1, 6, R.stone[4]);
  return out(img);
}

// World furnace, 24 x 30. `lit` shows the fire.
export function furnace(lit = false) {
  const img = new Img(24, 30);
  img.rect(2, 8, 20, 21, R.stone[3]); img.hline(2, 8, 20, R.stone[5]); img.vline(2, 8, 21, R.stone[4]); img.vline(21, 8, 21, R.stone[1]);
  for (let y = 14; y < 29; y += 5) img.hline(2, y, 20, R.stone[2]);
  for (let y = 11; y < 29; y += 10) for (let x = 6; x < 22; x += 7) img.vline(x, y, 3, R.stone[2]);
  img.rect(6, 15, 12, 10, R.ink[0]); img.rect(7, 16, 10, 8, R.ink[1]);
  img.rect(5, 14, 14, 1, R.stone[5]); img.hline(5, 25, 14, R.stone[2]);
  if (lit) {
    img.ellipse(12, 21, 5, 3.4, R.orange[2]); img.ellipse(12, 21, 3.4, 2.4, R.glow[2]); img.ellipse(12, 21, 1.6, 1.4, R.glow[4]);
  } else {
    img.rect(8, 22, 8, 2, R.ink[3]);
  }
  img.rect(6, 1, 12, 8, R.stone[2]); img.hline(6, 1, 12, R.stone[4]); img.rect(8, 0, 8, 2, R.ink[1]);
  return out(img);
}

export function furnaceGlow() {
  const img = new Img(24, 30);
  img.ellipse(12, 21, 5, 3.4, R.orange[3]); img.ellipse(12, 21, 3.4, 2.4, R.glow[3]); img.ellipse(12, 21, 1.6, 1.4, R.glow[4]);
  return img;
}

// World sprinkler: a short post with a nozzle, 12 x 18.
export function sprinklerWorld(spray = 0) {
  const img = new Img(16, 18);
  img.rect(7, 8, 2, 8, R.ink[3]); img.vline(7, 8, 8, R.ink[4]);
  img.rect(5, 14, 6, 3, R.ink[2]); img.hline(5, 14, 6, R.ink[4]);
  img.rect(4, 5, 8, 4, R.orange[3]); img.hline(4, 5, 8, R.orange[4]); img.hline(4, 8, 8, R.orange[1]);
  img.set(3, 6, R.orange[2]); img.set(12, 6, R.orange[2]);
  if (spray) { for (const [x, y] of [[8, 3], [5, 2], [11, 2], [3, 4], [13, 4], [6, 0], [10, 0]]) img.set(x, y, R.water[5]); }
  return out(img);
}

export function chestIcon() {
  const img = new Img(16, 16);
  img.rect(2, 6, 12, 8, R.wood[3]); img.rect(2, 3, 12, 4, R.wood[4]); img.hline(2, 3, 12, R.wood[5]); img.hline(2, 6, 12, R.wood[1]);
  img.hline(2, 13, 12, R.wood[1]); img.vline(2, 3, 11, R.wood[2]); img.vline(13, 3, 11, R.wood[1]);
  img.rect(7, 6, 2, 3, R.yellow[2]); img.set(7, 6, R.yellow[4]);
  return out(img);
}

// A chest that stands in the world, 18 x 18. Open shows the inside.
export function chestWorld(open = false) {
  const img = new Img(18, 18);
  img.rect(1, 7, 16, 10, R.wood[3]); img.hline(1, 16, 16, R.wood[1]); img.vline(1, 7, 10, R.wood[2]); img.vline(16, 7, 10, R.wood[1]);
  for (const x of [5, 12]) img.vline(x, 7, 10, R.wood[2]);
  if (open) {
    img.rect(2, 7, 14, 3, R.ink[0]);
    img.rect(1, 1, 16, 5, R.wood[4]); img.hline(1, 1, 16, R.wood[5]); img.hline(1, 5, 16, R.wood[2]);
  } else {
    img.rect(1, 3, 16, 5, R.wood[4]); img.hline(1, 3, 16, R.wood[5]); img.hline(1, 7, 16, R.wood[1]);
    img.rect(8, 6, 2, 3, R.yellow[2]); img.set(8, 6, R.yellow[4]);
  }
  return out(img);
}
