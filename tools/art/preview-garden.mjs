import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import { R } from './palette.mjs';
import * as G from './gen/garden.mjs';

const items = [];
const lit = (d) => { const o = d.day.clone(); o.blit(d.glow, 0, 0); return o; };
for (const [k, c] of Object.entries({ red: R.red, gold: R.yellow, teal: R.teal, pink: R.pink })) {
  const l = G.paperLantern(c);
  items.push({ name: `lantern-${k}`, img: l.day }, { name: `${k}-lit`, img: lit(l) });
}
const sl = G.stoneLantern(); items.push({ name: 'stone', img: sl.day }, { name: 'stone-lit', img: lit(sl) });
for (const s of ['spring', 'summer', 'fall', 'winter']) items.push({ name: `planter-${s}`, img: G.planter(s) });
items.push({ name: 'birdbath', img: G.birdBath() });
const gn = G.gnome(); items.push({ name: 'gnome', img: gn.day }, { name: 'gnome-lit', img: lit(gn) });
for (const it of [...items]) if (!it.name.endsWith('-lit')) items.push({ name: `icon`, img: G.icon(it.img) });
const out = sheet(items, { cols: 8, scale: 6, cellW: 20, cellH: 30 });
writePNG('.100x/art/garden.png', out);
console.log('wrote garden.png', out.w, out.h);
