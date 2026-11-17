// Pixel image toolkit. Colours are 0xRRGGBB numbers, null means clear.
// Shapes use pixel-centre tests, so a centre on a whole number gives perfectly symmetric shapes.
import { bayer4 } from './rng.mjs';
import { rampOf } from './palette.mjs';

export class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  clone() {
    const o = new Img(this.w, this.h);
    o.d.set(this.d);
    return o;
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  set(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (!this.inb(x, y)) return this;
    const i = (y * this.w + x) * 4;
    if (c === null || c === undefined) { this.d[i] = this.d[i + 1] = this.d[i + 2] = this.d[i + 3] = 0; return this; }
    this.d[i] = (c >> 16) & 255; this.d[i + 1] = (c >> 8) & 255; this.d[i + 2] = c & 255; this.d[i + 3] = a;
    return this;
  }

  // Alpha composite one colour over what is there.
  over(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (!this.inb(x, y) || c === null) return this;
    const i = (y * this.w + x) * 4;
    const da = this.d[i + 3];
    if (a >= 255 || da === 0) { return this.set(x, y, c, a); }
    const sa = a / 255, dA = da / 255;
    const oa = sa + dA * (1 - sa);
    const r = (((c >> 16) & 255) * sa + this.d[i] * dA * (1 - sa)) / oa;
    const g = (((c >> 8) & 255) * sa + this.d[i + 1] * dA * (1 - sa)) / oa;
    const b = ((c & 255) * sa + this.d[i + 2] * dA * (1 - sa)) / oa;
    this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = oa * 255;
    return this;
  }

