// 16 x 16 item icons: tools, seed packets, produce and resources.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { drawTool } from './characters.mjs';

const out = (img) => img.outline((c) => outlineOf(c));
const ball = (img, cx, cy, rx, ry, ramp) => img.shaded(cx, cy, rx, ry, ramp, { light: [-0.55, -0.8] });
const spark = (img, x, y, c = R.cream[3]) => { img.set(x, y, c); };

export function toolIcon(tool, tier = 'basic') {
  const img = new Img(16, 16);
  if (tool === 'can') drawTool(img, 'can', 3, 9, 0, tier);
  else if (tool === 'rod') {
    img.line(2, 14, 13, 2, R.wood[3]); img.line(3, 14, 14, 2, R.wood[2]);
    img.line(13, 2, 14, 7, R.cream[0]); img.vline(14, 7, 3, R.cream[0]);
    img.set(14, 10, R.red[3]); img.set(14, 11, R.cream[3]);
    img.rect(3, 11, 2, 2, R.stone[3]);
  } else drawTool(img, tool, 3, 13, -50, tier);
  return out(img);
}

// Seed packet: little paper envelope with a coloured label and a sprout.
export function seedPacket(label) {
  const img = new Img(16, 16);
  img.rect(3, 3, 10, 12, R.cream[2]);
  img.hline(3, 3, 10, R.cream[3]); img.vline(3, 3, 12, R.cream[3]); img.vline(12, 3, 12, R.cream[0]);
  img.hline(3, 14, 10, R.cream[0]);
  img.rect(3, 2, 10, 3, R.dirt[3]); img.hline(3, 2, 10, R.dirt[4]); img.hline(4, 4, 8, R.dirt[2]);
  img.rect(4, 6, 8, 6, label[3]); img.hline(4, 6, 8, label[4]); img.hline(4, 11, 8, label[1]);
  // sprout in the label
  img.set(8, 10, R.leaf[4]); img.set(8, 9, R.leaf[4]); img.set(7, 8, R.leaf[5]); img.set(9, 8, R.leaf[5]);
  return out(img);
}

