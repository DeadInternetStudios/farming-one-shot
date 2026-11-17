// Seeded random numbers and hash noise. Everything the art scripts draw is deterministic.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function strSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed = 1) {
    this.f = mulberry32(typeof seed === 'string' ? strSeed(seed) : seed);
  }
  next() { return this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  range(a, b) { return a + this.f() * (b - a); }
  chance(p) { return this.f() < p; }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// Integer hash to 0..1, stable for any x, y, seed.
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Value noise that repeats every `period` cells, so tiles built from it join seamlessly.
export function tileNoise(x, y, period, seed = 0, freq = 4) {
  const cells = Math.max(1, Math.round(period / freq));
  const fx = (x / period) * cells;
  const fy = (y / period) * cells;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const g = (cx, cy) => hash2(((cx % cells) + cells) % cells, ((cy % cells) + cells) % cells, seed);
  const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// 4x4 Bayer matrix, 0..15 mapped to 0..1, for ordered dithering.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer4(x, y) {
  return (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}
