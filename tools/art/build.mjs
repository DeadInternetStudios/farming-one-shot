// Builds every image the game uses, from code. Run: npm run art
// Writes public/assets/*.png and *.json, plus src/gen/art.ts (frame lists and tile ids).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Img } from './px.mjs';
import { writePNG } from './png.mjs';
import { packAtlas } from './atlas.mjs';
import { R, mix } from './palette.mjs';
import { buildFont } from './font.mjs';
import * as TR from './gen/terrain.mjs';
import * as O from './gen/objects.mjs';
import * as C from './gen/characters.mjs';
import * as CR from './gen/crops.mjs';
import * as B from './gen/buildings.mjs';
import * as I from './gen/items.mjs';
import * as U from './gen/ui.mjs';
import * as FX from './gen/fx.mjs';
import * as IN from './gen/interior.mjs';
import * as V from './gen/village.mjs';
import * as N from './gen/npcs.mjs';
import * as MA from './gen/machines.mjs';
import * as W from './gen/wild.mjs';
import * as T from './gen/title.mjs';
import * as GA from './gen/garden.mjs';
import * as AI from './gen/appicon.mjs';

const OUT = 'public/assets';
mkdirSync(OUT, { recursive: true });
mkdirSync('src/gen', { recursive: true });

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const crops = JSON.parse(readFileSync('src/data/crops.json', 'utf8'));
const manifest = { frames: {}, counts: {} };
const count = (k, n) => { manifest.counts[k] = n; };

// ---------------------------------------------------------------- tilesets
const TILE_COLS = 24;
const plankInterior = (x, y) => {
  const row = Math.floor(y / 4) % 4, inRow = y % 4;
  if (inRow === 3) return R.wood[1];
  if (inRow === 0) return R.wood[4];
  const off = (row * 5) % 16;
  if ((x + off) % 16 === 0 && inRow === 1) return R.wood[1];
  return row % 2 ? R.wood[3] : R.wood[2];
};
const plankRim = (e) => (e.d === 0 ? (e.top ? R.wood[5] : R.wood[1]) : undefined);
const frost = (img, t) => img.mapColors((c) => mix(c, R.snow[3], t));

function blobSet(opts, extra = []) {
  const set = TR.BLOB_MASKS.map((m) => (m === 255 ? TR.fullTile(opts.fullInterior ?? opts.interior) : TR.blobTile(m, opts)));
  return { set, extra };
}

function buildTileset(season) {
  const ramp = season === 'fall' ? R.grassFall : season === 'summer' ? R.grassSummer : R.grass;
  const land = (v) => (season === 'winter' ? TR.snowInterior(v) : TR.grassInterior(v, ramp));
  const tiles = [];
  const push = (arr) => arr.forEach((t) => tiles.push(t));
  const landOpts = { interior: land(0), rim: TR.bankRim, rimDepth: 2, outer: TR.bankOuter };
  push(blobSet(landOpts).set);
  for (let v = 1; v <= 5; v++) tiles.push(TR.fullTile(land(v)));
  const tint = (arr) => (season === 'winter' ? arr.map((t) => frost(t.clone(), 0.32)) : arr);
  push(tint(blobSet({ interior: TR.pathInterior(1), rim: TR.pathRim }).set));
  push(tint(blobSet({ interior: TR.cobbleInterior(1), rim: TR.cobbleRim }).set));
  push(tint(blobSet({ interior: TR.soilInterior(false), rim: TR.soilRim(false) }).set));
  push(tint(blobSet({ interior: TR.soilInterior(true), rim: TR.soilRim(true) }).set));
  push(blobSet({ interior: TR.sandInterior(0), rim: TR.bankRim, rimDepth: 2, outer: TR.bankOuter }).set);
  for (let v = 1; v <= 5; v++) tiles.push(TR.fullTile(TR.sandInterior(v)));
  push(blobSet({ interior: plankInterior, rim: plankRim, outer: (e) => (e.below ? { c: R.ink[1], a: 110 } : null) }).set);

  const rows = Math.ceil(tiles.length / TILE_COLS);
  const img = new Img(TILE_COLS * 18, rows * 18);
  tiles.forEach((t, i) => img.blit(t.extrude(1), (i % TILE_COLS) * 18, Math.floor(i / TILE_COLS) * 18));
  writePNG(`${OUT}/tiles-${season}.png`, img);
  return tiles.length;
}
const tileCount = SEASONS.map(buildTileset)[0];