  alphaAt(x, y) { return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  solid(x, y) { return this.alphaAt(x, y) > 0; }

  col(x, y) {
    if (!this.inb(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (this.d[i + 3] === 0) return null;
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }

  fill(c) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c); return this; }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  hline(x, y, w, c) { for (let i = 0; i < w; i++) this.set(x + i, y, c); return this; }
  vline(x, y, h, c) { for (let j = 0; j < h; j++) this.set(x, y + j, c); return this; }
  frame(x, y, w, h, c) {
    this.hline(x, y, w, c); this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c); this.vline(x + w - 1, y, h, c);
    return this;
  }

  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  // Filled ellipse. cx, cy are in pixel-edge coordinates.
  ellipse(cx, cy, rx, ry, c, fn) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          const col = fn ? fn(x, y, nx, ny) : c;
          if (col !== undefined) this.set(x, y, col);
        }
      }
    }
    return this;
  }
  disc(cx, cy, r, c, fn) { return this.ellipse(cx, cy, r, r, c, fn); }

  // A round-cornered rectangle.
  roundRect(x, y, w, h, r, c) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let ok = true;
        const cx = i < r ? r : i >= w - r ? w - r : null;
        const cy = j < r ? r : j >= h - r ? h - r : null;
        if (cx !== null && cy !== null) {
          const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
          ok = dx * dx + dy * dy <= r * r;
        }
        if (ok) this.set(x + i, y + j, c);
      }
    }
    return this;
  }

  // Even-odd polygon fill using pixel centres.
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  // A sphere-lit ellipse using a ramp (dark to light) and ordered dither.
  // light is the direction the light comes from, in unit-ish x, y (negative = left, up).
  shaded(cx, cy, rx, ry, ramp, o = {}) {
    const lx = o.light ? o.light[0] : -0.55, ly = o.light ? o.light[1] : -0.75;
    const lz = o.lz ?? 0.55;
    const ln = Math.hypot(lx, ly, lz);
    const dither = o.dither ?? 0.55;
    const lo = o.lo ?? 0.0, hi = o.hi ?? 1.0;
    const n = ramp.length;
    return this.ellipse(cx, cy, rx, ry, null, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = (nx * lx + ny * ly + nz * lz) / ln;
      v = (v * 0.5 + 0.5);
      v = lo + (hi - lo) * v;
      let f = v * (n - 1);
      f += (bayer4(x, y) - 0.5) * dither;
      const idx = Math.max(0, Math.min(n - 1, Math.round(f)));
      return ramp[idx];
    });
  }

  // Copy src onto this at dx, dy.
  blit(src, dx, dy, o = {}) {
    const alpha = o.alpha ?? 1;
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = o.flipX ? src.w - 1 - x : x;
        const sy = o.flipY ? src.h - 1 - y : y;
        const i = (sy * src.w + sx) * 4;
        const a = src.d[i + 3];
        if (a === 0) continue;
        const tx = dx + x, ty = dy + y;
        if (!this.inb(tx, ty)) continue;
        if (o.under && this.alphaAt(tx, ty) > 0) continue;
        const col = o.color !== undefined ? o.color : (src.d[i] << 16) | (src.d[i + 1] << 8) | src.d[i + 2];
        this.over(tx, ty, col, Math.round(a * alpha));
      }
    }
    return this;
  }

  sub(x, y, w, h) {
    const o = new Img(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!this.inb(x + i, y + j)) continue;
      const s = ((y + j) * this.w + x + i) * 4, t = (j * w + i) * 4;
      o.d[t] = this.d[s]; o.d[t + 1] = this.d[s + 1]; o.d[t + 2] = this.d[s + 2]; o.d[t + 3] = this.d[s + 3];
    }
    return o;
  }

  flipH() {
    const o = new Img(this.w, this.h);
    o.blit(this, 0, 0, { flipX: true });
    return o;
  }

  pad(l, t, r, b) {
    const o = new Img(this.w + l + r, this.h + t + b);
    o.blit(this, l, t);
    return o;
  }

  scale(n) {
    const o = new Img(this.w * n, this.h * n);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const s = (Math.floor(y / n) * this.w + Math.floor(x / n)) * 4, t = (y * o.w + x) * 4;
      o.d[t] = this.d[s]; o.d[t + 1] = this.d[s + 1]; o.d[t + 2] = this.d[s + 2]; o.d[t + 3] = this.d[s + 3];
    }
    return o;
  }

  // Bounding box of non-clear pixels, or null for an empty image.
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.d[(y * this.w + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Add an outline of clear pixels next to solid ones. colour is a number or a function of the neighbour colour.
  outline(color, o = {}) {
    const diag = o.diag ?? false;
    const todo = [];
    for (let y = -1; y <= this.h; y++) for (let x = -1; x <= this.w; x++) {
      if (!this.inb(x, y) || this.solid(x, y)) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      if (diag) nb.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
      let found = null;
      for (const [dx, dy] of nb) if (this.solid(x + dx, y + dy)) { found = this.col(x + dx, y + dy); if (!o.preferBelow || dy === -1) break; }
      if (found !== null) todo.push([x, y, typeof color === 'function' ? color(found, x, y) : color]);
    }
    for (const [x, y, c] of todo) this.set(x, y, c);
    return this;
  }

  // Replace every colour of a ramp by the same step of another ramp. Lengths may differ.
  swapRamp(from, to) {
    const map = new Map();
    from.forEach((c, i) => map.set(c, to[Math.round((i * (to.length - 1)) / Math.max(1, from.length - 1))]));
    return this.mapColors((c) => (map.has(c) ? map.get(c) : c));
  }

  mapColors(fn) {
    for (let i = 0; i < this.d.length; i += 4) {
      if (this.d[i + 3] === 0) continue;
      const c = (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
      const n = fn(c);
      if (n === c) continue;
      this.d[i] = (n >> 16) & 255; this.d[i + 1] = (n >> 8) & 255; this.d[i + 2] = n & 255;
    }
    return this;
  }

  silhouette(c) { return this.mapColors(() => c); }

  // Grow the image edge by n pixels in every direction by copying the border pixel.
  // Atlas frames and tilesets use it so scaling never bleeds a neighbour in.
  extrude(n) {
    const o = new Img(this.w + 2 * n, this.h + 2 * n);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const sx = Math.min(this.w - 1, Math.max(0, x - n)), sy = Math.min(this.h - 1, Math.max(0, y - n));
      const s = (sy * this.w + sx) * 4, t = (y * o.w + x) * 4;
      o.d[t] = this.d[s]; o.d[t + 1] = this.d[s + 1]; o.d[t + 2] = this.d[s + 2]; o.d[t + 3] = this.d[s + 3];
    }
    return o;
  }

  // Colours used, as a Set of 0xRRGGBB numbers.
  colors() {
    const s = new Set();
    for (let i = 0; i < this.d.length; i += 4) if (this.d[i + 3] > 0) s.add((this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]);
    return s;
  }

  // Build from rows of characters. key maps a character to a colour. '.' and ' ' are clear.
  static ascii(rows, key) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const o = new Img(w, h);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      if (!(ch in key)) throw new Error('ascii: no colour for "' + ch + '"');
      o.set(x, y, key[ch]);
    }));
    return o;
  }
}

// Shade a ramp colour: step down (negative) or up (positive) within its own ramp.
export function step(c, n) {
  const e = rampOf(c);
  if (!e) return c;
  return e.ramp[Math.max(0, Math.min(e.ramp.length - 1, e.i + n))];
}
