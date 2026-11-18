/**
 * Everything that decides whether a saved farm can be opened, in one place: a save in the browser and a backup file
 * go through the same two steps, so neither can let in something the game would stumble on.
 *
 * 1. `upgrade` brings a save from an older version up to this one, and fills in anything a newer build added.
 * 2. `whatIsWrong` reads every field the game dereferences and says, in plain words, what is the matter.
 */
import { CROPS, ITEMS, TOOL_IDS } from '../data/items';
import { OBJECT_HP } from '../world/mapkit';
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
const isInt = (v: unknown, lo: number, hi: number): boolean => isNum(v) && Number.isInteger(v) && v >= lo && v <= hi;
const known = (id: unknown): boolean => isStr(id) && Object.hasOwn(ITEMS, id);
const stackOk = (s: unknown): boolean => s === null || (isObj(s) && known(s.id) && isInt(s.n, 1, 9999));
const tierOk = (v: unknown): boolean => TIERS.includes(v as Tier);
const strings = (v: unknown): boolean => Array.isArray(v) && v.length <= 5000 && v.every(isStr);

/** One step per version: each makes a save of version n into a save of version n + 1. What a version lacked is filled in after. */
const STEPS: Readonly<Record<number, (s: Record<string, unknown>) => void>> = {
  // version 2 added the village (friends, requests, pets, recipes, bundles, the forge) and the things a player places; `fill` adds the first
  // and this step adds the second to every place
  1: (s) => {
    if (isObj(s.locations)) for (const loc of Object.values(s.locations)) if (isObj(loc) && loc.things === undefined) loc.things = {};
  },
};

const STAT_KEYS = ['earned', 'shipped', 'harvested', 'daysPlayed', 'caught', 'mined'];

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
    return c === undefined || (isObj(c) && isStr(c.id) && Object.hasOwn(CROPS, c.id) && isNum(c.age) && typeof c.regrowing === 'boolean' && typeof c.dead === 'boolean');
  });

const thingWrong = (t: unknown): boolean => {
  if (!isObj(t) || !THINGS.includes(t.kind as string)) return true;
  if (t.items !== undefined && !(Array.isArray(t.items) && t.items.length <= 200 && t.items.every(stackOk))) return true;
  const j = t.job;
  return j !== undefined && !(isObj(j) && isStr(j.ore) && isStr(j.bar) && isNum(j.n) && isNum(j.readyAt));
};

const friendWrong = (f: unknown): boolean =>
  !(isObj(f) && ['points', 'talkedDay', 'giftedDay', 'giftsWeek', 'weekStart'].every((k) => isNum(f[k])) && typeof f.met === 'boolean' && Array.isArray(f.claimed) && f.claimed.every(isNum));

const petWrong = (p: unknown): boolean =>
  !(isObj(p) && isStr(p.id) && PET_KINDS.includes(p.kind as string) && isStr(p.name) && isNum(p.fedDay) && isNum(p.happy) && (p.since === undefined || isNum(p.since)) && (p.petDay === undefined || isNum(p.petDay)));

const requestWrong = (r: unknown): boolean =>
  !(isObj(r) && isStr(r.id) && isStr(r.npc) && known(r.item) && isInt(r.n, 1, 9999) && isNum(r.reward) && isNum(r.until));