// interior tileset: floors, outer wall caps, themed wall rows, soft shadows
const INTERIOR_IDS = {};
{
  const tiles = [];
  const add = (img) => { tiles.push(img); return tiles.length - 1; };
  INTERIOR_IDS.floorWood = [0, 1, 2].map((v) => add(IN.floorWood(v)));
  INTERIOR_IDS.floorCheck = [0, 1, 2].map((v) => add(IN.floorCheck(v)));
  INTERIOR_IDS.floorStone = [0, 1, 2].map((v) => add(IN.floorStone(v)));
  INTERIOR_IDS.capL = add(IN.capL()); INTERIOR_IDS.capR = add(IN.capR()); INTERIOR_IDS.capB = add(IN.capB());
  INTERIOR_IDS.capBL = add(IN.capBL()); INTERIOR_IDS.capBR = add(IN.capBR());
  INTERIOR_IDS.wall = {};
  for (const th of IN.WALL_THEMES) {
    INTERIOR_IDS.wall[th] = {
      r0: add(IN.wallRow(th, 0)), r1: add(IN.wallRow(th, 1)),
      r0L: add(IN.wallRow(th, 0, 'L')), r0R: add(IN.wallRow(th, 0, 'R')),
      r1L: add(IN.wallRow(th, 1, 'L')), r1R: add(IN.wallRow(th, 1, 'R')),
    };
  }
  const sh = IN.shadows();
  INTERIOR_IDS.shadow = { L: add(sh.L), R: add(sh.R), T: add(sh.T), TL: add(sh.TL), TR: add(sh.TR) };
  const rows = Math.ceil(tiles.length / TILE_COLS);
  const img = new Img(TILE_COLS * 18, rows * 18);
  tiles.forEach((t, i) => img.blit(t.extrude(1), (i % TILE_COLS) * 18, Math.floor(i / TILE_COLS) * 18));
  writePNG(`${OUT}/tiles-interior.png`, img);
}

// cave tileset: floors shaded toward walls (mask bits: 1 wall above, 2 left, 4 right), rock mass, wall faces, ladders
const CAVE_IDS = {};
{
  const tiles = [];
  const add = (img) => { tiles.push(img); return tiles.length - 1; };
  CAVE_IDS.floor = [0, 1, 2, 3].map((v) => Array.from({ length: 8 }, (_, m) => add(W.caveFloor(v, m))));
  CAVE_IDS.mass = [0, 1, 2].map((v) => add(W.caveMass(v)));
  CAVE_IDS.face = [0, 1, 2].map((v) => add(W.caveFace(v)));
  CAVE_IDS.hole = add(W.caveHole());
  CAVE_IDS.up = add(W.caveLadderUp());
  const rows = Math.ceil(tiles.length / TILE_COLS);
  const img = new Img(TILE_COLS * 18, rows * 18);
  tiles.forEach((t, i) => img.blit(t.extrude(1), (i % TILE_COLS) * 18, Math.floor(i / TILE_COLS) * 18));
  writePNG(`${OUT}/tiles-cave.png`, img);
}

const FULL = TR.BLOB_INDEX[255];
const tileIds = {
  grass: 0, grassFull: [FULL, 47, 48, 49, 50, 51],
  path: 52, cobble: 99, soilDry: 146, soilWet: 193,
  sand: 240, sandFull: [240 + FULL, 287, 288, 289, 290, 291],
  plank: 292,
};

