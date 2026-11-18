/**
 * Everything that decides whether a saved farm can be opened, in one place: a save in the browser and a backup file
 * go through the same two steps, so neither can let in something the game would stumble on.
 *
 * 1. `upgrade` brings a save from an older version up to this one, and fills in anything a newer build added.
 * 2. `whatIsWrong` reads every field the game dereferences and says, in plain words, what is the matter.
 */
import { CROPS, ITEMS, TOOL_IDS } from '../data/items';
import { DECOR } from '../features/garden/catalog';
import { OBJECT_HP } from '../world/mapkit';
import { MAX_BATCH, SMELTS } from './furnace';
import { hasMap } from '../world/maps/registry';
import { newGame, SAVE_VERSION } from './state';
import type { GameState } from './state';
import { TIERS } from './types';
import type { Tier, ToolId } from './types';

const PACES = ['relaxed', 'standard', 'brisk'];
const WEATHERS = ['sun', 'cloud', 'rain', 'storm', 'snow'];
const DIRS = ['down', 'up', 'left', 'right'];
const THINGS = ['chest', 'furnace', 'sprinkler'];
const PET_KINDS = ['chicken', 'cat'];
/** No map is anywhere near this big, so a farmer further out than this is not on one. */
const FAR = 20000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const inRange = (v: unknown, lo: number, hi: number): boolean => isNum(v) && v >= lo && v <= hi;
const isInt = (v: unknown, lo: number, hi: number): boolean => isNum(v) && Number.isInteger(v) && v >= lo && v <= hi;
/** Free text the game only shows, never looks up: a name, a note id. Short enough that no screen has to cope with it. */
const text = (v: unknown, max = 60): boolean => isStr(v) && v.length <= max;
const known = (id: unknown): boolean => isStr(id) && Object.hasOwn(ITEMS, id);
const stackOk = (s: unknown): boolean => s === null || (isObj(s) && known(s.id) && isInt(s.n, 1, 9999));
const tierOk = (v: unknown): boolean => TIERS.includes(v as Tier);
const strings = (v: unknown): boolean => Array.isArray(v) && v.length <= 5000 && v.every((x) => text(x, 100));

/** One step per version: each makes a save of version n into a save of version n + 1. What a version lacked is filled in after. */
const STEPS: Readonly<Record<number, (s: Record<string, unknown>) => void>> = {
  // version 2 added the village (friends, requests, pets, recipes, bundles, the forge) and the things a player places; `fill` adds the first
  // and this step adds the second to every place
  1: (s) => {
    if (isObj(s.locations)) for (const loc of Object.values(s.locations)) if (isObj(loc) && loc.things === undefined) loc.things = {};
  },
};

const STAT_KEYS = ['earned', 'shipped', 'harvested', 'daysPlayed', 'caught', 'mined'];
/** No count in the game comes near this, so a bigger one is not a count. */
const BIG = 1e11;

/** Adds what this build keeps and the save does not have, from a new game with the same seed. */
function fill(s: Record<string, unknown>): void {
  if (!isNum(s.seed) || !isObj(s.player)) return;
  const p = s.player;
  let fresh: GameState | null = null;
  const base = (): GameState => (fresh ??= newGame(s.seed as number));
  for (const k of ['pace', 'weather', 'shipping', 'flags', 'stats', 'social', 'bundles', 'recipes', 'requests', 'forge', 'upgrades', 'pets', 'deepest', 'seen'] as const) {
    if (s[k] === undefined) s[k] = structuredClone(base()[k]);
  }
  for (const k of ['name', 'dir', 'energy', 'maxEnergy', 'selected', 'water'] as const) {
    if (p[k] === undefined) p[k] = structuredClone(base().player[k]);
  }
  if (isObj(p.tools)) for (const t of TOOL_IDS) if (p.tools[t] === undefined) p.tools[t] = 'basic';
  if (isObj(s.stats)) for (const k of STAT_KEYS) if (s.stats[k] === undefined) s.stats[k] = 0;
  if (isObj(s.social)) {
    for (const f of Object.values(s.social)) {
      if (!isObj(f)) continue;
      for (const k of ['points', 'talkedDay', 'giftedDay', 'giftsWeek', 'weekStart']) if (f[k] === undefined) f[k] = 0;
      if (f.met === undefined) f.met = false;
      if (f.claimed === undefined) f.claimed = [];
    }
  }
}

