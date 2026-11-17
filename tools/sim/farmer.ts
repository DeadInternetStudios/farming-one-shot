// A bot that plays the farm the way a steady player does, on the real rules: the same tool costs,
// the same overnight growth, the same shipping bin and the same shop prices as the game.
// Walking and animation are not simulated. Each action is charged a few game minutes instead, so a day
// can run out of time as well as out of energy, the way a real day does.
import { CROP_LIST, cropOfSeed } from '../../src/data/items';
import { ITEMS } from '../../src/data/items';
import { interactTile, useSeed, useTool } from '../../src/game/actions';
import type { Ctx } from '../../src/game/actions';
import { seasonOf } from '../../src/game/clock';
import { sleepThrough } from '../../src/game/day';
import { CAN_CAPACITY, cropProfit, isRipe, ripensInTime } from '../../src/game/farming';
import { countItem, removeItem } from '../../src/game/inventory';
import { mulberry32 } from '../../src/game/rng';
import { buy } from '../../src/game/shop';
import { newGame } from '../../src/game/state';
import type { GameState } from '../../src/game/state';
import { tileKey } from '../../src/game/types';
import { farmMap } from '../../src/world/maps/farm';
import type { MapDef } from '../../src/world/mapkit';

export interface Profile {
  name: string;
  /** Game minutes one tile action costs, walking included. A real day is 1200 of them. */
  actionMin: number;
  /** A refill trip to the well. */
  refillMin: number;
  /** A round trip to the store, shopping included. */
  storeMin: number;
  /** The most tiles this player is willing to tend. */
  maxField: number;
  /** How much of the day they give to the farm before they stop for the evening, in game minutes. */
  workMin: number;
}

export const PROFILES: Record<string, Profile> = {
  casual: { name: 'casual', actionMin: 11, refillMin: 60, storeMin: 190, maxField: 24, workMin: 700 },
  steady: { name: 'steady', actionMin: 8, refillMin: 45, storeMin: 150, maxField: 60, workMin: 1000 },
  keen: { name: 'keen', actionMin: 6, refillMin: 35, storeMin: 120, maxField: 120, workMin: 1150 },
};

export interface DayRecord {
  day: number;
  gold: number;
  /** What the bin paid out overnight. */
  earned: number;
  /** What went on seeds today. */
  spent: number;
  tiles: number;
  planted: number;
  harvested: number;
  withered: number;
  energyLeft: number;
  minutesLeft: number;
  note: string;
}

export interface Run {
  profile: Profile;
  days: DayRecord[];
  state: GameState;
}

interface Bot {
  st: GameState;
  map: MapDef;
  ctx: Ctx;
  p: Profile;
  minutes: number;
  field: { x: number; y: number }[];
}

const SEEDS = new Set(CROP_LIST.map((c) => `seed-${c.id}`));

const fieldTiles = (map: MapDef, st: GameState, n: number): { x: number; y: number }[] => {
  const l = st.locations.farm;
  if (!l) return [];
  const out: { x: number; y: number; d: number }[] = [];
  for (let y = 2; y < map.h - 2; y++) {
    for (let x = 2; x < map.w - 2; x++) {
      const i = y * map.w + x;
      if (!map.tillable[i] || map.solid[i] || map.overlay[i] || l.objects[tileKey(x, y)]) continue;
      out.push({ x, y, d: Math.abs(x - 17) + Math.abs(y - 14) * 1.2 });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, n);
};

function spend(b: Bot, minutes: number): boolean {
  if (b.minutes < minutes) return false;
  b.minutes -= minutes;
  return true;
}

const slotOf = (st: GameState, id: string): number => st.player.slots.findIndex((s) => s?.id === id);

function ship(b: Bot): void {
  const slots = b.st.player.slots;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    const d = ITEMS[s.id];
    if (!d || (d.kind !== 'crop' && d.kind !== 'forage' && d.kind !== 'fish' && d.kind !== 'goods')) continue;
    b.st.shipping.push({ id: s.id, n: s.n });
    slots[i] = null;
  }
}

/** Seeds to buy today, best first, limited by gold and by the tiles waiting for them. */
function seedPlan(b: Bot, free: number): { id: string; n: number }[] {
  const day = b.st.day;
  const ranked = CROP_LIST.map((c) => ({ c, profit: cropProfit(c.id, day) }))
    .filter((q) => q.profit > 0 && (q.c.id !== 'strawberry' || b.st.flags['festival-strawberry']))
    .sort((a, c) => c.profit - a.profit);
  let gold = b.st.player.gold;
  let room = free;
  const out: { id: string; n: number }[] = [];
  for (const { c } of ranked) {
    if (room <= 0) break;
    const have = countItem(b.st.player.slots, `seed-${c.id}`);
    const n = Math.min(room, Math.max(have, have + Math.floor(gold / c.seed)));
    if (n <= 0) continue;
    gold -= Math.max(0, n - have) * c.seed;
    room -= n;
    out.push({ id: `seed-${c.id}`, n });
  }
  return out;
}

function plantedCount(b: Bot): number {
  const l = b.st.locations.farm;
  return l ? Object.values(l.soil).filter((s) => s.crop && !s.crop.dead).length : 0;
}