// water, six looping frames
{
  const frames = TR.waterFrames(6, 64);
  const items = frames.map((img, i) => ({ name: `water-${i}`, img }));
  const { atlas, json } = packAtlas(items, { maxW: 256, pad: 0, extrude: 0, imageName: 'water.png' });
  writePNG(`${OUT}/water.png`, atlas);
  writeFileSync(`${OUT}/water.json`, JSON.stringify(json));
}

// ---------------------------------------------------------------- world atlas
const A = [];
const add = (name, img) => A.push({ name, img });

for (const s of SEASONS) {
  for (let v = 0; v < 3; v++) add(`tree/${s}/${v}`, O.tree(s, v * 3 + 1));
  for (let v = 0; v < 3; v++) add(`bush/${s}/${v}`, O.bush(s, v + 2));
  add(`stump/${s}`, O.stump(1, s === 'winter'));
  for (let v = 0; v < 3; v++) add(`weed/${s}/${v}`, O.weed(v + 1, s));
  for (let f = 0; f < 4; f++) add(`tallgrass/${s}/${f}`, O.tallGrass(f, s));
}
count('tree', 3); count('bush', 3); count('weed', 3);
for (let v = 0; v < 3; v++) add(`rock/small/${v}`, O.rock('small', v + 1));
for (let v = 0; v < 2; v++) add(`rock/big/${v}`, O.rock('big', v + 2));
count('rockSmall', 3); count('rockBig', 2);
const ORES = { copper: R.orange, iron: R.teal, gold: R.yellow, crystal: R.purple };
for (const [k, c] of Object.entries(ORES)) add(`ore/${k}`, O.ore(c));
for (const k of ['daisy', 'tulip', 'bell', 'sun', 'lav', 'cosmos']) for (let v = 0; v < 2; v++) add(`flower/${k}/${v}`, O.flowerPatch(k, v + 1));
for (let m = 0; m < 16; m++) add(`fence/${m}`, O.fence(m));
for (let v = 0; v < 3; v++) add(`branch/${v}`, O.branch(v + 1));
add('log/0', O.log(1)); add('log/1', O.log(2));

// crops: stages, regrow, dead
const cropFrames = {};
for (const c of crops) {
  const { stages, regrow, dead } = CR.cropSprites(c);
  stages.forEach((img, i) => add(`crop/${c.id}/${i}`, img));
  add(`crop/${c.id}/regrow`, regrow); add(`crop/${c.id}/dead`, dead);
  cropFrames[c.id] = stages.length;
}

// buildings
{
  const h = B.farmhouse();
  add('building/farmhouse', h.day); add('building/farmhouse-glow', h.glow);
  const bin = B.shippingBin();
  add('building/bin', bin.closed); add('building/bin-open', bin.open);
  const lp = B.lanternPost();
  add('prop/lamp', lp.day); add('prop/lamp-glow', lp.glow);
  add('prop/sign', B.sign());
}

// interior furniture
{
  add('int/bed-pink', IN.bed(R.blossom)); add('int/bed-teal', IN.bed(R.teal));
  add('int/table', IN.table(32)); add('int/table-long', IN.table(48, false));
  add('int/chair', IN.chair()); add('int/chair-teal', IN.chair(R.teal));
  const st = IN.stove(); add('int/stove', st.day); add('int/stove-glow', st.glow);
  add('int/counter', IN.counter()); add('int/bookshelf', IN.bookshelf());
  add('int/chest', IN.chest(false)); add('int/chest-open', IN.chest(true));
  add('int/rug-red', IN.rug(48, 32, R.red, R.cream)); add('int/rug-teal', IN.rug(32, 32, R.teal, R.cream));
  add('int/window-day', IN.windowPiece(false)); add('int/window-night', IN.windowPiece(true));
  add('int/plant-0', IN.plant(0)); add('int/plant-1', IN.plant(1)); add('int/plant-2', IN.plant(2));
  for (let k = 0; k < 3; k++) add(`int/picture-${k}`, IN.picture(k));
  add('int/mat', IN.doorMat());
  add('bg/timber', IN.timber());
  const fp = IN.fireplace(); add('int/fireplace', fp.day); add('int/fireplace-glow', fp.glow);
  const hl = IN.hangLamp(); add('int/lamp', hl.day); add('int/lamp-glow', hl.glow);
}

