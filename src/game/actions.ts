import { cropOfSeed, itemDef } from '../data/items';
import { decorAt, decorIndexOf, decorItemId } from '../features/garden/catalog';
import type { MapDef, ObjectKind } from '../world/mapkit';
import { MACHINE_KINDS, SOLID_OBJECTS, OBJECT_HP } from '../world/mapkit';
import {
  CAN_CAPACITY, TOOL_DAMAGE, canPlant, clearDead, harvest, isRipe, plant, ripensInTime, tierIndex, till, toolEnergy, untill, waterSoil, waterTiles,
} from './farming';
import { addItem, canAdd, emptySlots, takeFromSlot } from './inventory';
import type { Rand } from './rng';
import { chance, randInt } from './rng';
import { seasonOf } from './clock';
import type { GameState, LocationState, ObjectState } from './state';
import type { Dir, Tile, ToolId } from './types';
import { DIR_VEC, tileKey } from './types';

export type FxEvent =
  | { t: 'dust'; x: number; y: number }
  | { t: 'drops'; x: number; y: number }
  | { t: 'chips'; x: number; y: number; kind: 'wood' | 'stone' | 'leaf' }
  | { t: 'sparkle'; x: number; y: number }
  | { t: 'splash'; x: number; y: number }
  | { t: 'pop'; x: number; y: number; item: string; n: number }
  | { t: 'shake'; x: number; y: number };

export interface Outcome {
  ok: boolean;
  msg?: string;
  sfx?: string;
  fx: FxEvent[];
  /** Tile keys whose look changed. */
  changed: string[];
  /** Whether to play the swing animation. */
  swing: boolean;
  energy: number;
}

const fail = (msg: string, tx: number, ty: number, swing = false): Outcome => ({
  ok: false, msg, sfx: 'nope', fx: [{ t: 'shake', x: tx, y: ty }], changed: [], swing, energy: 0,
});
const done = (o: Partial<Outcome>): Outcome => ({ ok: true, fx: [], changed: [], swing: true, energy: 0, ...o });

export interface Ctx {
  state: GameState;
  map: MapDef;
  rand: Rand;
}

export function loc(ctx: Ctx): LocationState {
  const l = ctx.state.locations[ctx.map.id];
  if (!l) throw new Error('No state for location ' + ctx.map.id);
  return l;
}

export const TILE = 16;
export const tileOfPx = (px: number, py: number): Tile => ({ x: Math.floor(px / TILE), y: Math.floor(py / TILE) });

export function facingTile(px: number, py: number, dir: Dir): Tile {
  const t = tileOfPx(px, py);
  const v = DIR_VEC[dir];
  return { x: t.x + v.x, y: t.y + v.y };
}

export function isWater(map: MapDef, x: number, y: number): boolean {
  return map.kind === 'outdoor' && x >= 0 && y >= 0 && x < map.w && y < map.h && map.ground[y * map.w + x] === 0;
}

export function isSolidTile(map: MapDef, l: LocationState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  const i = y * map.w + x;
  if (map.ground[i] === 0 || map.solid[i]) return true;
  const o = l.objects[tileKey(x, y)];
  return !!o && SOLID_OBJECTS.has(o.k);
}

function give(ctx: Ctx, id: string, n: number, fx: FxEvent[], tx: number, ty: number): boolean {
  const slots = ctx.state.player.slots;
  if (!canAdd(slots, id, n)) return false;
  addItem(slots, id, n);
  fx.push({ t: 'pop', x: tx, y: ty, item: id, n });
  return true;
}

function spend(ctx: Ctx, tool: ToolId): number {
  const e = toolEnergy(tool, ctx.state.player.tools[tool]);
  ctx.state.player.energy = Math.max(0, ctx.state.player.energy - e);
  return e;
}

/** Ore nodes: what they give, and the pickaxe tier they need. */
const ORES: Partial<Record<ObjectKind, { item: string; n: [number, number]; tier: number }>> = {
  copper: { item: 'copperOre', n: [1, 2], tier: 0 },
  iron: { item: 'ironOre', n: [1, 2], tier: 1 },
  gold: { item: 'goldOre', n: [1, 2], tier: 2 },
};

const GEMS = ['gem-amethyst', 'gem-topaz', 'gem-aquamarine', 'gem-ruby'] as const;
/** Deeper crystals are likelier to be the rare ones. `floor` runs 0 to 4. */
export function gemFor(rand: Rand, floor: number): string {
  const weights = [40, 30, 20 + floor * 2, 6 + floor * 5];
  let roll = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] as number;
    if (roll <= 0) return GEMS[i] as string;
  }
  return GEMS[0];
}

