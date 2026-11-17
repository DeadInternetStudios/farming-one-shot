// Crops: growth stage sprites for every crop in src/data/crops.json. 16 x 32, soil line at y = 29.
import { Img, step } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';

const W = 16, H = 32, BASE = 29, CX = 8;

// A leaf: tapered blade from (x, y) at angle (deg, -90 = straight up), with droop.
function blade(img, x, y, ang, len, ramp, o = {}) {
  const droop = o.droop ?? 0, wide = o.wide ?? 1;
  let a = (ang * Math.PI) / 180;
  let px = x, py = y;
  for (let t = 0; t <= len; t += 0.5) {
    const k = t / len;
    const dx = Math.cos(a), dy = Math.sin(a);
    px += dx * 0.5; py += dy * 0.5;
    a += (droop * Math.PI / 180) * (0.5 / len) * 4;
    const ix = Math.round(px), iy = Math.round(py);
    const base = k < 0.25 ? ramp[2] : k < 0.75 ? ramp[3] : ramp[4];
    img.set(ix, iy, base);
    const nx = -dy, ny = dx;
    if (k > 0.1 && k < 0.8 && wide > 0) {
      img.set(Math.round(px + nx), Math.round(py + ny), k < 0.5 ? ramp[2] : ramp[3]);
      if (wide > 1 && k > 0.2 && k < 0.65) img.set(Math.round(px - nx), Math.round(py - ny), ramp[4]);
    }
  }
}

function seedMound(img) {
  img.ellipse(8, 29.4, 4.2, 2.1, R.dirt[2]);
  img.ellipse(8, 28.8, 3.4, 1.5, R.dirt[3]);
  img.set(6, 28, R.dirt[5]); img.set(9, 28, R.dirt[4]);
  img.set(7, 29, R.cream[1]); img.set(10, 29, R.cream[0]);
  img.outline(() => R.dirt[0]);
}

function sproutPair(img, ramp, h = 5) {
  blade(img, 8, 29, -140, h, ramp, { droop: -20, wide: 1 });
  blade(img, 8, 29, -40, h, ramp, { droop: 20, wide: 1 });
}

