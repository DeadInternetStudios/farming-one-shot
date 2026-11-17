// Atlas packer and contact sheet builder.
import { Img } from './px.mjs';
import { drawText, textWidth } from './font.mjs';
import { R } from './palette.mjs';

const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

// items: [{ name, img }]. Every frame is extruded by 1 px, so scaled or filtered
// drawing never picks up a neighbour. The frame rect covers only the real pixels.
export function packAtlas(items, { maxW = 1024, pad = 2, extrude = 1, imageName = 'atlas.png' } = {}) {
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.name)) throw new Error('atlas: duplicate frame name ' + it.name);
    seen.add(it.name);
  }
  const order = items.slice().sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w || (a.name < b.name ? -1 : 1));
  let x = pad, y = pad, rowH = 0, usedW = 0;
  const placed = [];
  for (const it of order) {
    const w = it.img.w + 2 * extrude, h = it.img.h + 2 * extrude;
    if (x + w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
    placed.push({ it, x, y });
    x += w + pad;
    rowH = Math.max(rowH, h);
    usedW = Math.max(usedW, x);
  }
  const W = pow2(Math.max(usedW, 16)), H = pow2(y + rowH + pad);
  const atlas = new Img(W, H);
  const frames = {};
  for (const p of placed) {
    atlas.blit(p.it.img.extrude(extrude), p.x, p.y);
    frames[p.it.name] = {
      frame: { x: p.x + extrude, y: p.y + extrude, w: p.it.img.w, h: p.it.img.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.it.img.w, h: p.it.img.h },
      sourceSize: { w: p.it.img.w, h: p.it.img.h },
    };
  }
  const json = { frames, meta: { app: 'lantern-hollow-art', image: imageName, format: 'RGBA8888', size: { w: W, h: H }, scale: '1' } };
  return { atlas, json, frames };
}

// A labelled contact sheet for looking at art. Everything is composed at 1x then enlarged,
// so labels stay crisp and pixel sizes are honest.
export function sheet(items, { cols = 8, scale = 3, pad = 3, bg = R.ink[1], bg2 = R.ink[1] + 0x050505, label = true, cellW, cellH } = {}) {
  const cw = (cellW ?? Math.max(...items.map((i) => i.img.w))) + pad * 2;
  const ch = (cellH ?? Math.max(...items.map((i) => i.img.h))) + pad * 2 + (label ? 9 : 0);
  const rows = Math.ceil(items.length / cols);
  const out = new Img(cols * cw, rows * ch);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.set(x, y, ((x >> 3) + (y >> 3)) & 1 ? bg : bg2);
  items.forEach((it, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
    out.blit(it.img, cx + pad + Math.floor(((cellW ?? it.img.w) - it.img.w) / 2), cy + pad + ((cellH ?? it.img.h) - it.img.h));
    if (label) {
      let name = it.name;
      const maxChars = Math.floor((cw - 2) / 4);
      if (name.length > maxChars) name = name.slice(name.length - maxChars);
      drawText(out, cx + 1, cy + ch - 9, name, R.cream[2]);
    }
  });
  return scale > 1 ? out.scale(scale) : out;
}