function pickUpMachine(ctx: Ctx, key: string, tx: number, ty: number, o: ObjectState): Outcome {
  const l = loc(ctx);
  const thing = l.things[key];
  if (o.k === 'chest' && thing?.items?.some((s) => s)) return fail('Empty the chest first.', tx, ty);
  if (o.k === 'furnace' && thing?.job) return fail('The furnace is still busy.', tx, ty);
  const fx: FxEvent[] = [];
  const decor = o.k === 'decor' ? decorAt(o.v) : undefined;
  // a garden piece comes back as the thing you bought; one that is not in the catalogue any more just goes
  const item = o.k === 'decor' ? (decor ? decorItemId(decor) : null) : o.k;
  if (item && !give(ctx, item, 1, fx, tx, ty)) return fail('Your bag is full.', tx, ty);
  delete l.objects[key];
  delete l.things[key];
  return done({ sfx: 'pickup', fx, changed: [key], swing: false });
}

/** Set a chest, furnace or sprinkler down on the tile in front. */
export function placeMachine(ctx: Ctx, id: string, slotIndex: number, tx: number, ty: number): Outcome {
  const l = loc(ctx);
  const key = tileKey(tx, ty);
  const i = ty * ctx.map.w + tx;
  if (!ctx.map.tillable[i] || l.objects[key] || l.soil[key] || ctx.map.solid[i]) return fail("There isn't room to put that down here.", tx, ty);
  const piece = decorIndexOf(id);
  if (piece >= 0) {
    l.objects[key] = { k: 'decor', v: piece, hp: 1 };
  } else {
    const kind = id as 'chest' | 'furnace' | 'sprinkler';
    l.objects[key] = { k: kind, v: 0, hp: 1 };
    l.things[key] = kind === 'chest' ? { kind, items: emptySlots(24) } : { kind };
  }
  takeFromSlot(ctx.state.player.slots, slotIndex, 1);
  return done({ sfx: 'place', fx: [{ t: 'dust', x: tx, y: ty }], changed: [key], swing: false });
}

