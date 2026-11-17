import { writePNG } from './png.mjs';
import { Img } from './px.mjs';
import { sheet } from './atlas.mjs';
import * as B from './gen/buildings.mjs';
const h = B.farmhouse();
const night = h.day.clone();
night.blit(h.glow, 0, 0);
const bin = B.shippingBin();
const lp = B.lanternPost();
const items = [
  { name: 'house', img: h.day }, { name: 'house-lit', img: night },
  { name: 'bin', img: bin.closed }, { name: 'bin-open', img: bin.open },
  { name: 'lamp', img: lp.day }, { name: 'sign', img: B.sign() },
];
writePNG('.100x/art/buildings.png', sheet(items, { cols: 3, scale: 5 }));
console.log('ok');
