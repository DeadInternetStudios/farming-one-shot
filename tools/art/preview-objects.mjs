import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import * as O from './gen/objects.mjs';

const items = [];
for (const s of ['spring', 'summer', 'fall', 'winter']) items.push({ name: 'tree-' + s, img: O.tree(s, 1) });
items.push({ name: 'tree-summer-2', img: O.tree('summer', 5) });
for (const s of ['spring', 'summer', 'fall', 'winter']) items.push({ name: 'bush-' + s, img: O.bush(s, 2) });
items.push({ name: 'stump', img: O.stump(1) }, { name: 'rock', img: O.rock('small', 1) }, { name: 'boulder', img: O.rock('big', 2) });
items.push({ name: 'weed', img: O.weed(1) }, { name: 'weed-fall', img: O.weed(2, 'fall') }, { name: 'tallgrass0', img: O.tallGrass(0) }, { name: 'tallgrass1', img: O.tallGrass(1) });
for (const k of ['daisy', 'tulip', 'bell', 'sun', 'lav', 'cosmos']) items.push({ name: 'flower-' + k, img: O.flowerPatch(k, 3) });
for (const m of [0, 2, 10, 8, 5, 15, 3, 6]) items.push({ name: 'fence-' + m, img: O.fence(m) });
items.push({ name: 'branch', img: O.branch(1) }, { name: 'log', img: O.log(1) });

const out = sheet(items, { cols: 9, scale: 3, cellW: 48, cellH: 64 });
writePNG('.100x/art/objects.png', out);
console.log('wrote objects.png', out.w, out.h);