function playDay(b: Bot): DayRecord {
  const st = b.st;
  const l = st.locations.farm;
  if (!l) throw new Error('no farm');
  const p = st.player;
  const startGold = p.gold;
  b.minutes = b.p.workMin;
  let note = '';
  let harvested = 0;
  let planted = 0;

  // harvest everything ripe, then clear anything dead
  for (const t of b.field) {
    const s = l.soil[tileKey(t.x, t.y)];
    if (!s?.crop) continue;
    if (s.crop.dead) {
      if (spend(b, b.p.actionMin)) useTool(b.ctx, 'scythe', t.x, t.y, 'down');
      continue;
    }
    if (isRipe(s.crop) && spend(b, b.p.actionMin)) {
      const before = st.stats.harvested;
      interactTile(b.ctx, t.x, t.y);
      harvested += st.stats.harvested - before;
    }
  }
  if (spend(b, 20)) ship(b);

  // seeds for every tile that is empty or about to be: this is the day's shopping
  const tilled = b.field.filter((t) => l.soil[tileKey(t.x, t.y)]);
  const empty = tilled.filter((t) => !l.soil[tileKey(t.x, t.y)]?.crop);
  const open = Math.max(0, Math.min(b.p.maxField, b.field.length) - plantedCount(b));
  // a new tile costs about two and a half actions and two and a half energy to dig, sow and water; an old one costs one of each to water
  const keep = plantedCount(b);
  const afterStore = b.minutes - (open > 0 ? b.p.storeMin : 0) - keep * b.p.actionMin - Math.ceil(keep / 18) * b.p.refillMin;
  const byTime = Math.floor(afterStore / (2.5 * b.p.actionMin + b.p.refillMin / 18));
  const byEnergy = Math.floor((p.energy - keep) / 2.5);
  const room = Math.max(0, Math.min(open, byTime, byEnergy));
  const plan = seedPlan(b, room);
  const needsStore = plan.some((q) => countItem(p.slots, q.id) < q.n);
  if (plan.length > 0 && needsStore) {
    if (spend(b, b.p.storeMin)) {
      for (const q of plan) {
        const need = q.n - countItem(p.slots, q.id);
        if (need > 0) buy(st, q.id, need);
      }
    } else note += 'no time for the store; ';
  }

  // water reserve: leave enough energy to water what is planted and what we are about to plant
  const canCost = 1;
  const seedsInBag = [...SEEDS].reduce((a, id) => a + countItem(p.slots, id), 0);
  const toPlant = Math.min(seedsInBag, room);
  const waterReserve = (plantedCount(b) + toPlant) * canCost * 0.9;

  // till more ground for the seeds in the bag
  let tileNeed = Math.max(0, toPlant - empty.length);
  for (const t of b.field) {
    if (tileNeed <= 0) break;
    if (l.soil[tileKey(t.x, t.y)]) continue;
    if (p.energy - 2 < waterReserve || !spend(b, b.p.actionMin)) break;
    const r = useTool(b.ctx, 'hoe', t.x, t.y, 'down');
    if (r.ok) tileNeed -= 1;
  }

  // plant the best seeds first
  const order = plan.map((q) => q.id);
  for (const t of b.field) {
    const s = l.soil[tileKey(t.x, t.y)];
    if (!s || s.crop) continue;
    const id = order.find((sid) => countItem(p.slots, sid) > 0 && ripensInTime(cropOfSeed(sid)?.id ?? '', st.day));
    if (!id) break;
    if (!spend(b, b.p.actionMin)) break;
    const r = useSeed(b.ctx, id, slotOf(st, id), t.x, t.y);
    if (r.ok) planted += 1;
  }

  // water every dry crop, refilling at the well
  let dry = b.field.filter((t) => {
    const s = l.soil[tileKey(t.x, t.y)];
    return s?.crop && !s.crop.dead && !s.wet;
  });
  for (const t of dry) {
    const s = l.soil[tileKey(t.x, t.y)];
    if (!s?.crop || s.wet) continue;
    if (p.water <= 0) {
      if (!spend(b, b.p.refillMin)) break;
      p.water = CAN_CAPACITY[p.tools.can];
    }
    if (p.energy < 1 || !spend(b, b.p.actionMin)) break;
    useTool(b.ctx, 'can', t.x, t.y, 'down');
  }
  dry = b.field.filter((t) => {
    const s = l.soil[tileKey(t.x, t.y)];
    return s?.crop && !s.crop.dead && !s.wet;
  });
  if (dry.length > 0) note += `${dry.length} crops went thirsty; `;

  const record: DayRecord = {
    day: st.day, gold: 0, earned: 0, spent: Math.max(0, startGold - p.gold), tiles: plantedCount(b), planted, harvested, withered: 0,
    energyLeft: Math.round(p.energy), minutesLeft: b.minutes, note,
  };
  const summary = sleepThrough(st, () => b.map, false);
  record.withered = summary.withered;
  record.gold = p.gold;
  record.earned = summary.earned;
  return record;
}

/** Plays a year of farming and nothing else. Returns one record per day. */
export function playFarm(profile: Profile, days = 28, seed = 1): Run {
  const st = newGame(seed);
  const map = farmMap(seed, st);
  const rand = mulberry32(seed);
  const ctx: Ctx = { state: st, map, rand };
  const field = fieldTiles(map, st, profile.maxField);
  const b: Bot = { st, map, ctx, p: profile, minutes: 0, field };
  const records: DayRecord[] = [];
  for (let i = 0; i < days; i++) {
    const season = seasonOf(st.day);
    // nothing grows in winter and the ground is frozen, so the farmer just ships what they have
    const rec = season === 'winter' ? winterDay(b) : playDay(b);
    records.push(rec);
  }
  return { profile, days: records, state: st };
}

function winterDay(b: Bot): DayRecord {
  const st = b.st;
  const before = st.player.gold;
  ship(b);
  const rec: DayRecord = {
    day: st.day, gold: 0, earned: 0, spent: 0, tiles: 0, planted: 0, harvested: 0, withered: 0, energyLeft: 100, minutesLeft: 0, note: 'winter',
  };
  const summary = sleepThrough(st, () => b.map, false);
  rec.gold = st.player.gold;
  rec.earned = summary.earned;
  void before;
  return rec;
}

export { removeItem };
