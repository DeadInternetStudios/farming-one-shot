import { writePNG } from './png.mjs';
import { Img } from './px.mjs';
import { sheet } from './atlas.mjs';
import { R } from './palette.mjs';
import * as IN from './gen/interior.mjs';

const items = [];
const add = (name, img) => items.push({ name, img });
for (let v = 0; v < 3; v++) { add(`wood${v}`, IN.floorWood(v)); add(`check${v}`, IN.floorCheck(v)); add(`stone${v}`, IN.floorStone(v)); }
for (const th of IN.WALL_THEMES) { add(`${th}0`, IN.wallRow(th, 0)); add(`${th}1`, IN.wallRow(th, 1)); }
add('capL', IN.capL()); add('capB', IN.capB()); add('capBL', IN.capBL());
writePNG('.100x/art/interior-tiles.png', sheet(items, { cols: 9, scale: 4 }));

const st = IN.stove(), fp = IN.fireplace(), hl = IN.hangLamp();
const lit = (p) => { const i = p.day.clone(); i.blit(p.glow, 0, 0); return i; };
const f = [];
const fa = (name, img) => f.push({ name, img });
fa('bed-pink', IN.bed(R.blossom)); fa('bed-teal', IN.bed(R.teal)); fa('table', IN.table(32)); fa('table-long', IN.table(48, false));
fa('chair', IN.chair()); fa('chair-t', IN.chair(R.teal)); fa('stove', st.day); fa('stove-lit', lit(st));
fa('counter', IN.counter()); fa('shelf', IN.bookshelf()); fa('chest', IN.chest(false)); fa('chest-o', IN.chest(true));
fa('rug', IN.rug(48, 32)); fa('rug-t', IN.rug(32, 32, R.teal)); fa('win-day', IN.windowPiece(false)); fa('win-night', IN.windowPiece(true));
for (let k = 0; k < 3; k++) fa(`plant${k}`, IN.plant(k));
for (let k = 0; k < 3; k++) fa(`pic${k}`, IN.picture(k));
fa('mat', IN.doorMat()); fa('fire', fp.day); fa('fire-lit', lit(fp)); fa('lamp', hl.day); fa('lamp-lit', lit(hl));
writePNG('.100x/art/interior-props.png', sheet(f, { cols: 7, scale: 4 }));
console.log('ok');