// village: shops, homes, the hall, the shrine and street furniture
{
  const b = (name, o) => { add(`building/${name}`, o.day); add(`building/${name}-glow`, o.glow); };
  b('store', V.store()); b('cafe', V.cafe()); b('smithy', V.smithy()); b('hall', V.hall());
  for (let k = 0; k < 3; k++) b(`home-${k}`, V.home(k));
  for (let n = 0; n <= 7; n++) { const sh = V.shrine(n); add(`shrine/${n}`, sh.day); add(`shrine/${n}-glow`, sh.glow); }
  add('prop/fountain-0', V.fountain(0)); add('prop/fountain-1', V.fountain(1));
  add('prop/bench', V.bench()); add('prop/notice', V.noticeBoard());
  add('prop/stall-red', V.stall()); add('prop/stall-blue', V.stall(R.blue, R.cream));
  add('prop/barrel', V.barrel()); add('prop/crate', V.crate()); add('prop/well', V.well());
  add('prop/hay', V.hayBale()); add('prop/scarecrow', V.scarecrow());
  add('prop/signpost-farm', V.signpost('FARM', 'left')); add('prop/signpost-lake', V.signpost('LAKE', 'right')); add('prop/signpost-forest', V.signpost('WOODS', 'left'));
  for (const sn of SEASONS) add(`prop/bunting-${sn}`, V.bunting(sn));
  for (const n of N.NPCS) add(`portrait/${n.id}`, N.portrait(n.spec));
}

// machines
{
  add('item/sprinkler', MA.sprinkler()); add('item/furnace', MA.furnaceIcon()); add('item/chest', MA.chestIcon());
  add('obj/furnace', MA.furnace(false)); add('obj/furnace-lit', MA.furnace(true)); add('obj/furnace-glow', MA.furnaceGlow());
  add('obj/sprinkler', MA.sprinklerWorld(0)); add('obj/sprinkler-on', MA.sprinklerWorld(1));
  add('obj/chest', MA.chestWorld(false)); add('obj/chest-open', MA.chestWorld(true));
}

// the wild: forage, the mine mouth, the lake hut, the coop and the animals
{
  add('forage/mushroom/0', W.mushroom(0)); add('forage/mushroom/1', W.mushroom(1));
  add('forage/berries/0', W.berries(0)); add('forage/berries/1', W.berries(1)); add('forage/clay', W.clay());
  add('prop/mine-entrance', W.mineEntrance());
  const shack = W.shack(); add('building/shack', shack.day); add('building/shack-glow', shack.glow);
  const coop = W.coop(); add('building/coop', coop.day); add('building/coop-glow', coop.glow);
  add('prop/rowboat', W.rowboat()); add('prop/egg-basket', W.eggBasket());
  for (const k of ['white', 'brown']) for (const p of ['idle', 'walk0', 'walk1', 'peck0', 'peck1']) add(`critter/hen-${k}-${p}`, W.hen(k, p));
  add('critter/chick-idle', W.chick('idle')); add('critter/chick-walk', W.chick('walk'));
  for (const p of ['sit', 'walk0', 'walk1', 'sleep']) add(`critter/cat-${p}`, W.cat(p));
  add('fx/bobber/0', W.bobber(false)); add('fx/bobber/1', W.bobber(true));
  add('ui/fish-track', W.fishTrack()); add('ui/fish-zone', W.fishZone()); add('ui/fish-meter', W.fishMeter());
  add('cave/crystal-purple', W.caveCrystal(R.purple, 1)); add('cave/crystal-purple-glow', W.caveCrystalGlow(R.purple));
  add('cave/crystal-blue', W.caveCrystal(R.water, 2)); add('cave/crystal-blue-glow', W.caveCrystalGlow(R.water));
  add('cave/mushroom', W.caveMushroom());
}