function produce(crop) {
  const img = new Img(16, 16);
  const a = crop.art;
  const leafTuft = (x, y, n = 3) => {
    for (let i = 0; i < n; i++) {
      img.line(x, y, x - 2 + i * 2, y - 4 - (i === 1 ? 1 : 0), R.leaf[i === 1 ? 4 : 3]);
    }
  };
  switch (crop.id) {
    case 'radish': ball(img, 8, 10, 4.2, 4, R.pink); img.vline(8, 13, 3, R.cream[3]); leafTuft(8, 6); spark(img, 6, 8); break;
    case 'potato': ball(img, 8, 9, 5.4, 4, R.wood); img.set(6, 8, R.wood[1]); img.set(10, 10, R.wood[2]); img.set(8, 11, R.wood[1]); img.set(5, 10, R.wood[5]); break;
    case 'yam': img.ellipse(8, 9, 6, 3.2, R.orange[3]); img.ellipse(8, 9, 6, 3.2, null, (x, y, nx, ny) => (ny < -0.3 ? R.orange[4] : ny > 0.4 ? R.orange[2] : undefined)); img.set(3, 8, R.orange[1]); img.set(13, 10, R.orange[1]); break;
    case 'cauliflower': leafTuft(8, 9, 3); img.rect(2, 8, 12, 3, R.leaf[3]); ball(img, 8, 8, 5.4, 4.6, R.cream); img.set(6, 6, R.cream[3]); img.set(10, 8, R.cream[0]); break;
    case 'strawberry': ball(img, 8, 9, 4.2, 4.6, R.red); for (const [x, y] of [[6, 8], [9, 7], [8, 11], [10, 10], [6, 11]]) img.set(x, y, R.yellow[4]); img.hline(5, 4, 6, R.leaf[3]); img.set(8, 3, R.leaf[4]); img.set(6, 5, R.leaf[4]); img.set(10, 5, R.leaf[4]); break;
    case 'tomato': ball(img, 8, 9, 5, 4.4, R.red); img.hline(5, 5, 6, R.leaf[3]); img.set(8, 4, R.leaf[5]); img.set(6, 6, R.leaf[4]); img.set(10, 6, R.leaf[4]); spark(img, 6, 8); break;
    case 'blueberry': for (const [x, y] of [[6, 10], [10, 10], [8, 6]]) { ball(img, x, y, 3, 3, R.blue); img.set(x, y - 1, R.ink[1]); } spark(img, 5, 9); spark(img, 9, 9); spark(img, 7, 5); break;
    case 'pepper': img.ellipse(8, 9, 2.8, 5.4, R.orange[3]); img.ellipse(8, 9, 2.8, 5.4, null, (x, y, nx) => (nx < -0.3 ? R.orange[4] : nx > 0.4 ? R.orange[1] : undefined)); img.set(8, 14, R.orange[1]); img.rect(7, 3, 3, 2, R.leaf[3]); img.set(8, 2, R.leaf[4]); break;
    case 'eggplant': img.ellipse(8, 9, 3.6, 5.6, R.purple[3]); img.ellipse(8, 9, 3.6, 5.6, null, (x, y, nx) => (nx < -0.3 ? R.purple[4] : nx > 0.4 ? R.purple[1] : undefined)); img.hline(5, 4, 6, R.leaf[3]); img.set(8, 3, R.leaf[4]); img.set(7, 2, R.leaf[4]); spark(img, 6, 8); break;
    case 'cranberry': for (const [x, y] of [[6, 10], [10, 9], [8, 6]]) { ball(img, x, y, 2.8, 2.8, R.red); img.set(x - 1, y - 1, R.cream[2]); } img.set(8, 3, R.leaf[4]); break;
    case 'melon': img.ellipse(8, 9, 6.2, 5.2, R.grassSummer[3]); img.ellipse(8, 9, 6.2, 5.2, null, (x, y, nx, ny) => (ny < -0.4 ? R.grassSummer[4] : ny > 0.5 ? R.grassSummer[1] : undefined)); for (const x of [5, 8, 11]) img.vline(x, 5, 9, R.grassSummer[1]); spark(img, 5, 6); img.set(8, 3, R.leaf[3]); img.set(8, 4, R.leaf[2]); break;
    case 'pumpkin': ball(img, 8, 10, 6.4, 5, R.orange); for (const x of [5, 8, 11]) img.vline(x, 6, 9, R.orange[1]); img.rect(7, 3, 2, 3, R.leaf[3]); img.set(9, 3, R.leaf[4]); spark(img, 5, 7, R.orange[4]); break;
    case 'corn': img.ellipse(8, 9, 2.8, 5.4, R.yellow[3]); for (const [x, y] of [[7, 6], [9, 7], [7, 9], [9, 10], [7, 12]]) img.set(x, y, R.yellow[4]); img.line(4, 14, 8, 6, R.leaf[3]); img.line(12, 14, 8, 6, R.leaf[2]); img.line(5, 14, 8, 8, R.leaf[4]); break;
    case 'wheat': for (const dx of [-3, 0, 3]) { img.vline(8 + dx, 7, 8, R.sand[0]); for (let k = 0; k < 4; k++) { img.set(8 + dx - 1 + (k % 2) * 2, 3 + k * 1.2, R.sand[2]); img.set(8 + dx, 3 + k * 1.2, R.sand[3]); } } img.hline(4, 12, 9, R.red[3]); break;
    case 'tulip': img.vline(8, 8, 7, R.leaf[3]); img.line(8, 12, 5, 9, R.leaf[4]); img.ellipse(8, 6, 3, 3.6, R.pink[3]); img.set(8, 2, R.pink[3]); img.set(6, 3, R.pink[4]); img.set(10, 3, R.pink[3]); img.hline(7, 8, 3, R.pink[1]); break;
    case 'sunflower': img.vline(8, 9, 6, R.leaf[3]); for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2; img.set(Math.round(8 + Math.cos(t) * 5), Math.round(6 + Math.sin(t) * 5), R.yellow[k % 2 ? 3 : 4]); img.set(Math.round(8 + Math.cos(t) * 4), Math.round(6 + Math.sin(t) * 4), R.yellow[k % 2 ? 3 : 2]); } ball(img, 8, 6, 3, 3, R.wood); break;
    default: ball(img, 8, 8, 5, 5, R.leaf);
  }
  return out(img);
}
export { produce };

