// World objects: trees, bushes, rocks, flowers, grass, fences, debris.
import { Img, step } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng, bayer4, hash2 } from '../rng.mjs';

// Shade overlapping clumps like a pile of lit spheres. discs: [{x, y, r, z}]
export function foliage(img, discs, ramp, o = {}) {
  const L = o.light ?? [-0.6, -0.78, 0.55];
  const ln = Math.hypot(...L);
  const dither = o.dither ?? 0.5;
  const n = ramp.length;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    let best = null, bestH = 0;
    for (const d of discs) {
      const dx = x + 0.5 - d.x, dy = y + 0.5 - d.y;
      const dd = dx * dx + dy * dy;
      if (dd >= d.r * d.r) continue;
      const h = Math.sqrt(d.r * d.r - dd) + (d.z ?? 0);
      if (h > bestH) { bestH = h; best = { d, dx, dy }; }
    }
    if (!best) continue;
    const r = best.d.r;
    const nx = best.dx / r, ny = best.dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let v = (nx * L[0] + ny * L[1] + nz * L[2]) / ln;
    v = v * 0.5 + 0.5;
    v = v * (o.gain ?? 1.0) + (o.bias ?? 0);
    let f = v * (n - 1) + (bayer4(x, y) - 0.5) * dither;
    img.set(x, y, ramp[Math.max(0, Math.min(n - 1, Math.round(f)))]);
  }
}

// Leafy texture: short light and dark dashes over what is already drawn.
export function leafTexture(img, rng, count, lightStep = 1, darkStep = -1) {
  for (let i = 0; i < count; i++) {
    const x = rng.int(1, img.w - 3), y = rng.int(1, img.h - 2);
    const c = img.col(x, y);
    if (c === null) continue;
    const up = rng.chance(0.55);
    const nc = step(c, up ? lightStep : darkStep);
    img.set(x, y, nc);
    if (img.col(x + 1, y) !== null && rng.chance(0.7)) img.set(x + 1, y, nc);
  }
}

function scatterDiscs(rng, cx, cy, rx, ry, count, rmin, rmax, bigs = []) {
  const discs = [...bigs];
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2), k = Math.sqrt(rng.next());
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    discs.push({ x, y, r: rng.range(rmin, rmax), z: (y - (cy - ry)) * 0.25 });
  }
  return discs;
}

function seasonLeaf(season) {
  if (season === 'spring') return R.leaf;
  if (season === 'summer') return R.leaf;
  if (season === 'fall') return R.autumn;
  return R.leaf;
}

// ---------- trees ----------
// 48 x 64, feet (trunk base) at the bottom centre.
export function tree(season = 'summer', seed = 1) {
  const W = 48, H = 64;
  const rng = new Rng(seed * 101 + 5);
  const img = new Img(W, H);
  const wood = R.wood;
  // trunk
  const trunk = new Img(W, H);
  for (let y = 30; y < 63; y++) {
    const t = (y - 30) / 33;
    const half = 3 + t * 1.2 + (y > 58 ? (y - 58) * 0.9 : 0);
    const x0 = Math.round(24 - half), x1 = Math.round(24 + half);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / (x1 - x0 - 1 || 1);
      let c = u < 0.25 ? wood[4] : u < 0.55 ? wood[3] : u < 0.8 ? wood[2] : wood[1];
      trunk.set(x, y, c);
    }
  }
  for (let i = 0; i < 9; i++) { // bark marks
    const x = rng.int(21, 27), y = rng.int(36, 58);
    const c = trunk.col(x, y);
    if (c !== null) { trunk.set(x, y, step(c, -1)); if (rng.chance(0.6)) trunk.set(x, y + 1, step(c, -1)); }
  }
  img.blit(trunk, 0, 0);
  // canopy
  const canopy = new Img(W, H);
  const winter = season === 'winter';
  const ramp = winter ? R.wood : season === 'fall' ? R.autumn : R.leaf;
  if (!winter) {
    const bigs = [
      { x: 24, y: 22, r: 14, z: 0 }, { x: 14, y: 27, r: 10.5, z: 1 }, { x: 34, y: 27, r: 10.5, z: 1 },
      { x: 24, y: 13, r: 11, z: 0 },
    ];
    const discs = scatterDiscs(rng, 24, 23, 17, 12, 13, 5.5, 9, bigs);
    foliage(canopy, discs, ramp, { bias: season === 'spring' ? 0.04 : 0 });
    leafTexture(canopy, rng, 70);
    if (season === 'spring') {
      // blossom: pink clusters over green
      const blos = R.blossom;
      for (let i = 0; i < 46; i++) {
        const x = rng.int(6, 41), y = rng.int(3, 38);
        if (canopy.col(x, y) === null) continue;
        const c = rng.pick([blos[2], blos[3], blos[3], blos[4], blos[5]]);
        canopy.set(x, y, c);
        if (rng.chance(0.6)) canopy.set(x + 1, y, step(c, -1));
        if (rng.chance(0.35)) canopy.set(x, y + 1, step(c, -1));
      }
    }
    if (season === 'summer') {
      for (let i = 0; i < 5; i++) {
        const x = rng.int(8, 39), y = rng.int(8, 36);
        if (canopy.col(x, y) !== null) canopy.set(x, y, R.leaf[6]);
      }
    }
    canopy.outline((c) => outlineOf(c), { diag: false });
  } else {
    // bare branches with a little snow
    const b = R.wood;
    const branches = [
      [24, 40, 24, 22], [24, 32, 12, 18], [24, 30, 36, 16], [24, 24, 20, 8], [24, 24, 30, 6], [12, 18, 6, 12], [12, 18, 14, 10],
      [36, 16, 42, 10], [36, 16, 33, 8],
    ];
    for (const [x0, y0, x1, y1] of branches) {
      canopy.line(x0, y0, x1, y1, b[3]);
      canopy.line(x0 + 1, y0, x1 + 1, y1, b[2]);
    }
    for (const [x0, y0, x1, y1] of branches) {
      canopy.set(x1, y1 - 1, R.snow[3]); canopy.set(x1 + 1, y1 - 1, R.snow[2]);
      const mx = Math.round((x0 + x1) / 2), my = Math.round((y0 + y1) / 2);
      canopy.set(mx, my - 1, R.snow[3]);
    }
    canopy.outline((c) => outlineOf(c));
  }
  img.blit(canopy, 0, 0);
  img.outline((c) => outlineOf(c));
  // grounded roots
  img.set(19, 62, wood[0]); img.set(28, 62, wood[0]);
  if (winter) {
    // snow on the roots
    for (let x = 19; x < 29; x++) img.set(x, 62, R.snow[2]);
  }
  return img;
}