// items
{
  for (const tier of Object.keys(C.TIERS)) for (const t of [...C.TOOLS, 'rod']) {
    if (t === 'rod' && tier !== 'basic') continue;
    add(`item/${t}-${tier}`, I.toolIcon(t, tier));
  }
  for (const c of crops) {
    add(`item/seed-${c.id}`, I.seedPacket(R[c.art.fruit] ?? R[c.art.bloom] ?? R[c.art.head] ?? R[c.art.root] ?? R.leaf));
    add(`item/${c.id}`, I.produce(c));
  }
  const bars = { copperBar: R.orange, ironBar: R.teal, goldBar: R.yellow };
  for (const [k, fn] of Object.entries(I.RES)) {
    if (k === 'bar' || k === 'fish' || k === 'dish' || k === 'gem') continue;
    add(`item/${k}`, fn());
  }
  for (const [k, ramp] of Object.entries(bars)) add(`item/${k}`, I.RES.bar(ramp)());
  for (const [k, ramp] of Object.entries({ minnow: R.teal, perch: R.leaf, trout: R.blossom, carp: R.orange, eel: R.ink, koi: R.red })) add(`item/fish-${k}`, I.RES.fish(ramp)());
  for (const [k, ramp] of Object.entries({ amethyst: R.purple, topaz: R.yellow, aquamarine: R.water, ruby: R.red })) add(`item/gem-${k}`, I.RES.gem(ramp)());
  for (const [k, ramp] of Object.entries({ soup: R.orange, stew: R.dirt, pie: R.yellow, salad: R.leaf, jam: R.purple, tea: R.leaf })) add(`item/dish-${k}`, I.RES.dish(ramp)());
}

// the garden: things to put down on the farm, and the icons they have in the bag
{
  for (const [k, ramp] of Object.entries({ red: R.red, gold: R.yellow, teal: R.teal, pink: R.pink })) {
    const l = GA.paperLantern(ramp);
    add(`deco/lantern-${k}`, l.day); add(`deco/lantern-${k}-glow`, l.glow); add(`item/deco-lantern-${k}`, GA.icon(l.day));
  }
  const sl = GA.stoneLantern();
  add('deco/stone-lantern', sl.day); add('deco/stone-lantern-glow', sl.glow); add('item/deco-stone-lantern', GA.icon(sl.day));
  for (const sn of SEASONS) add(`deco/planter-${sn}`, GA.planter(sn));
  add('item/deco-planter', GA.icon(GA.planter('spring')));
  const bb = GA.birdBath(); add('deco/birdbath', bb); add('item/deco-birdbath', GA.icon(bb));
  const gn = GA.gnome(); add('deco/gnome', gn.day); add('deco/gnome-glow', gn.glow); add('item/deco-gnome', GA.icon(gn.day));
  add('item/deco-lamp-post', GA.icon(B.lanternPost().day));
}

// ui
{
  add('ui/panel', U.panel()); add('ui/panel-dark', U.panelDark());
  add('ui/slot', U.slot()); add('ui/slot-sel', U.slotSelected());
  for (const k of ['leaf', 'wood', 'berry', 'sky']) for (const st of ['up', 'hover', 'down']) add(`ui/btn-${k}-${st}`, U.button(k, st));
  add('ui/btn-disabled', U.disabledButton());
  add('ui/coin', U.coin()); add('ui/bolt', U.bolt());
  for (const f of ['full', 'half', 'empty']) add(`ui/heart-${f}`, U.heart(f));
  add('ui/arrow-down', U.arrowDown()); add('ui/arrow-right', U.arrowRight()); add('ui/check', U.check());
  for (const k of ['bag', 'craft', 'lantern', 'friends', 'options']) add(`ui/tab-${k}`, U.tabIcon(k));
  for (const s of SEASONS) add(`ui/season-${s}`, U.seasonIcon(s));
  add('ui/icon-cat', U.catIcon());
  add('ui/icon-coop', U.coopIcon());
  for (const w of ['sun', 'moon', 'cloud', 'rain', 'storm', 'snow']) add(`ui/weather-${w}`, U.weatherIcon(w));
  add('ui/stick-base', U.stickBase()); add('ui/stick-knob', U.stickKnob()); add('ui/action-btn', U.actionButton()); add('ui/menu-btn', U.menuButton()); add('ui/silhouette', U.silhouette()); add('ui/hand', U.hand());
}

