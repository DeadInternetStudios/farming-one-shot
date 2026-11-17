import { readFileSync } from 'node:fs';
import { writePNG } from './png.mjs';
import { Img } from './px.mjs';
import { sheet } from './atlas.mjs';
import { R } from './palette.mjs';
import * as TR from './gen/terrain.mjs';
import { cropSprites } from './gen/crops.mjs';

const crops = JSON.parse(readFileSync('src/data/crops.json', 'utf8'));
const items = [];
for (const c of crops) {
  const { stages, regrow, dead } = cropSprites(c);
  stages.forEach((s, i) => {
    const t = new Img(16, 32);
    // soil tile under the plant so it reads right
    t.blit(TR.fullTile(TR.soilInterior(i % 2 === 1)), 0, 16);
    t.blit(s, 0, 0);
    items.push({ name: c.id.slice(0, 6) + i, img: t });
  });
  const tr = new Img(16, 32); tr.blit(TR.fullTile(TR.soilInterior(false)), 0, 16); tr.blit(regrow, 0, 0);
  items.push({ name: c.id.slice(0, 5) + 'RG', img: tr });
  const td = new Img(16, 32); td.blit(TR.fullTile(TR.soilInterior(false)), 0, 16); td.blit(dead, 0, 0);
  items.push({ name: c.id.slice(0, 5) + 'DD', img: td });
}
const out = sheet(items, { cols: 16, scale: 3, label: true });
writePNG('.100x/art/crops.png', out);
console.log('wrote', out.w, out.h, items.length);
