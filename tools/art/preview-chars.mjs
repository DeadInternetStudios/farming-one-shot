import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import { R } from './palette.mjs';
import * as C from './gen/characters.mjs';

const player = { skin: R.skin2, hair: R.hairBrown, hairStyle: 'short', shirt: R.teal, pants: R.wood, shoes: R.wood, hat: 'straw' };
const items = [];
for (const dir of ['down', 'up', 'side']) {
  const poses = dir === 'side' ? C.WALK_SIDE : C.WALK;
  poses.forEach((p, i) => items.push({ name: `${dir}-${i}`, img: C.frame(player, dir, p) }));
}
const styles = ['short', 'bob', 'long', 'messy', 'bun', 'curly', 'ponytail'];
styles.forEach((st, i) => {
  const spec = { skin: [R.skin1, R.skin2, R.skin3, R.skin4][i % 4], hair: [R.hairBlack, R.hairBlonde, R.hairAuburn, R.hairSilver, R.hairPink, R.hairTeal, R.hairBrown][i], hairStyle: st, shirt: [R.red, R.purple, R.yellow, R.blue, R.pink, R.leaf, R.orange][i], pants: [R.wood, R.blue, R.stone, R.wood, R.teal, R.wood, R.stone][i], shoes: R.wood };
  items.push({ name: st + '-d', img: C.frame(spec, 'down', C.WALK[0]) });
  items.push({ name: st + '-s', img: C.frame(spec, 'side', C.WALK_SIDE[1]) });
  items.push({ name: st + '-u', img: C.frame(spec, 'up', C.WALK[1]) });
});
// tool poses
const tools = new Img(32, 32);
const toolItems = [];
for (const [t, ang] of [['hoe', 60], ['axe', 40], ['pick', 50], ['can', 20], ['scythe', 70]]) {
  const f = C.frame(player, 'side', { bob: 0, legF: 0, legB: 0, armX: 2 });
  C.drawTool(f, t, 22, 21, ang);
  toolItems.push({ name: t, img: f });
}
const out = sheet(items.concat(toolItems), { cols: 8, scale: 5, cellW: 32, cellH: 32 });
writePNG('.100x/art/chars.png', out);
console.log('wrote', out.w, out.h);