// fx
{
  add('fx/glow-128', FX.glow(128)); add('fx/glow-48', FX.glow(48, 1.8));
  add('fx/shadow-s', FX.shadow(14, 6)); add('fx/shadow-m', FX.shadow(22, 8)); add('fx/shadow-l', FX.shadow(34, 12));
  for (let i = 0; i < 4; i++) { add(`fx/dust/${i}`, FX.dust(i)); add(`fx/smoke/${i}`, FX.smoke(i)); }
  for (let i = 0; i < 5; i++) { add(`fx/sparkle/${i}`, FX.sparkle(i)); add(`fx/sparkle-gold/${i}`, FX.sparkle(i, R.yellow)); }
  add('fx/drop', FX.waterDrop());
  for (let i = 0; i < 3; i++) { add(`fx/splash/${i}`, FX.splash(i)); add(`fx/ripple/${i}`, FX.ripple(i)); add(`fx/leaf-autumn/${i}`, FX.leaf(i, R.autumn)); add(`fx/leaf-green/${i}`, FX.leaf(i, R.leaf)); }
  add('fx/petal', FX.petal()); add('fx/snow', FX.snowflake()); add('fx/rain', FX.rainStreak()); add('fx/raindrop', FX.raindrop());
  add('fx/heart', FX.heartFx()); add('fx/firefly/0', FX.firefly(0)); add('fx/firefly/1', FX.firefly(1));
  add('fx/note/0', FX.note(0)); add('fx/note/1', FX.note(1)); add('fx/zzz', FX.zzz());
  add('fx/cursor', FX.cursorTile()); add('fx/exclaim', FX.exclaim());
}

{
  const { atlas, json, frames } = packAtlas(A, { maxW: 1024, pad: 2, extrude: 1, imageName: 'atlas.png' });
  writePNG(`${OUT}/atlas.png`, atlas);
  writeFileSync(`${OUT}/atlas.json`, JSON.stringify(json));
  manifest.frames = Object.keys(frames);
  console.log(`atlas.png ${atlas.w}x${atlas.h}, ${A.length} frames`);
}

// ---------------------------------------------------------------- the title screen
{
  const items = [];
  const put = (name, img) => items.push({ name, img });
  for (const k of ['far', 'mid', 'near']) put(`hills/${k}`, T.hills(k));
  for (let i = 0; i < 3; i++) put(`cloud/${i}`, T.cloud(i));
  put('moon', T.moon()); put('seal', T.seal()); put('logo', T.logo());
  for (const k of ['red', 'gold', 'pink']) put(`lantern/${k}`, T.lantern(k));
  put('star/0', T.star(0)); put('star/1', T.star(1));
  const { atlas, json } = packAtlas(items, { maxW: 1024, pad: 2, extrude: 1, imageName: 'title.png' });
  writePNG(`${OUT}/title.png`, atlas);
  writeFileSync(`${OUT}/title.json`, JSON.stringify(json));
  console.log(`title.png ${atlas.w}x${atlas.h}, ${items.length} frames`);
}

