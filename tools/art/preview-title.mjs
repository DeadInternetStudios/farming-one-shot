import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { R } from './palette.mjs';
import * as T from './gen/title.mjs';

// Compose the title strips over a dusk gradient at 2x so the layers can be judged together.
const W = 320, H = 200;
const out = new Img(W, H);
const stops = [R.ink[0], R.ink[1], R.purple[0], R.purple[1], R.pink[0], R.red[2], R.orange[2], R.glow[1]];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const f = (y / (H * 0.78)) * (stops.length - 1);
  const i = Math.max(0, Math.min(stops.length - 1, Math.round(f)));
  out.set(x, y, stops[i]);
}
out.blit(T.cloud(0), 20, 60); out.blit(T.cloud(1), 190, 40); out.blit(T.cloud(2), 120, 90);
out.blit(T.moon(), 250, 14);
out.blit(T.hills('far'), 0, 92);
out.blit(T.hills('mid'), 0, 112);
out.blit(T.hills('near'), 0, 140);
out.blit(T.lantern('red'), 40, 30); out.blit(T.lantern('gold'), 70, 50); out.blit(T.lantern('pink'), 90, 24);
out.blit(T.seal(), 10, 10);
writePNG('.100x/art/title-layers.png', out.scale(3));
const logo = T.logo();
const bg = new Img(logo.w + 20, logo.h + 20).fill(R.ink[1]);
bg.blit(logo, 10, 10);
writePNG('.100x/art/title-logo.png', bg.scale(3));
console.log('ok', logo.w, logo.h);
