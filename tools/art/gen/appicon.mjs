// The app icon: a gold paper lantern glowing over a dusk valley. Drawn at 64 x 64 and scaled up with hard edges.
import { Img } from '../px.mjs';
import { R } from '../palette.mjs';
import { Rng, bayer4 } from '../rng.mjs';
import * as T from './title.mjs';

export const ICON_SIZE = 64;

/** Nearest-pixel resize to any square size, so one drawing serves every icon size. */
export function resize(src, size) {
  const o = new Img(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) / size) * src.w));
    const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) / size) * src.h));
    const i = (sy * src.w + sx) * 4, t = (y * size + x) * 4;
    o.d[t] = src.d[i]; o.d[t + 1] = src.d[i + 1]; o.d[t + 2] = src.d[i + 2]; o.d[t + 3] = src.d[i + 3];
  }
  return o;
}

function ridge(seed, base, waves) {
  const r = new Rng(seed);
  const parts = waves.map(([k, amp]) => ({ k, amp, ph: r.range(0, Math.PI * 2) }));
  return (x) => Math.round(base + parts.reduce((a, p) => a + p.amp * Math.sin((Math.PI * 2 * p.k * x) / ICON_SIZE + p.ph), 0));
}

function pine(img, x, baseY, h, ramp) {
  for (let j = 0; j < h; j++) {
    const half = Math.round(((j + 1) / h) * (h * 0.28));
    for (let i = -half; i <= half; i++) img.set(x + i, baseY - h + 1 + j, j < h * 0.5 ? ramp[2] : ramp[1]);
  }
  img.set(x, baseY + 1, R.wood[1]);
}

export function appIcon() {
  const S = ICON_SIZE;
  const img = new Img(S, S);
  const rng = new Rng('lantern-hollow-icon');

  // dusk sky, plum at the top and warm at the horizon, the seams dithered
  const sky = [R.ink[1], R.purple[0], R.purple[1], R.purple[2], R.pink[1], R.pink[2], R.orange[3]];
  const horizon = 48;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const f = Math.min(1, y / horizon) * (sky.length - 1);
    const i = Math.min(sky.length - 2, Math.floor(f));
    img.set(x, y, bayer4(x, y) < f - i ? sky[i + 1] : sky[i]);
  }
  for (let n = 0; n < 18; n++) {
    const x = rng.int(1, S - 2), y = rng.int(1, 20);
    img.set(x, y, n % 4 === 0 ? R.cream[3] : R.cream[1]);
    if (n % 6 === 0) { img.set(x - 1, y, R.cream[0]); img.set(x + 1, y, R.cream[0]); img.set(x, y - 1, R.cream[0]); img.set(x, y + 1, R.cream[0]); }
  }
  img.shaded(11, 12, 5.2, 5.2, [R.cream[0], R.cream[1], R.cream[2], R.cream[3]], { light: [-0.45, -0.6], lz: 0.9, dither: 0.35 });

  // the glow around the lantern, soft like the lights in the game
  const cx = 32, cy = 30;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - cx, (y - cy) * 1.05);
    const s = Math.max(0, 1 - d / 27);
    if (s <= 0) continue;
    img.over(x, y, R.glow[2], Math.round(s * s * 130));
  }

  // far hills with a few lit windows, near hills with pines
  const far = ridge(5, 50, [[1, 3], [2, 2], [3, 1]]);
  const near = ridge(9, 57, [[1, 3], [2, 1.5], [4, 0.8]]);
  for (let x = 0; x < S; x++) {
    for (let y = far(x); y < S; y++) img.set(x, y, bayer4(x, y) < (y - far(x)) / 10 ? R.teal[0] : R.teal[1]);
    img.set(x, far(x), R.teal[2]);
  }
  for (const x of [8, 14, 49, 55]) {
    const y = far(x) + 2;
    img.set(x, y, R.glow[2]); img.set(x + 1, y, R.glow[3]);
  }
  for (let x = 0; x < S; x++) {
    for (let y = near(x); y < S; y++) img.set(x, y, bayer4(x, y) < (y - near(x)) / 8 ? R.leaf[0] : R.leaf[1]);
    img.set(x, near(x), R.leaf[3]);
  }
  for (const [x, h] of [[5, 10], [11, 7], [52, 8], [58, 11], [46, 6]]) pine(img, x, near(x) + 1, h, [R.leaf[0], R.leaf[1], R.leaf[2]]);

  // the lantern on its string, lit from inside
  const lamp = T.lantern('gold').scale(2);
  const lx = cx - Math.floor(lamp.w / 2), ly = 8;
  img.vline(cx, 0, ly + 3, R.dirt[2]);
  img.blit(lamp, lx, ly);
  for (let y = 0; y < lamp.h; y++) for (let x = 0; x < lamp.w; x++) {
    if (!lamp.solid(x, y)) continue;
    const nx = (x + 0.5 - lamp.w / 2) / (lamp.w / 2), ny = (y + 0.5 - lamp.h / 2 - 1) / (lamp.h / 2);
    if (Math.abs(nx) < 0.5 && Math.abs(ny) < 0.5) img.set(lx + x, ly + y, Math.abs(nx) < 0.25 && Math.abs(ny) < 0.3 ? R.glow[4] : R.glow[3]);
  }
  return img;
}
