// Lays frames from the built atlas out in one picture, to judge a whole family side by side.
// Usage: node tools/art/preview-atlas.mjs <prefix> [<prefix>...] [--scale 4] [--cols 14] [--out .100x/art/atlas.png]
import { readFileSync } from 'node:fs';
import { Img } from './px.mjs';
import { readPNG, writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const scale = Number(flag('scale', 4));
const cols = Number(flag('cols', 14));
const out = flag('out', '.100x/art/atlas.png');
const prefixes = args;
if (prefixes.length === 0) {
  console.error('Give at least one frame prefix, for example: ui item');
  process.exit(2);
}

const atlas = readPNG('public/assets/atlas.png');
const json = JSON.parse(readFileSync('public/assets/atlas.json', 'utf8'));
const frames = Array.isArray(json.frames) ? Object.fromEntries(json.frames.map((f) => [f.filename, f])) : json.frames;

const items = [];
let cellW = 0;
let cellH = 0;
for (const [name, f] of Object.entries(frames)) {
  if (!prefixes.some((p) => name === p || name.startsWith(`${p}/`))) continue;
  const { x, y, w, h } = f.frame;
  const img = new Img(w, h);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * atlas.w + x) * 4;
    img.d.set(atlas.d.subarray(from, from + w * 4), row * w * 4);
  }
  items.push({ name: name.split('/').slice(1).join('/'), img });
  cellW = Math.max(cellW, w);
  cellH = Math.max(cellH, h);
}

const picture = sheet(items, { cols, scale, cellW, cellH });
writePNG(out, picture);
console.log(`${items.length} frames, cells ${cellW}x${cellH}, wrote ${out} ${picture.w}x${picture.h}`);
