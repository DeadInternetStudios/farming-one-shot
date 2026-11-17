// Things to put in the garden: paper lanterns on stakes, a stone lantern, a planter for each season,
// a bird bath and a gnome. Each lit thing returns { day, glow } like the lamp post: the glow frame is
// drawn over the day frame at night. Every sprite keeps a clear pixel all round for its outline,
// and its feet are on the bottom row.
import { Img } from '../px.mjs';
import { R, outlineOf, mix } from '../palette.mjs';

const out = (img) => img.outline((c) => outlineOf(c));

/** A paper lantern on a short stake, 12 x 24. `c` is the colour ramp of the paper. */
export function paperLantern(c) {
  const day = new Img(12, 24), glow = new Img(12, 24);
  const top = c[c.length - 1];
  // the stake
  day.rect(5, 14, 2, 9, R.wood[2]); day.vline(5, 14, 9, R.wood[4]); day.hline(4, 22, 4, R.wood[1]);
  // the body: a rounded drum of paper with ribs
  const body = (img, shade) => {
    img.ellipse(6, 8, 4.4, 5.4, null, (x, y, nx) => shade(x, y, nx));
  };
  body(day, (x, y, nx) => (nx < -0.45 ? c[4] : nx > 0.45 ? c[2] : c[3]));
  for (const y of [5, 8, 11]) for (let x = 2; x < 11; x++) if (day.col(x, y) !== null) day.set(x, y, c[1]);
  day.set(4, 6, top); day.set(4, 7, top);
  // caps and the hook
  day.rect(4, 2, 4, 1, R.ink[2]); day.rect(4, 13, 4, 1, R.ink[2]); day.rect(5, 1, 2, 1, R.ink[3]);
  // a short tassel and a bead
  day.vline(6, 14, 1, R.yellow[3]);
  out(day);
  // lit from inside: a pale core, the paper's own colour at its rim, ribs left as shadows
  body(glow, (x, y, nx, ny) => (Math.abs(nx) < 0.42 && Math.abs(ny) < 0.5 ? R.glow[4] : Math.abs(nx) < 0.72 ? mix(top, R.glow[3], 0.35) : top));
  for (const y of [5, 8, 11]) for (let x = 2; x < 11; x++) if (glow.col(x, y) !== null) glow.set(x, y, c[3]);
  return { day, glow };
}

/** A small stone lantern with a lit window, 14 x 26. */
export function stoneLantern() {
  const day = new Img(14, 26), glow = new Img(14, 26);
  const S = R.stone;
  // foot and shaft
  day.rect(3, 22, 8, 3, S[3]); day.hline(3, 22, 8, S[5]); day.hline(3, 24, 8, S[1]);
  day.rect(5, 15, 4, 7, S[3]); day.vline(5, 15, 7, S[4]); day.vline(8, 15, 7, S[2]);
  // the plate under the fire box
  day.rect(3, 13, 8, 2, S[4]); day.hline(3, 13, 8, S[5]); day.hline(3, 14, 8, S[2]);
  // fire box with a window
  day.rect(4, 7, 6, 6, S[3]); day.vline(4, 7, 6, S[4]); day.vline(9, 7, 6, S[2]);
  day.rect(5, 8, 4, 4, R.ink[1]); day.rect(5, 8, 4, 1, R.ink[0]);
  day.rect(6, 10, 2, 2, mix(R.glow[0], R.ink[1], 0.5));
  // the roof
  day.rect(2, 5, 10, 2, S[4]); day.hline(2, 5, 10, S[5]); day.hline(2, 6, 10, S[2]);
  day.rect(4, 3, 6, 2, S[3]); day.hline(4, 3, 6, S[5]);
  day.rect(6, 1, 2, 2, S[4]); day.set(6, 1, S[6]);
  // moss at the foot
  day.set(4, 23, R.leaf[4]); day.set(5, 23, R.leaf[3]); day.set(9, 23, R.leaf[4]);
  out(day);
  glow.rect(5, 8, 4, 4, R.glow[3]); glow.rect(6, 9, 2, 3, R.glow[4]);
  return { day, glow };
}