/** The tool in the player's hand tries its job on the tile in front. */
export function useTool(ctx: Ctx, tool: ToolId, tx: number, ty: number, dir: Dir): Outcome {
  const p = ctx.state.player;
  if (p.energy <= 0.01) return fail("You're too tired. Time for bed.", tx, ty);
  const l = loc(ctx);
  const key = tileKey(tx, ty);
  const o = l.objects[key];
  const tier = p.tools[tool];
  const season = seasonOf(ctx.state.day);

  switch (tool) {
    case 'hoe': {
      const soil = l.soil[key];
      if (soil?.crop?.dead) {
        clearDead(l.soil, key);
        return done({ sfx: 'hoe', fx: [{ t: 'dust', x: tx, y: ty }], changed: [key], energy: spend(ctx, tool) });
      }
      if (soil) {
        if (!untill(l.soil, key)) return fail('Something is growing there.', tx, ty);
        return done({ sfx: 'hoe', fx: [{ t: 'dust', x: tx, y: ty }], changed: [key], energy: spend(ctx, tool) });
      }
      if (o?.k === 'clay') {
        const fx: FxEvent[] = [{ t: 'dust', x: tx, y: ty }];
        if (!give(ctx, 'clay', randInt(ctx.rand, 1, 3), fx, tx, ty)) return fail('Your bag is full.', tx, ty);
        delete l.objects[key];
        return done({ sfx: 'hoe', fx, changed: [key], energy: spend(ctx, tool) });
      }
      if (o) return fail('Something is in the way.', tx, ty);
      if (isWater(ctx.map, tx, ty)) return fail("That's a bit wet to dig.", tx, ty);
      if (!ctx.map.tillable[ty * ctx.map.w + tx]) return fail("Can't dig here.", tx, ty);
      if (!ctx.map.indoors && season === 'winter') return fail('The ground has frozen solid.', tx, ty);
      till(l.soil, key);
      return done({ sfx: 'hoe', fx: [{ t: 'dust', x: tx, y: ty }], changed: [key], energy: spend(ctx, tool) });
    }
    case 'can': {
      if (isWater(ctx.map, tx, ty)) {
        if (p.water >= CAN_CAPACITY[tier]) return fail('The can is already full.', tx, ty);
        p.water = CAN_CAPACITY[tier];
        return done({ sfx: 'refill', fx: [{ t: 'splash', x: tx, y: ty }], energy: 0 });
      }
      if (p.water <= 0) return fail('The can is empty. Fill it at the well or any water.', tx, ty);
      const tiles = waterTiles({ x: tx, y: ty }, dir, tier);
      const { watered, used } = waterSoil(l.soil, tiles, p.water);
      p.water -= used;
      if (used === 0) return done({ sfx: 'water-dry', fx: [], energy: 0 });
      return done({
        sfx: 'water',
        fx: watered.map((t): FxEvent => ({ t: 'drops', x: t.x, y: t.y })),
        changed: watered.map((t) => tileKey(t.x, t.y)),
        energy: spend(ctx, tool),
      });
    }
    case 'axe': {
      if (!o) return fail('Nothing to chop.', tx, ty);
      if (MACHINE_KINDS.has(o.k)) return pickUpMachine(ctx, key, tx, ty, o);
      if (o.k === 'log' && tierIndex(tier) < 1) return fail('You need a stronger axe for that log.', tx, ty, true);
      if (o.k !== 'tree' && o.k !== 'stump' && o.k !== 'log') return fail('Your axe has no use on that.', tx, ty);
      o.hp -= TOOL_DAMAGE[tier];
      const energy = spend(ctx, tool);
      if (o.hp > 0) return done({ sfx: 'chop', fx: [{ t: 'chips', x: tx, y: ty, kind: 'wood' }, { t: 'shake', x: tx, y: ty }], energy });
      const fx: FxEvent[] = [{ t: 'chips', x: tx, y: ty, kind: 'wood' }];
      if (o.k === 'tree') {
        o.k = 'stump'; o.hp = OBJECT_HP.stump;
        give(ctx, 'wood', randInt(ctx.rand, 4, 6), fx, tx, ty);
        if (chance(ctx.rand, 0.35)) give(ctx, 'sap', 1, fx, tx, ty);
        return done({ sfx: 'tree-fall', fx, changed: [key], energy });
      }
      delete l.objects[key];
      give(ctx, 'wood', o.k === 'log' ? randInt(ctx.rand, 8, 10) : randInt(ctx.rand, 2, 3), fx, tx, ty);
      return done({ sfx: 'chop-done', fx, changed: [key], energy });
    }
    case 'pick': {
      if (!o) return fail('Nothing to break.', tx, ty);
      if (MACHINE_KINDS.has(o.k)) return pickUpMachine(ctx, key, tx, ty, o);
      const ore = ORES[o.k];
      if (ore || o.k === 'crystal') {
        if (ore && tierIndex(tier) < ore.tier) return fail('The rock is too hard. You need a stronger pickaxe.', tx, ty, true);
        o.hp -= TOOL_DAMAGE[tier];
        const energy = spend(ctx, tool);
        if (o.hp > 0) return done({ sfx: 'mine', fx: [{ t: 'chips', x: tx, y: ty, kind: 'stone' }, { t: 'shake', x: tx, y: ty }], energy });
        const fx: FxEvent[] = [{ t: 'chips', x: tx, y: ty, kind: 'stone' }, { t: 'sparkle', x: tx, y: ty }];
        delete l.objects[key];
        if (ore) give(ctx, ore.item, randInt(ctx.rand, ore.n[0], ore.n[1]) + (tierIndex(tier) >= 2 ? 1 : 0), fx, tx, ty);
        else give(ctx, gemFor(ctx.rand, o.v), 1, fx, tx, ty);
        if (chance(ctx.rand, 0.3)) give(ctx, 'stone', 1, fx, tx, ty);
        ctx.state.stats.mined += 1;
        return done({ sfx: 'mine-break', fx, changed: [key], energy });
      }
      if (o.k !== 'rock' && o.k !== 'boulder') return fail('Your pickaxe has no use on that.', tx, ty);
      if (o.k === 'boulder' && tierIndex(tier) < 1) return fail("It won't budge. You need a stronger pickaxe.", tx, ty, true);
      o.hp -= TOOL_DAMAGE[tier];
      const energy = spend(ctx, tool);
      if (o.hp > 0) return done({ sfx: 'mine', fx: [{ t: 'chips', x: tx, y: ty, kind: 'stone' }, { t: 'shake', x: tx, y: ty }], energy });
      const fx: FxEvent[] = [{ t: 'chips', x: tx, y: ty, kind: 'stone' }];
      const big = o.k === 'boulder';
      delete l.objects[key];
      give(ctx, 'stone', big ? randInt(ctx.rand, 6, 9) : randInt(ctx.rand, 1, 3), fx, tx, ty);
      if (chance(ctx.rand, big ? 0.6 : 0.08)) give(ctx, 'coal', 1, fx, tx, ty);
      return done({ sfx: 'mine-break', fx, changed: [key], energy });
    }
    case 'scythe': {
      const soil = l.soil[key];
      if (soil?.crop?.dead) {
        clearDead(l.soil, key);
        return done({ sfx: 'cut', fx: [{ t: 'chips', x: tx, y: ty, kind: 'leaf' }], changed: [key], energy: spend(ctx, tool) });
      }
      if (!o || (o.k !== 'weed' && o.k !== 'tallgrass' && o.k !== 'flower')) return fail('Nothing to cut.', tx, ty);
      const fx: FxEvent[] = [{ t: 'chips', x: tx, y: ty, kind: 'leaf' }];
      delete l.objects[key];
      if (o.k === 'weed') give(ctx, 'fiber', randInt(ctx.rand, 1, 2), fx, tx, ty);
      else if (o.k === 'tallgrass') { if (chance(ctx.rand, 0.4)) give(ctx, 'hay', 1, fx, tx, ty); else if (chance(ctx.rand, 0.3)) give(ctx, 'fiber', 1, fx, tx, ty); }
      else give(ctx, 'flower', 1, fx, tx, ty);
      return done({ sfx: 'cut', fx, changed: [key], energy: spend(ctx, tool) });
    }
    case 'rod':
      return fail('There is no water to fish here.', tx, ty);
  }
}