// The stump left when a tree is chopped, 16 x 16.
export function stump(seed = 1, snow = false) {
  const img = new Img(16, 16);
  const rng = new Rng(seed * 9 + 1);
  const w = R.wood;
  img.ellipse(8, 11, 7, 4, w[1]);
  img.rect(2, 9, 12, 5, null);
  for (let y = 7; y < 14; y++) for (let x = 2; x < 14; x++) {
    const u = (x - 2) / 11;
    const inBody = (y >= 9) && (x - 8) * (x - 8) / 36 < 1;
    if (inBody) img.set(x, y, u < 0.3 ? w[3] : u < 0.65 ? w[2] : w[1]);
  }
  img.ellipse(8, 8.5, 6.5, 3.4, w[4]);
  img.ellipse(8, 8.5, 5, 2.4, w[5]);
  img.ellipse(8, 8.5, 3.2, 1.5, w[4]);
  img.ellipse(8, 8.5, 1.5, 0.8, w[5]);
  img.set(8, 8, w[3]);
  for (let i = 0; i < 6; i++) { const x = rng.int(3, 12), y = rng.int(10, 13); if (img.col(x, y) !== null) img.set(x, y, w[0]); }
  img.outline(() => w[0]);
  if (snow) { for (let x = 4; x < 12; x++) img.set(x, 7, R.snow[3]); img.set(5, 6, R.snow[2]); img.set(10, 6, R.snow[2]); }
  return img;
}