// ---------------------------------------------------------------- characters
const DIRS = ['down', 'up', 'side'];
const PLAYER = { skin: R.skin2, hair: R.hairBrown, hairStyle: 'short', shirt: R.teal, pants: R.wood, shoes: R.wood, hat: 'straw' };
{
  const items = [];
  const who = 'player';
  for (const dir of DIRS) {
    const poses = dir === 'side' ? C.WALK_SIDE : C.WALK;
    poses.forEach((p, i) => items.push({ name: `${who}/walk-${dir}-${i}`, img: C.frame(PLAYER, dir, p) }));
    items.push({ name: `${who}/idle-${dir}-0`, img: C.idleFrame(PLAYER, dir) });
    for (const tool of C.TOOLS) for (const tier of Object.keys(C.TIERS)) for (let t = 0; t < 4; t++) {
      items.push({ name: `${who}/${tool}-${tier}-${dir}-${t}`, img: C.toolFrame(PLAYER, dir, t, tool, tier) });
    }
    for (let t = 0; t < 4; t++) items.push({ name: `${who}/rod-basic-${dir}-${t}`, img: C.toolFrame(PLAYER, dir, t, 'rod', 'basic') });
  }
  for (const n of N.NPCS) {
    for (const dir of DIRS) {
      const poses = dir === 'side' ? C.WALK_SIDE : C.WALK;
      poses.forEach((p, i) => items.push({ name: `npc/${n.id}/walk-${dir}-${i}`, img: C.frame(n.spec, dir, p) }));
    }
  }
  const { atlas, json, frames } = packAtlas(items, { maxW: 1024, pad: 2, extrude: 1, imageName: 'chars.png' });
  writePNG(`${OUT}/chars.png`, atlas);
  writeFileSync(`${OUT}/chars.json`, JSON.stringify(json));
  console.log(`chars.png ${atlas.w}x${atlas.h}, ${items.length} frames`);
}

// ---------------------------------------------------------------- fonts
for (const [name, outline] of [['hollow', null], ['hollow-o', () => R.ink[0]]]) {
  const { atlas, xml } = buildFont({ outline, name });
  writePNG(`${OUT}/font-${name}.png`, atlas);
  writeFileSync(`${OUT}/font-${name}.xml`, xml);
}

// ---------------------------------------------------------------- manifest for the game
const ts = `// Generated by tools/art/build.mjs. Do not edit.
export const TILE_SIZE = 16;
export const TILESET = { cols: ${TILE_COLS}, margin: 1, spacing: 2, count: ${tileCount} } as const;
export const TILE_ID = ${JSON.stringify(tileIds)} as const;
export const INTERIOR_TILE_ID = ${JSON.stringify(INTERIOR_IDS)} as const;
export const CAVE_TILE_ID = ${JSON.stringify(CAVE_IDS)} as const;
export const BLOB_INDEX: readonly number[] = ${JSON.stringify(TR.BLOB_INDEX)};
export const SHRINE = ${JSON.stringify({ w: 96, h: 80, lanterns: V.shrine(0).lanterns })} as const;
export const CROP_STAGES: Readonly<Record<string, number>> = ${JSON.stringify(cropFrames)};
export const ART_COUNTS: Readonly<Record<string, number>> = ${JSON.stringify(manifest.counts)};
export const FRAME_NAMES: readonly string[] = ${JSON.stringify(manifest.frames)};
export const CHAR_FRAME = { w: ${C.FW}, h: ${C.FH}, originX: 16, originY: 30 } as const;
export const ROD_TIP = ${JSON.stringify({ down: C.rodTip('down'), up: C.rodTip('up'), side: C.rodTip('side') })} as const;
export const PAL = ${JSON.stringify(Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v])))} as const;
`;
writeFileSync('src/gen/art.ts', ts);
console.log('wrote src/gen/art.ts');

// ---------------------------------------------------------------- app icons
// One drawing, kept inside the safe circle so the same file works as a plain and a maskable icon.
{
  const icon = AI.appIcon();
  const sizes = { 'icon-192': 192, 'icon-512': 512, 'apple-touch-icon': 180, 'favicon-32': 32 };
  for (const [name, size] of Object.entries(sizes)) writePNG(`public/icons/${name}.png`, AI.resize(icon, size));
  console.log(`icons ${Object.keys(sizes).join(', ')}`);
}
