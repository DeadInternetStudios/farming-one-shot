import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import { R } from './palette.mjs';
import * as U from './gen/ui.mjs';

const items = [];
for (const [bgName, bg] of [['wood', R.wood[2]], ['leaf', R.leaf[3]]]) {
  for (const k of ['bag', 'craft', 'lantern', 'friends', 'options']) {
    const tile = new Img(16, 16).fill(bg);
    tile.blit(U.tabIcon(k), 2, 2);
    items.push({ name: `${bgName}-${k}`, img: tile });
  }
}
const out = sheet(items, { cols: 5, scale: 8, cellW: 16, cellH: 16 });
writePNG('.100x/art/tabs.png', out);
console.log('wrote tabs.png', out.w, out.h);