// ---------- bushes ----------
export function bush(season = 'summer', seed = 1) {
  const W = 24, H = 18;
  const rng = new Rng(seed * 33 + 2);
  const img = new Img(W, H);
  const ramp = season === 'fall' ? R.autumn : R.leaf;
  if (season === 'winter') {
    const b = R.wood;
    for (let i = 0; i < 9; i++) {
      const x1 = 12 + rng.int(-9, 9), y1 = rng.int(3, 8);
      img.line(12, 16, x1, y1, i % 2 ? b[3] : b[2]);
      if (rng.chance(0.7)) img.set(x1, y1 - 1, R.snow[3]);
    }
    for (let x = 6; x < 18; x++) if (img.col(x, 15) !== null || rng.chance(0.5)) img.set(x, 16, R.snow[3]);
    img.outline((c) => outlineOf(c));
    return img;
  }
  const discs = scatterDiscs(rng, 12, 10, 7, 4, 4, 5, 7, [{ x: 12, y: 9.5, r: 8, z: 0 }, { x: 6.5, y: 11.5, r: 5.5, z: 1 }, { x: 17.5, y: 11.5, r: 5.5, z: 1 }]);
  foliage(img, discs, ramp, { bias: season === 'spring' ? 0.03 : 0 });
  leafTexture(img, rng, 22);
  if (season === 'spring') {
    for (let i = 0; i < 12; i++) { const x = rng.int(4, 19), y = rng.int(3, 14); if (img.col(x, y) !== null) img.set(x, y, rng.pick([R.blossom[3], R.blossom[4], R.cream[3]])); }
  } else if (season === 'summer') {
    for (let i = 0; i < 6; i++) { const x = rng.int(4, 19), y = rng.int(4, 14); if (img.col(x, y) !== null) { img.set(x, y, R.red[3]); img.set(x + 1, y, R.red[2]); } }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ---------- rocks ----------
export function rock(kind = 'small', seed = 1) {
  const rng = new Rng(seed * 71 + 4);
  const st = R.stone;
  if (kind === 'small') {
    const img = new Img(16, 14);
    foliage(img, [{ x: 8, y: 8.5, r: 6.5, z: 0 }, { x: 5.5, y: 9.5, r: 4.5, z: 0.5 }, { x: 11, y: 9.5, r: 4, z: 0.5 }], st, { dither: 0.35, light: [-0.5, -0.8, 0.5] });
    img.rect(0, 12, 16, 2, null);
    for (let i = 0; i < 4; i++) { const x = rng.int(3, 12), y = rng.int(5, 10); if (img.col(x, y) !== null) img.set(x, y, step(img.col(x, y), 1)); }
    img.outline(() => st[0]);
    return img;
  }
  // boulder 28 x 24
  const img = new Img(28, 24);
  foliage(img, [{ x: 14, y: 14, r: 11.5, z: 0 }, { x: 8.5, y: 16, r: 7.5, z: 1 }, { x: 20, y: 16.5, r: 7, z: 1 }, { x: 13, y: 9.5, r: 8, z: 0.5 }], st, { dither: 0.4 });
  img.rect(0, 22, 28, 2, null);
  img.line(12, 8, 14, 12, st[1]); img.line(14, 12, 13, 15, st[1]);
  for (let i = 0; i < 6; i++) { const x = rng.int(5, 22), y = rng.int(6, 18); if (img.col(x, y) !== null) img.set(x, y, step(img.col(x, y), rng.chance(0.5) ? 1 : -1)); }
  img.outline(() => st[0]);
  return img;
}

// Ore node: grey rock studded with coloured crystals, 16 x 16
export function ore(color) {
  const img = rock('small', 3).pad(0, 2, 0, 0);
  const rng = new Rng(color[2]);
  for (let i = 0; i < 4; i++) {
    const x = rng.int(4, 11), y = rng.int(5, 11);
    if (img.col(x, y) === null) continue;
    img.set(x, y, color[3]); img.set(x + 1, y, color[2]); img.set(x, y + 1, color[1]); img.set(x, y - 1, color[4] ?? color[3]);
  }
  return img;
}

// ---------- weeds, grass, flowers ----------
export function weed(seed = 1, season = 'summer') {
  const img = new Img(16, 16);
  const rng = new Rng(seed * 13 + 1);
  const g = season === 'fall' ? R.grassFall : season === 'winter' ? R.snow : R.grassSummer;
  const blades = season === 'winter' ? [R.grassFall[1], R.grassFall[2], R.snow[2]] : [g[1], g[2], g[3], g[4]];
  for (let i = 0; i < 9; i++) {
    const bx = 8 + rng.int(-4, 4), by = 14;
    const tx = bx + rng.int(-3, 3), ty = rng.int(3, 8);
    img.line(bx, by, tx, ty, rng.pick(blades));
  }
  img.line(8, 14, 8, 5, blades[blades.length - 1]);
  if (season === 'spring' || season === 'summer') img.set(8, 4, rng.pick([R.yellow[3], R.cream[3], R.pink[3]]));
  img.outline(() => g[0]);
  return img;
}

export function tallGrass(frame = 0, season = 'summer') {
  const img = new Img(16, 16);
  const rng = new Rng(77);
  const g = season === 'fall' ? R.grassFall : season === 'winter' ? R.snow : R.grassSummer;
  const sway = [0, 1, 0, -1][frame % 4];
  for (let i = 0; i < 12; i++) {
    const bx = rng.int(2, 13), tip = rng.int(2, 8);
    const lean = rng.int(-1, 1);
    for (let y = 15; y >= tip; y--) {
      const t = (15 - y) / (15 - tip);
      const x = Math.round(bx + lean * t * 2 + sway * t * t * 2);
      const c = t > 0.85 ? g[5] : t > 0.5 ? g[4] : t > 0.2 ? g[3] : g[2];
      img.set(x, y, season === 'winter' ? (t > 0.7 ? R.snow[3] : R.grassFall[2]) : c);
    }
  }
  img.outline(() => g[0]);
  return img;
}

export function flowerPatch(kind, seed = 1) {
  const img = new Img(16, 16);
  const rng = new Rng(seed * 19 + kind.length);
  const stem = R.grassSummer[2], leaf = R.grassSummer[4];
  const spots = [[4, 11], [11, 10], [7, 13], [13, 14], [3, 15], [9, 8]];
  const count = rng.int(4, 6);
  for (let i = 0; i < count; i++) {
    const [fx, fy] = spots[i];
    const h = rng.int(3, 5);
    img.vline(fx, fy - h, h + 1, stem);
    if (rng.chance(0.6)) img.set(fx + (rng.chance(0.5) ? 1 : -1), fy - 1, leaf);
    const top = fy - h;
    if (kind === 'daisy') {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) img.set(fx + dx, top + dy, R.cream[3]);
      img.set(fx, top, R.yellow[3]);
    } else if (kind === 'tulip') {
      const c = rng.pick([R.red, R.pink]);
      img.set(fx, top, c[3]); img.set(fx - 1, top, c[2]); img.set(fx + 1, top, c[2]); img.set(fx, top - 1, c[4]);
    } else if (kind === 'bell') {
      const c = rng.pick([R.blue, R.purple]);
      img.set(fx, top, c[3]); img.set(fx, top - 1, c[4]); img.set(fx + 1, top, c[2]); img.set(fx - 1, top + 1, c[3]);
    } else if (kind === 'sun') {
      const y = R.yellow;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]]) img.set(fx + dx, top + dy, y[3]);
      img.set(fx, top, R.wood[2]);
    } else if (kind === 'lav') {
      for (let k = 0; k < 4; k++) { img.set(fx, top + k - 1, R.purple[3 - (k % 2)]); }
      img.set(fx, top - 2, R.purple[4]);
    } else { // pink cosmos
      const p = R.pink;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) img.set(fx + dx, top + dy, p[3]);
      img.set(fx, top, R.yellow[3]);
    }
  }
  img.outline(() => R.grassSummer[0]);
  return img;
}

