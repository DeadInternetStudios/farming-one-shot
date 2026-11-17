import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { R } from './palette.mjs';
import * as TR from './gen/terrain.mjs';

const W = 26, H = 15;
// 0 water, 1 grass, 2 path, 3 soil, 4 wet soil, 5 cobble
const g = Array.from({ length: H }, () => new Array(W).fill(1));
const setR = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = v; };
// pond bottom-right
setR(17, 8, 8, 6, 0); setR(16, 10, 1, 3, 0); setR(18, 7, 5, 1, 0); setR(25, 10, 1, 2, 0);
g[13][17] = 1; g[8][17] = 1;
// path
setR(2, 7, 14, 2, 2); setR(8, 2, 2, 6, 2);
setR(13, 1, 4, 3, 5);
// soil field
setR(2, 2, 5, 4, 3); setR(2, 4, 5, 1, 4); setR(3, 2, 1, 2, 4);
setR(4, 10, 3, 3, 3); g[11][5] = 4;

const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : g[y][x]);
function maskOf(x, y, pred) {
  const dirs = [[0, -1, TR.N], [1, -1, TR.NE], [1, 0, TR.E], [1, 1, TR.SE], [0, 1, TR.S], [-1, 1, TR.SW], [-1, 0, TR.W], [-1, -1, TR.NW]];
  let m = 0;
  for (const [dx, dy, bit] of dirs) { const v = at(x + dx, y + dy); if (v === null ? true : pred(v)) m |= bit; }
  return m;
}

export function build(season = 'summer') {
  const ramp = season === 'fall' ? R.grassFall : season === 'summer' ? R.grassSummer : R.grass;
  const out = new Img(W * 16, H * 16);
  const water = TR.waterFrames(6, 64);
  for (let y = 0; y < H * 16; y += 64) for (let x = 0; x < W * 16; x += 64) out.blit(water[0], x, y);
  const landOpts = (variant) => ({ interior: season === 'winter' ? TR.snowInterior(variant) : TR.grassInterior(variant, ramp), rim: TR.bankRim, rimDepth: 2, outer: TR.bankOuter });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] === 0) continue;
    const m = maskOf(x, y, (v) => v !== 0);
    const variant = ((x * 7 + y * 13) % 6);
    const t = TR.reduceMask(m) === 255 ? TR.fullTile(season === 'winter' ? TR.snowInterior(variant) : TR.grassInterior(variant, ramp)) : TR.blobTile(m, landOpts(variant));
    out.blit(t, x * 16, y * 16);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = g[y][x];
    if (v === 2) out.blit(TR.blobTile(maskOf(x, y, (q) => q === 2 || q === 5), { interior: TR.pathInterior(1), rim: TR.pathRim }), x * 16, y * 16);
    if (v === 5) out.blit(TR.blobTile(maskOf(x, y, (q) => q === 5 || q === 2), { interior: TR.cobbleInterior(1), rim: TR.cobbleRim }), x * 16, y * 16);
    if (v === 3) out.blit(TR.blobTile(maskOf(x, y, (q) => q === 3 || q === 4), { interior: TR.soilInterior(false), rim: TR.soilRim(false) }), x * 16, y * 16);
    if (v === 4) out.blit(TR.blobTile(maskOf(x, y, (q) => q === 3 || q === 4), { interior: TR.soilInterior(true), rim: TR.soilRim(true) }), x * 16, y * 16);
  }
  return out;
}

const season = process.argv[2] || 'summer';
const out = build(season);
writePNG(`.100x/art/terrain-${season}.png`, out.scale(3));
console.log('wrote', `.100x/art/terrain-${season}.png`, out.w * 4, out.h * 4);