// ----- root crops: radish, potato, yam -----
function root(stage, n, art, rng) {
  const img = new Img(W, H);
  const leaf = R[art.leaf];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const leaves = 3 + Math.round(p * 3);
  const len = 7 + p * 8;
  for (let i = 0; i < leaves; i++) {
    const a = -150 + (120 * i) / (leaves - 1);
    blade(img, 8 + (i - (leaves - 1) / 2) * 0.5, 28, a, len * rng.range(0.8, 1), leaf, { droop: a < -90 ? -9 : 9, wide: 2 });
  }
  if (stage === n - 1) {
    const rt = R[art.root], tip = R[art.tip];
    if (art.root === 'wood') { // potato lumps
      img.ellipse(6.5, 29.3, 3, 2, rt[3]); img.ellipse(10, 29.5, 2.6, 1.8, rt[4]);
      img.set(5, 28, rt[5]); img.set(9, 28, rt[5]); img.set(7, 29, rt[1]); img.set(11, 30, rt[2]);
    } else {
      img.shaded(8, 29.2, 3.4, 2.6, rt.length > 4 ? rt.slice(0, 5) : rt, { light: [-0.5, -0.9] });
      img.set(8, 27, tip[4] ?? tip[3]);
      if (art.root === 'pink') { img.hline(7, 30, 2, R.cream[3]); img.set(8, 31, R.cream[2]); }
    }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ----- leafy: cauliflower -----
function leafy(stage, n, art, rng) {
  const img = new Img(W, H);
  const leaf = R[art.leaf], head = R[art.head];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const leaves = 5;
  const len = 5 + p * 6;
  for (let i = 0; i < leaves; i++) {
    const a = -170 + (160 * i) / (leaves - 1);
    blade(img, 8, 29, a, len, leaf, { droop: a < -90 ? -35 : 35, wide: 2 });
  }
  if (stage >= 2) {
    const r = 1.8 + p * 3.6;
    img.shaded(8, 27 - p * 1, r, r * 0.9, stage === n - 1 ? head : leaf, { light: [-0.5, -0.8] });
    if (stage === n - 1) for (let i = 0; i < 7; i++) { const x = 5 + rng.int(0, 6), y = 23 + rng.int(0, 5); if (img.col(x, y) !== null) img.set(x, y, head[3]); }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ----- bush: tomato, strawberry, blueberry, pepper, eggplant, cranberry -----
function bush(stage, n, art, rng, fruitOn = true) {
  const img = new Img(W, H);
  const leaf = art.dark ? R.leaf : R[art.leaf];
  const fruit = R[art.fruit];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const tall = art.stake ? 12 + p * 9 : art.low ? 5 + p * 4 : 8 + p * 6;
  const top = BASE - tall;
  if (art.stake) { img.vline(CX - 2, top - 1, tall + 2, R.wood[3]); img.vline(CX - 1, top - 1, tall + 2, R.wood[2]); }
  img.vline(CX, top + 2, tall - 2, leaf[2]);
  const pairs = 2 + Math.round(p * 3);
  for (let i = 0; i < pairs; i++) {
    const y = BASE - 2 - (tall - 4) * (i / Math.max(1, pairs - 1));
    const len = (art.low ? 4 : 5) + rng.range(0, 2);
    blade(img, CX, y, -165 + i * 4, len, leaf, { droop: -30, wide: 2 });
    blade(img, CX, y - 1, -15 - i * 4, len, leaf, { droop: 30, wide: 2 });
  }
  if (stage >= 2 && stage < n - 1) {
    img.set(CX + 2, top + 3, R.yellow[4]); img.set(CX - 3, top + 6, R.cream[3]);
  }
  if (stage === n - 1 && fruitOn) {
    const spots = art.low
      ? [[4, 27], [10, 27], [7, 25], [12, 29], [3, 29]]
      : [[5, top + 6], [11, top + 5], [4, top + 11], [12, top + 10], [8, top + 8]];
    for (const [fx, fy] of spots) {
      if (art.fruit === 'purple') { img.shaded(fx, fy + 1.5, 1.6, 2.6, fruit, { light: [-0.5, -0.8] }); img.set(fx, fy - 1, R.leaf[3]); }
      else if (art.fruit === 'orange' && art.low) { img.ellipse(fx, fy + 1, 1.2, 2.4, fruit[3]); img.set(fx, fy - 1, fruit[4]); img.set(fx, fy + 3, fruit[1]); }
      else { img.shaded(fx, fy, 2, 2, fruit, { light: [-0.5, -0.8] }); img.set(fx - 1, fy - 1, R.cream[3]); img.set(fx, fy - 2, R.leaf[4]); }
    }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ----- vines: melon, pumpkin -----
function vine(stage, n, art, rng, fruitOn = true) {
  const img = new Img(W, H);
  const leaf = R[art.leaf], fruit = art.fruit === 'grass' ? R.grassSummer : R[art.fruit];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const spread = 3 + p * 4;
  const leaves = 3 + Math.round(p * 3);
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 ? 1 : -1;
    const lx = CX + side * (2 + (i >> 1) * 2.4), ly = 27 - (i >> 1) * 2.2 + (i % 2);
    img.ellipse(lx, ly, 3.2 + p, 2.2 + p * 0.5, null, (x, y, nx, ny) => (ny < -0.2 ? leaf[4] : ny < 0.4 ? leaf[3] : leaf[2]));
    img.set(Math.round(lx), Math.round(ly), leaf[5]);
  }
  img.vline(CX, 24 - p * 3, 6, leaf[2]);
  if (stage >= 2 && stage < n - 1) { img.set(CX + 1, 23 - p * 3, R.yellow[3]); }
  if (stage === n - 1 && fruitOn) {
    const r = 5.2;
    if (art.fruit === 'orange') {
      img.shaded(8, 26.5, r, r * 0.88, fruit, { light: [-0.5, -0.8] });
      for (const x of [5, 8, 11]) for (let y = 22; y < 31; y++) if (img.col(x, y) !== null) img.set(x, y, step(img.col(x, y), -1));
      img.rect(7, 20, 2, 3, R.leaf[3]); img.set(9, 20, R.leaf[4]);
    } else {
      img.shaded(8, 26.5, r + 0.6, r * 0.85, fruit, { light: [-0.5, -0.8] });
      const st = R[art.stripe];
      for (const x of [5, 8, 11]) for (let y = 22; y < 31; y++) if (img.col(x, y) !== null) img.set(x, y, st[1]);
      img.set(6, 23, R.cream[3]);
    }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ----- grain: wheat, corn -----
function grain(stage, n, art, rng, headOn = true) {
  const img = new Img(W, H);
  const leaf = R[art.leaf], head = R[art.head];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const ripe = stage === n - 1 && headOn;
  if (art.tall) {
    // corn: one stout stalk, alternating drooping leaves, a cob on the side
    const h = 12 + p * 14;
    const top = BASE - h;
    img.vline(CX, top, h + 1, leaf[3]);
    img.vline(CX - 1, top + 2, h - 2, leaf[2]);
    const pairs = 2 + Math.round(p * 2);
    for (let k = 0; k < pairs * 2; k++) {
      const side = k % 2 ? 1 : -1;
      const y = BASE - 3 - k * (h - 6) / (pairs * 2 - 1 || 1);
      blade(img, CX, y, side < 0 ? -168 : -12, 6.5 + (k % 3), leaf, { droop: side * 38, wide: 2 });
    }
    blade(img, CX, top + 1, -110, 4, leaf, { droop: -20, wide: 1 });
    blade(img, CX, top + 1, -70, 4, leaf, { droop: 20, wide: 1 });
    if (ripe) {
      const cy = BASE - 10;
      img.rect(CX + 1, cy - 1, 3, 6, R.leaf[3]);
      img.rect(CX + 2, cy - 2, 2, 7, R.leaf[2]);
      img.rect(CX + 1, cy, 2, 4, head[3]);
      img.set(CX + 1, cy, head[5] ?? head[4]); img.set(CX + 2, cy + 1, head[4]);
      img.set(CX + 2, cy - 3, R.dirt[3]); img.set(CX + 3, cy - 3, R.dirt[2]);
    }
    img.outline((c) => outlineOf(c));
    return img;
  }
  // wheat: a fan of stalks that ripen golden from the top
  const stalks = 5;
  const hgt = 7 + p * 9;
  for (let i = 0; i < stalks; i++) {
    const m = i - (stalks - 1) / 2;
    const h = hgt * (1 - Math.abs(m) * 0.07) * rng.range(0.92, 1);
    for (let y = 0; y <= h; y++) {
      const xx = Math.round(8 + m * 1.35 + m * 0.2 * y * 0.35);
      const gold = ripe && y > h * 0.45;
      img.set(xx, BASE - y, gold ? head[2 + (y % 2)] : leaf[2 + (y % 2)]);
      if (stage >= 2 && stage < n - 1 && y === Math.floor(h * 0.5)) img.set(xx + (m < 0 ? -1 : 1), BASE - y, leaf[4]);
    }
    if (ripe) {
      const xx = Math.round(8 + m * 1.35 + m * 0.2 * h * 0.35), ty = BASE - Math.round(h);
      img.set(xx, ty - 1, head[4]); img.set(xx, ty - 2, head[3]); img.set(xx, ty - 3, head[5] ?? head[4]);
      img.set(xx - 1, ty - 1, head[3]); img.set(xx + 1, ty, head[3]); img.set(xx - 1, ty + 1, head[4]); img.set(xx + 1, ty - 2, head[4]);
    }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

// ----- flower crops: tulip, sunflower -----
function flowerCrop(stage, n, art, rng, bloomOn = true) {
  const img = new Img(W, H);
  const leaf = R[art.leaf], bloom = R[art.bloom];
  const p = stage / (n - 1);
  if (stage === 0) { seedMound(img); return img; }
  if (stage === 1) { sproutPair(img, leaf, 5); img.outline((c) => outlineOf(c)); return img; }
  const h = (art.big ? 12 : 8) + p * (art.big ? 12 : 7);
  const top = BASE - h;
  img.vline(CX, top, h, leaf[2]);
  if (art.big) img.vline(CX + 1, top + 3, h - 3, leaf[3]);
  blade(img, CX, BASE - 4, -160, 5 + p * 2, leaf, { droop: -30, wide: 2 });
  blade(img, CX, BASE - 7, -20, 5 + p * 2, leaf, { droop: 30, wide: 2 });
  if (stage >= 2 && stage < n - 1) img.shaded(CX, top, 1.6, 1.6, leaf, {});
  if (stage === n - 1 && bloomOn) {
    if (art.big) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = CX + Math.cos(a) * 4.6, y = top - 1 + Math.sin(a) * 4.6;
        img.ellipse(x, y, 1.5, 1.5, bloom[k % 2 ? 3 : 4]);
      }
      img.shaded(CX, top - 1, 3.1, 3.1, R.wood, { light: [-0.5, -0.8] });
      img.set(CX - 1, top - 2, R.wood[4]);
    } else {
      img.ellipse(CX, top - 1, 2.8, 3.2, bloom[3]);
      img.ellipse(CX, top - 1, 2.8, 3.2, null, (x, y, nx, ny) => (nx < -0.2 ? bloom[4] : nx > 0.4 ? bloom[2] : undefined));
      img.set(CX, top - 4, bloom[3]); img.set(CX - 2, top - 3, bloom[4]); img.set(CX + 2, top - 3, bloom[3]);
      img.hline(CX - 1, top + 1, 3, bloom[1]);
    }
  }
  img.outline((c) => outlineOf(c));
  return img;
}

const TYPES = { root, leafy, bush, vine, grain, flower: flowerCrop };

export function cropStages(crop) {
  return Math.min(6, Math.max(4, crop.days + 1));
}

// Returns { stages: Img[], regrow: Img, dead: Img }
export function cropSprites(crop, seed = 1) {
  const fn = TYPES[crop.art.type];
  const n = cropStages(crop);
  const stages = [];
  for (let s = 0; s < n; s++) stages.push(fn(s, n, crop.art, new Rng(seed * 100 + s * 7 + crop.id.length), true));
  const regrow = fn(Math.max(2, n - 2), n, crop.art, new Rng(seed * 100 + 99), false);
  const dead = stages[Math.max(2, n - 2)].clone().mapColors((c) => {
    const leafLike = [R.leaf, R.grassSummer, R.grass].some((r) => r.includes(c));
    if (leafLike) {
      const rr = [R.leaf, R.grassSummer, R.grass].find((r) => r.includes(c));
      return R.dirt[Math.min(5, Math.max(1, rr.indexOf(c) - 1))];
    }
    return c;
  });
  return { stages, regrow, dead };
}