/** Brings a save from an older version up to this one. A newer one is left alone, for `whatIsWrong` to turn away. */
export function upgrade(parsed: unknown): unknown {
  if (!isObj(parsed) || !isInt(parsed.version, 1, SAVE_VERSION)) return parsed;
  let v = parsed.version as number;
  while (v < SAVE_VERSION) {
    STEPS[v]?.(parsed);
    v += 1;
    parsed.version = v;
  }
  fill(parsed);
  return parsed;
}

const soilWrong = (soil: Record<string, unknown>): boolean =>
  !Object.values(soil).every((t) => {
    if (!isObj(t) || typeof t.wet !== 'boolean') return false;
    const c = t.crop;
    return c === undefined || (isObj(c) && isStr(c.id) && Object.hasOwn(CROPS, c.id) && inRange(c.age, 0, 1000) && typeof c.regrowing === 'boolean' && typeof c.dead === 'boolean');
  });

const thingWrong = (t: unknown): boolean => {
  if (!isObj(t) || !THINGS.includes(t.kind as string)) return true;
  if (t.items !== undefined && !(Array.isArray(t.items) && t.items.length <= 200 && t.items.every(stackOk))) return true;
  const j = t.job;
  if (j === undefined) return false;
  // a job is a real smelt: the game looks both items up, and takes the bars out by the count
  return !(isObj(j) && SMELTS.some((m) => m.ore === j.ore && m.bar === j.bar) && isInt(j.n, 1, MAX_BATCH) && inRange(j.readyAt, 0, 1e9));
};

const friendWrong = (f: unknown): boolean =>
  !(isObj(f) && ['points', 'talkedDay', 'giftedDay', 'weekStart'].every((k) => inRange(f[k], 0, 1e6)) && inRange(f.giftsWeek, 0, 1000) && typeof f.met === 'boolean' && Array.isArray(f.claimed) && f.claimed.length <= 20 && f.claimed.every((h) => inRange(h, 0, 100)));

const petWrong = (p: unknown): boolean =>
  !(isObj(p) && text(p.id) && PET_KINDS.includes(p.kind as string) && text(p.name) && inRange(p.fedDay, 0, 1e6) && inRange(p.happy, 0, 100) && (p.since === undefined || inRange(p.since, 0, 1e6)) && (p.petDay === undefined || inRange(p.petDay, 0, 1e6)));

const requestWrong = (r: unknown): boolean =>
  !(isObj(r) && text(r.id) && text(r.npc) && known(r.item) && isInt(r.n, 1, 999) && inRange(r.reward, 0, 1e6) && inRange(r.until, 0, 1e6));