/** A wooden planter with whatever is in flower, 16 x 15. */
export function planter(season) {
  const img = new Img(16, 15);
  // the box
  img.rect(1, 7, 14, 2, R.wood[4]); img.hline(1, 7, 14, R.wood[6]); img.hline(1, 8, 14, R.wood[3]);
  img.rect(2, 9, 12, 5, R.wood[3]); img.hline(2, 13, 12, R.wood[1]);
  for (const x of [5, 9]) img.vline(x, 9, 5, R.wood[2]);
  img.vline(2, 9, 5, R.wood[4]);
  img.rect(2, 6, 12, 1, season === 'winter' ? R.snow[2] : R.dirt[2]);
  const leaf = (x, y, c = R.leaf[4]) => { img.set(x, y, c); img.set(x - 1, y + 1, R.leaf[3]); img.set(x + 1, y + 1, R.leaf[3]); };
  const bloom = (x, y, c, mid) => { img.set(x, y, mid); img.set(x - 1, y, c); img.set(x + 1, y, c); img.set(x, y - 1, c); img.set(x, y + 1, c); };
  if (season === 'spring') {
    for (const x of [4, 8, 11]) img.vline(x, 3, 3, R.leaf[3]);
    leaf(3, 4); leaf(9, 4); leaf(12, 4, R.leaf[5]);
    bloom(4, 2, R.blossom[3], R.yellow[3]); bloom(8, 1, R.cream[2], R.yellow[3]); bloom(11, 3, R.blossom[4], R.yellow[2]);
  } else if (season === 'summer') {
    for (const x of [4, 8, 11]) img.vline(x, 3, 3, R.leaf[3]);
    leaf(3, 4); leaf(6, 4); leaf(10, 4); leaf(13, 4, R.leaf[5]);
    bloom(4, 2, R.yellow[3], R.dirt[2]); bloom(8, 1, R.yellow[4], R.dirt[3]); bloom(11, 3, R.orange[3], R.dirt[1]);
  } else if (season === 'fall') {
    for (const x of [4, 8, 11]) img.vline(x, 3, 3, R.leaf[2]);
    leaf(3, 4, R.autumn[3]); leaf(9, 4, R.autumn[2]); leaf(13, 4, R.autumn[4]);
    bloom(4, 2, R.orange[3], R.yellow[3]); bloom(8, 1, R.red[3], R.orange[4]); bloom(11, 3, R.autumn[4], R.yellow[3]);
  } else {
    // evergreen sprigs, red berries and a little snow
    for (const x of [4, 8, 11]) {
      img.vline(x, 2, 4, R.leaf[1]);
      img.set(x - 1, 3, R.leaf[2]); img.set(x + 1, 3, R.leaf[2]); img.set(x - 1, 5, R.leaf[2]); img.set(x + 1, 5, R.leaf[2]);
      img.set(x, 1, R.leaf[3]); img.set(x, 2, R.leaf[3]);
    }
    for (const [x, y] of [[3, 4], [5, 2], [9, 3], [12, 4], [7, 4]]) img.set(x, y, R.red[3]);
    for (const [x, y] of [[4, 1], [8, 0], [11, 1]]) img.set(x, y, R.snow[3]);
  }
  out(img);
  return img;
}

/** A stone bird bath with a small blue bird on the rim, 18 x 24. */
export function birdBath() {
  const img = new Img(18, 24);
  const S = R.stone;
  img.rect(4, 20, 10, 3, S[3]); img.hline(4, 20, 10, S[5]); img.hline(4, 22, 10, S[1]);
  img.rect(7, 12, 4, 8, S[3]); img.vline(7, 12, 8, S[4]); img.vline(10, 12, 8, S[2]);
  img.rect(5, 11, 8, 2, S[4]); img.hline(5, 11, 8, S[5]);
  // the basin
  img.ellipse(9, 9, 8, 3.6, S[4]);
  img.ellipse(9, 8.6, 6.6, 2.5, R.water[3]);
  img.ellipse(9, 8.3, 5, 1.5, R.water[4]);
  img.hline(6, 8, 3, R.water[6]); img.set(12, 9, R.water[5]);
  img.hline(3, 6, 12, S[6]);
  img.hline(2, 12, 14, S[2]);
  // the bird, facing right
  img.rect(11, 4, 3, 2, R.blue[3]); img.rect(13, 3, 2, 2, R.blue[3]);
  img.set(15, 4, R.yellow[3]); img.set(14, 3, R.ink[0]); img.set(11, 4, R.blue[4]);
  img.set(10, 5, R.blue[2]); img.set(9, 5, R.blue[2]);
  img.set(11, 5, R.cream[3]); img.set(12, 5, R.cream[3]);
  img.set(12, 6, R.ink[2]); img.set(13, 6, R.ink[2]);
  out(img);
  return img;
}

/** A garden gnome holding a lantern, 14 x 20. */
export function gnome() {
  const day = new Img(14, 20), glow = new Img(14, 20);
  const key = {
    r: R.red[3], R: R.red[1], h: R.red[4], s: R.skin1[3], S: R.skin1[2], n: R.skin1[4], w: R.cream[3], W: R.cream[1],
    b: R.blue[2], B: R.blue[1], c: R.blue[3], k: R.ink[0], y: R.yellow[3], o: R.wood[1], g: R.ink[3], l: R.glow[2], m: R.leaf[3],
  };
  const art = Img.ascii([
    '..............',
    '......rr......',
    '.....rhrr.....',
    '.....rhrrR....',
    '....rhrrrrR...',
    '....rrrrrrR...',
    '...RRRRRRRRR..',
    '....ssssssS...',
    '....sksskSS...',
    '....sssnsSS...',
    '...wwwwwwwwW..',
    '...wwwwwwwWW..',
    '....wwwwwWW.g.',
    '...bbbbbbbB.gl',
    '...bcbbbbbB.gl',
    '...bbyyybbB.g.',
    '...bbbbbbbB...',
    '....oo..oo....',
    '...mooooooom..',
    '..............',
  ], key);
  day.blit(art, -1, 0);
  out(day);
  glow.set(12, 13, R.glow[3]); glow.set(12, 14, R.glow[4]);
  return { day, glow };
}

/** A shop icon: the top of a tall sprite, or the whole of a small one, centred on a 16 x 16 square. */
export function icon(src) {
  const b = src.bounds();
  if (!b) return new Img(16, 16);
  const w = Math.min(14, b.w), h = Math.min(14, b.h);
  const x = b.x + Math.floor((b.w - w) / 2);
  const piece = src.sub(x, b.y, w, h);
  const o = new Img(16, 16);
  o.blit(piece, Math.floor((16 - w) / 2), Math.floor((16 - h) / 2));
  return o;
}