/** The first thing wrong with a parsed save, in plain words, or null when every field the game reads is sound. */
export function whatIsWrong(s: unknown): string | null {
  if (!isObj(s) || !('version' in s)) return 'There is no saved game in that file.';
  if (s.version !== SAVE_VERSION) return 'That save is from a different version of the game.';
  if (!isNum(s.seed) || !isNum(s.minute) || s.minute < 0 || s.minute > 10000 || !isInt(s.day, 1, 100000)) return 'That save is missing its calendar.';
  if (!PACES.includes(s.pace as string) || !WEATHERS.includes(s.weather as string)) return 'That save is missing its settings.';
  const p = s.player;
  if (!isObj(p) || !isStr(p.name) || !isNum(p.gold) || p.gold < 0 || p.gold > 1e13 || !isNum(p.energy) || !isNum(p.maxEnergy) || !isNum(p.water)) return 'That save is missing its farmer.';
  if (!isNum(p.x) || !isNum(p.y) || Math.abs(p.x) > FAR || Math.abs(p.y) > FAR || !DIRS.includes(p.dir as string)) return 'That save has the farmer somewhere that is not on the map.';
  if (!isStr(p.loc) || !hasMap(p.loc)) return 'That save has the farmer somewhere that is not on the map.';
  if (!Array.isArray(p.slots) || p.slots.length < 10 || p.slots.length > 200 || !p.slots.every(stackOk)) return 'That save has a bag the game cannot read.';
  if (!isNum(p.selected) || p.selected < 0 || p.selected >= p.slots.length) return 'That save has a bag the game cannot read.';
  if (!isObj(p.tools) || !TOOL_IDS.every((t) => tierOk((p.tools as Record<string, unknown>)[t]))) return 'That save has tools the game cannot read.';
  if (!isObj(s.locations) || !isObj(s.locations.farm)) return 'That save is missing the farm.';
  for (const [id, loc] of Object.entries(s.locations)) {
    if (!hasMap(id) || !isObj(loc) || !isObj(loc.soil) || !isObj(loc.objects) || !isObj(loc.things)) return 'That save has a place the game cannot read.';
    if (soilWrong(loc.soil)) return 'That save has a field the game cannot read.';
    for (const o of Object.values(loc.objects)) if (!isObj(o) || !isStr(o.k) || !Object.hasOwn(OBJECT_HP, o.k) || !isNum(o.v) || !isNum(o.hp)) return 'That save has something on the farm the game does not know.';
    for (const t of Object.values(loc.things)) if (thingWrong(t)) return 'That save has a chest the game cannot read.';
  }
  if (!Array.isArray(s.shipping) || s.shipping.length > 5000 || !s.shipping.every((x) => isObj(x) && known(x.id) && isInt(x.n, 1, 9999))) return 'That save has a shipping bin the game cannot read.';
  for (const k of ['recipes', 'upgrades', 'seen']) if (!strings(s[k])) return 'That save has a list the game cannot read.';
  if (!Array.isArray(s.pets) || s.pets.length > 500 || s.pets.some(petWrong)) return 'That save has animals the game cannot read.';
  if (!Array.isArray(s.requests) || s.requests.length > 500 || s.requests.some(requestWrong)) return 'That save has requests the game cannot read.';
  if (s.forge !== null && !(isObj(s.forge) && TOOL_IDS.includes(s.forge.tool as ToolId) && tierOk(s.forge.tier) && isNum(s.forge.readyDay))) return 'That save has a forge job the game cannot read.';
  for (const k of ['flags', 'stats', 'social', 'bundles']) if (!isObj(s[k])) return 'That save is missing some of its records.';
  if (!Object.values(s.flags as Record<string, unknown>).every((v) => ['boolean', 'number', 'string'].includes(typeof v))) return 'That save has notes the game cannot read.';
  if (!isObj(s.stats) || !STAT_KEYS.every((k) => isNum((s.stats as Record<string, unknown>)[k])) || !isNum(s.deepest)) return 'That save has totals the game cannot read.';
  if (!Object.values(s.social as Record<string, unknown>).every((f) => !friendWrong(f))) return 'That save has friends the game cannot read.';
  if (!Object.values(s.bundles as Record<string, unknown>).every((b) => Array.isArray(b) && b.length <= 100 && b.every(isNum))) return 'That save has lanterns the game cannot read.';
  return null;
}

export type Checked = { ok: true; state: GameState } | { ok: false; msg: string };

/** A parsed save, upgraded if it is old and checked all the way through. */
export function checkSave(parsed: unknown): Checked {
  const upgraded = upgrade(parsed);
  const wrong = whatIsWrong(upgraded);
  return wrong ? { ok: false, msg: wrong } : { ok: true, state: upgraded as GameState };
}