// Resources and goods. Each: name -> () => Img
export const RES = {
  wood() { const i = new Img(16, 16); i.rect(2, 4, 12, 4, R.wood[3]); i.hline(2, 4, 12, R.wood[5]); i.rect(3, 9, 12, 4, R.wood[2]); i.hline(3, 9, 12, R.wood[4]); i.disc(13, 6, 1.5, R.wood[5]); i.set(13, 6, R.wood[2]); i.disc(14, 11, 1.5, R.wood[4]); i.set(14, 11, R.wood[1]); return out(i); },
  stone() { const i = new Img(16, 16); ball(i, 7, 9, 5, 4, R.stone); ball(i, 11, 11, 3, 2.6, R.stone); i.set(5, 7, R.stone[6]); return out(i); },
  fiber() { const i = new Img(16, 16); for (let k = 0; k < 5; k++) i.line(4 + k * 2, 14, 3 + k * 2.5, 4 + (k % 2) * 2, R.grassSummer[k % 2 ? 4 : 3]); i.hline(4, 11, 9, R.red[3]); return out(i); },
  coal() { const i = new Img(16, 16); ball(i, 8, 9, 5, 4.4, R.ink); i.set(6, 7, R.ink[5]); i.set(9, 8, R.ink[4]); i.set(8, 11, R.ink[1]); return out(i); },
  copperOre() { const i = new Img(16, 16); ball(i, 8, 9, 5.4, 4.6, R.stone); for (const [x, y] of [[6, 8], [10, 10], [8, 7], [5, 11]]) { i.set(x, y, R.orange[3]); i.set(x + 1, y, R.orange[4]); } return out(i); },
  ironOre() { const i = new Img(16, 16); ball(i, 8, 9, 5.4, 4.6, R.stone); for (const [x, y] of [[6, 8], [10, 10], [8, 7], [5, 11]]) { i.set(x, y, R.teal[4]); i.set(x + 1, y, R.cream[3]); } return out(i); },
  goldOre() { const i = new Img(16, 16); ball(i, 8, 9, 5.4, 4.6, R.stone); for (const [x, y] of [[6, 8], [10, 10], [8, 7], [5, 11]]) { i.set(x, y, R.yellow[3]); i.set(x + 1, y, R.yellow[4]); } return out(i); },
  bar(ramp) { return () => { const i = new Img(16, 16); i.rect(3, 6, 10, 6, ramp[3]); i.hline(3, 6, 10, ramp[5] ?? ramp[4]); i.rect(2, 8, 12, 4, ramp[2]); i.hline(2, 8, 12, ramp[4]); i.hline(2, 11, 12, ramp[1]); i.set(5, 7, R.cream[3]); return out(i); }; },
  clay() { const i = new Img(16, 16); ball(i, 8, 9, 5.4, 4, R.dirt); i.hline(5, 8, 6, R.dirt[5]); return out(i); },
  egg() { const i = new Img(16, 16); i.ellipse(8, 9, 4, 5, R.cream[2]); i.ellipse(8, 9, 4, 5, null, (x, y, nx, ny) => (nx < -0.3 ? R.cream[3] : nx > 0.35 ? R.cream[0] : undefined)); return out(i); },
  milk() { const i = new Img(16, 16); i.rect(5, 5, 6, 9, R.snow[3]); i.rect(5, 5, 6, 3, R.blue[3]); i.hline(5, 4, 6, R.snow[2]); i.vline(5, 8, 6, R.snow[4]); i.hline(5, 13, 6, R.snow[0]); i.rect(6, 2, 4, 2, R.snow[2]); return out(i); },
  coin() { const i = new Img(16, 16); ball(i, 8, 8, 5, 5, R.yellow); i.disc(8, 8, 2.2, R.yellow[2]); i.set(7, 7, R.yellow[4]); return out(i); },
  mushroom() { const i = new Img(16, 16); i.rect(7, 9, 3, 5, R.cream[2]); i.ellipse(8, 8, 5.4, 4, R.red[3]); i.rect(2, 8, 13, 2, null); i.ellipse(8, 8, 5.4, 4, null, (x, y, nx, ny) => (ny > 0.2 ? undefined : nx < -0.3 ? R.red[4] : R.red[3])); for (const [x, y] of [[6, 6], [10, 7], [8, 5]]) i.set(x, y, R.cream[3]); i.hline(3, 9, 10, R.red[1]); return out(i); },
  berry() { const i = new Img(16, 16); for (const [x, y] of [[6, 10], [10, 9], [8, 6]]) { ball(i, x, y, 2.6, 2.6, R.purple); } i.set(8, 3, R.leaf[4]); return out(i); },
  flower() { const i = new Img(16, 16); i.vline(8, 8, 7, R.leaf[3]); for (const [x, y] of [[8, 4], [5, 6], [11, 6], [6, 9], [10, 9]]) i.disc(x, y, 1.8, R.blossom[3]); i.disc(8, 7, 1.4, R.yellow[3]); return out(i); },
  fish(ramp = R.teal) { return () => { const i = new Img(16, 16); i.ellipse(7, 8, 5.6, 3.2, ramp[3]); i.ellipse(7, 8, 5.6, 3.2, null, (x, y, nx, ny) => (ny < -0.3 ? ramp[4] : ny > 0.4 ? R.cream[2] : undefined)); i.line(12, 8, 15, 5, ramp[2]); i.line(12, 8, 15, 11, ramp[2]); i.set(4, 7, R.ink[0]); return out(i); }; },
  sap() { const i = new Img(16, 16); i.ellipse(8, 10, 3.6, 4, R.yellow[3]); i.set(7, 8, R.yellow[4]); i.set(8, 5, R.yellow[3]); i.set(8, 6, R.yellow[2]); return out(i); },
  hay() { const i = new Img(16, 16); for (let k = 0; k < 7; k++) i.line(3 + k * 1.6, 13, 2 + k * 2, 5 + (k % 3), R.sand[k % 2 ? 2 : 3]); i.hline(3, 10, 11, R.red[3]); return out(i); },
  loaf() { const i = new Img(16, 16); i.ellipse(8, 9, 6, 3.6, R.wood[4]); i.ellipse(8, 9, 6, 3.6, null, (x, y, nx, ny) => (ny < -0.3 ? R.wood[5] : ny > 0.4 ? R.wood[2] : undefined)); for (const x of [5, 8, 11]) i.line(x, 7, x + 1, 9, R.wood[6] ?? R.wood[5]); return out(i); },
  dish(c = R.orange) { return () => { const i = new Img(16, 16); i.ellipse(8, 11, 7, 3, R.cream[2]); i.ellipse(8, 10, 5.6, 2.4, c[3]); ball(i, 8, 8, 3.6, 2.4, c); i.set(7, 7, R.cream[3]); return out(i); }; },
  gem(ramp = R.purple) { return () => { const i = new Img(16, 16); i.line(8, 2, 3, 7, ramp[4]); i.line(8, 2, 13, 7, ramp[3]); i.rect(3, 7, 11, 2, ramp[3]); for (let y = 0; y < 6; y++) i.hline(3 + y, 9 + y, 10 - y * 2, y < 3 ? ramp[2] : ramp[1]); i.rect(4, 5, 8, 3, ramp[3]); i.set(6, 5, R.cream[3]); i.set(7, 6, R.cream[2]); return out(i); }; },
  lantern() { const i = new Img(16, 16); i.rect(5, 4, 6, 9, R.ink[1]); i.rect(6, 5, 4, 7, R.glow[3]); i.rect(7, 6, 2, 4, R.glow[4]); i.hline(4, 3, 8, R.ink[2]); i.hline(6, 2, 4, R.ink[2]); i.hline(4, 13, 8, R.ink[2]); i.set(8, 1, R.ink[2]); return out(i); },
};