/** The first thing wrong with a parsed save, in plain words, or null when every field the game reads is sound. */
export function whatIsWrong(s: unknown): string | null {
  if (!isObj(s) || !('version' in s)) return 'There is no saved game in that file.';
  if (s.version !== SAVE_VERSION) return 'That save is from a different version of the game.';
  if (!isNum(s.seed) || !isNum(s.minute) || s.minute < 0 || s.minute > 10000 || !isInt(s.day, 1, 100000)) return 'That save is missing its calendar.';
  if (!PACES.includes(s.pace as string) || !WEATHERS.includes(s.weather as string)) return 'That save is missing its settings.';
  const p = s.player;
  if (!isObj(p) || !text(p.name, 40) || !inRange(p.gold, 0, 1e10) || !inRange(p.energy, 0, 1000) || !inRange(p.maxEnergy, 1, 1000) || !inRange(p.water, 0, 1000)) return 'That save is missing its farmer.';
  if (!isNum(p.x) || !isNum(p.y) || Math.abs(p.x) > FAR || Math.abs(p.y) > FAR || !DIRS.includes(p.dir as string)) return 'That save has the farmer somewhere that is not on the map.';
  if (!isStr(p.loc) || !hasMap(p.loc)) return 'That save has the farmer somewhere that is not on the map.';
  if (!Array.isArray(p.slots) || p.slots.length < 10 || p.slots.length > 200 || !p.slots.every(stackOk)) return 'That save has a bag the game cannot read.';
  if (!isNum(p.selected) || p.selected < 0 || p.selected >= p.slots.length) return 'That save has a bag the game cannot read.';
  if (!isObj(p.tools) || !TOOL_IDS.every((t) => tierOk((p.tools as Record<string, unknown>)[t]))) return 'That save has tools the game cannot read.';
  if (!isObj(s.locations) || !isObj(s.locations.farm)) return 'That save is missing the farm.';
  for (const [id, loc] of Object.entries(s.locations)) {
    if (!hasMap(id) || !isObj(loc) || !isObj(loc.soil) || !isObj(loc.objects) || !isObj(loc.things)) return 'That save has a place the game cannot read.';
    if (soilWrong(loc.soil)) return 'That save has a field the game cannot read.';
    for (const o of Object.values(loc.objects)) if (!isObj(o) || !isStr(o.k) || !Object.hasOwn(OBJECT_HP, o.k) || !isInt(o.v, 0, 10000) || !inRange(o.hp, 0, 1000)) return 'That save has something on the farm the game does not know.';
    for (const t of Object.values(loc.things)) if (thingWrong(t)) return 'That save has a chest the game cannot read.';
    // a chest, furnace or sprinkler is a thing on the map and a record of what is inside it, and the game goes from one to the other
    for (const [key, o] of Object.entries(loc.objects) as [string, { k: string; v: number }][]) {
      if (THINGS.includes(o.k) && (loc.things[key] as { kind?: string } | undefined)?.kind !== o.k) return 'That save has a chest, furnace or sprinkler that is not all there.';
      if (o.k === 'decor' && o.v >= DECOR.length) return 'That save has something on the farm the game does not know.';
    }
    for (const [key, t] of Object.entries(loc.things) as [string, { kind: string }][]) {
      if ((loc.objects[key] as { k?: string } | undefined)?.k !== t.kind) return 'That save has a chest, furnace or sprinkler that is not all there.';
    }
  }
  if (!Array.isArray(s.shipping) || s.shipping.length > 5000 || !s.shipping.every((x) => isObj(x) && known(x.id) && isInt(x.n, 1, 9999))) return 'That save has a shipping bin the game cannot read.';
  for (const k of ['recipes', 'upgrades', 'seen']) if (!strings(s[k])) return 'That save has a list the game cannot read.';
  if (!Array.isArray(s.pets) || s.pets.length > 500 || s.pets.some(petWrong)) return 'That save has animals the game cannot read.';
  if (!Array.isArray(s.requests) || s.requests.length > 500 || s.requests.some(requestWrong)) return 'That save has requests the game cannot read.';
  if (s.forge !== null && !(isObj(s.forge) && TOOL_IDS.includes(s.forge.tool as ToolId) && tierOk(s.forge.tier) && inRange(s.forge.readyDay, 0, 1e6))) return 'That save has a forge job the game cannot read.';
  for (const k of ['flags', 'stats', 'social', 'bundles']) if (!isObj(s[k])) return 'That save is missing some of its records.';
  if (!Object.values(s.flags as Record<string, unknown>).every((v) => typeof v === 'boolean' || inRange(v, -1e9, 1e9) || text(v, 200))) return 'That save has notes the game cannot read.';
  if (!isObj(s.stats) || !STAT_KEYS.every((k) => inRange((s.stats as Record<string, unknown>)[k], 0, BIG)) || !isInt(s.deepest, 0, 1000)) return 'That save has totals the game cannot read.';
  if (!Object.values(s.social as Record<string, unknown>).every((f) => !friendWrong(f))) return 'That save has friends the game cannot read.';
  if (!Object.values(s.bundles as Record<string, unknown>).every((b) => Array.isArray(b) && b.length <= 100 && b.every((n) => inRange(n, 0, 9999)))) return 'That save has lanterns the game cannot read.';
  return null;
}

export type Checked = { ok: true; state: GameState } | { ok: false; msg: string };

/** A parsed save, upgraded if it is old and checked all the way through. */
export function checkSave(parsed: unknown): Checked {
  const upgraded = upgrade(parsed);
  const wrong = whatIsWrong(upgraded);
  return wrong ? { ok: false, msg: wrong } : { ok: true, state: upgraded as GameState };
}