// ---------- fences ----------
// 16 x 16, mask bits: 1 north, 2 east, 4 south, 8 west
export function fence(mask) {
  const img = new Img(16, 20);
  const w = R.wood;
  const n = mask & 1, e = mask & 2, s = mask & 4, wv = mask & 8;
  // rails first (behind post)
  const rail = (x0, x1) => {
    for (const ry of [8, 13]) {
      img.rect(x0, ry, x1 - x0, 2, w[3]);
      img.hline(x0, ry, x1 - x0, w[4]);
      img.hline(x0, ry + 2, x1 - x0, w[1]);
    }
  };
  if (e) rail(8, 16);
  if (wv) rail(0, 8);
  // vertical connections drawn as a rail running toward the viewer
  if (s) { img.rect(7, 14, 2, 6, w[3]); img.vline(7, 14, 6, w[4]); img.vline(9, 14, 6, w[1]); }
  if (n) { img.rect(7, 9, 2, 5, w[2]); img.vline(7, 9, 5, w[3]); img.vline(9, 9, 5, w[1]); }
  // post
  img.rect(6, 5, 4, 12, w[3]);
  img.vline(6, 5, 12, w[4]);
  img.vline(9, 5, 12, w[2]);
  img.hline(6, 5, 4, w[5]);
  img.hline(6, 16, 4, w[1]);
  img.outline(() => w[0]);
  return img;
}

// ---------- debris ----------
export function branch(seed = 1) {
  const img = new Img(16, 16);
  const rng = new Rng(seed * 3 + 8);
  const w = R.wood;
  img.line(2, 11, 13, 8, w[3]); img.line(2, 12, 13, 9, w[2]);
  img.line(7, 10, 10, 5, w[3]); img.line(9, 9, 12, 12, w[2]);
  img.set(13, 8, w[5]); img.set(2, 11, w[4]);
  for (let i = 0; i < 4; i++) { const x = rng.int(3, 12), y = 9 + rng.int(0, 2); if (img.col(x, y) !== null) img.set(x, y, w[4]); }
  img.outline(() => w[0]);
  return img;
}

export function log(seed = 1) {
  const img = new Img(32, 16);
  const w = R.wood;
  img.roundRect(2, 4, 28, 10, 4, w[3]);
  for (let y = 4; y < 14; y++) for (let x = 2; x < 30; x++) {
    if (img.col(x, y) === null) continue;
    const t = (y - 4) / 9;
    img.set(x, y, t < 0.22 ? w[5] : t < 0.5 ? w[4] : t < 0.78 ? w[3] : w[2]);
  }
  img.ellipse(4.5, 9, 2.5, 5, w[5]);
  img.ellipse(4.5, 9, 1.6, 3.4, w[4]);
  img.ellipse(4.5, 9, 0.8, 1.6, w[5]);
  const rng = new Rng(seed);
  for (let i = 0; i < 10; i++) { const x = rng.int(9, 28), y = rng.int(6, 12); if (img.col(x, y) !== null) img.set(x, y, w[2]); }
  img.outline(() => w[0]);
  return img;
}