/** Plants the selected seed on the tile in front. */
export function useSeed(ctx: Ctx, seedId: string, slotIndex: number, tx: number, ty: number): Outcome {
  const crop = cropOfSeed(seedId);
  if (!crop) return fail('Those are not seeds.', tx, ty);
  const l = loc(ctx);
  const key = tileKey(tx, ty);
  const season = seasonOf(ctx.state.day);
  const r = canPlant(l.soil[key], crop.id, season, ctx.map.indoors);
  if (r === 'no-soil') return fail('Seeds need tilled soil.', tx, ty);
  if (r === 'occupied') return fail('Something is already growing there.', tx, ty);
  if (r === 'wrong-season') return fail(`${crop.name} won't grow in ${season}.`, tx, ty);
  if (!ctx.map.indoors && !ripensInTime(crop.id, ctx.state.day)) return fail(`Too late in the season: ${crop.name} needs ${crop.days} days.`, tx, ty);
  plant(l.soil, key, crop.id);
  takeFromSlot(ctx.state.player.slots, slotIndex, 1);
  return done({ sfx: 'plant', fx: [{ t: 'dust', x: tx, y: ty }, { t: 'sparkle', x: tx, y: ty }], changed: [key], swing: false });
}

/** Empty hands: harvest what is ripe, pick things up. Returns null when there is nothing to do. */
export function interactTile(ctx: Ctx, tx: number, ty: number): Outcome | null {
  const l = loc(ctx);
  const key = tileKey(tx, ty);
  const soil = l.soil[key];
  if (soil?.crop && isRipe(soil.crop)) {
    const slots = ctx.state.player.slots;
    if (!canAdd(slots, soil.crop.id, 4)) return fail('Your bag is full.', tx, ty);
    const h = harvest(l.soil, key, ctx.rand);
    if (!h) return null;
    addItem(slots, h.id, h.n);
    ctx.state.stats.harvested += h.n;
    return done({
      sfx: 'harvest', swing: false, changed: [key],
      fx: [{ t: 'pop', x: tx, y: ty, item: h.id, n: h.n }, { t: 'sparkle', x: tx, y: ty }, { t: 'dust', x: tx, y: ty }],
    });
  }
  const o = l.objects[key];
  if (o && (o.k === 'mushroom' || o.k === 'berries')) {
    const fx: FxEvent[] = [];
    const id = o.k === 'mushroom' ? 'mushroom' : 'berry';
    if (!give(ctx, id, o.k === 'berries' ? randInt(ctx.rand, 2, 3) : 1, fx, tx, ty)) return fail('Your bag is full.', tx, ty);
    delete l.objects[key];
    return done({ sfx: 'pickup', fx, changed: [key], swing: false });
  }
  if (o && (o.k === 'branch' || o.k === 'flower')) {
    const fx: FxEvent[] = [];
    const id = o.k === 'branch' ? 'wood' : 'flower';
    if (!give(ctx, id, 1, fx, tx, ty)) return fail('Your bag is full.', tx, ty);
    delete l.objects[key];
    return done({ sfx: 'pickup', fx, changed: [key], swing: false });
  }
  return null;
}

export function describeSelected(state: GameState): string {
  const s = state.player.slots[state.player.selected];
  return s ? itemDef(s.id).name : '';
}
