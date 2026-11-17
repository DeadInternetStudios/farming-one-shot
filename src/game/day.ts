import { itemDef } from '../data/items';
import { DAY_START, dayOfSeason, seasonOf } from './clock';
import { CAN_CAPACITY, applyRain, growOvernight, witherOutOfSeason } from './farming';
import type { NightReport } from './farming';
import { refreshRequests } from './requests';
import { chance, pick, randInt, rngFor } from './rng';
import type { Rand } from './rng';
import type { GameState } from './state';
import type { Season, Weather } from './types';
import { parseKey, tileKey } from './types';
import { OBJECT_HP } from '../world/mapkit';
import type { MapDef, ObjectKind } from '../world/mapkit';

const WEATHER_ODDS: Record<Season, readonly [Weather, number][]> = {
  spring: [['sun', 55], ['cloud', 20], ['rain', 25]],
  summer: [['sun', 64], ['cloud', 14], ['rain', 14], ['storm', 8]],
  fall: [['sun', 48], ['cloud', 26], ['rain', 26]],
  winter: [['sun', 45], ['cloud', 25], ['snow', 30]],
};

/** The same seed and day always give the same weather, so the forecast can be read ahead of time. */
export function weatherFor(seed: number, day: number): Weather {
  if (day <= 3) return 'sun';
  const s = seasonOf(day);
  // festival days are always fair
  if (isFestivalDay(day)) return 'sun';
  const r = rngFor(seed, day, 99);
  const odds = WEATHER_ODDS[s];
  const total = odds.reduce((a, [, w]) => a + w, 0);
  let roll = r() * total;
  for (const [w, weight] of odds) {
    roll -= weight;
    if (roll <= 0) return w;
  }
  return 'sun';
}

export const FESTIVAL_DAYS: Readonly<Record<number, string>> = { 7: 'blossom', 14: 'sunfair', 21: 'harvest', 28: 'lantern' };
export function isFestivalDay(day: number): boolean {
  const s = seasonOf(day);
  const d = dayOfSeason(day);
  return d === 7 && ['spring', 'summer', 'fall', 'winter'].includes(s);
}

export interface DaySummary {
  /** The day that just ended. */
  day: number;
  earned: number;
  sold: { id: string; n: number; gold: number }[];
  night: NightReport;
  withered: number;
  newSeason: Season | null;
  passedOut: boolean;
  lostGold: number;
  weather: Weather;
}

const OUTDOOR = new Set(['farm']);

/** Everything that happens between going to bed and waking up. */
export function sleepThrough(state: GameState, farm: MapDef, passedOut: boolean): DaySummary {
  const oldDay = state.day;
  const oldSeason = seasonOf(oldDay);
  const sold: DaySummary['sold'] = [];
  let earned = 0;
  for (const s of state.shipping) {
    const gold = itemDef(s.id).sell * s.n;
    earned += gold;
    sold.push({ id: s.id, n: s.n, gold });
    state.stats.shipped += s.n;
  }
  state.shipping = [];
  state.player.gold += earned;
  state.stats.earned += earned;

  const night: NightReport = { grew: 0, ripe: 0, thirsty: 0 };
  for (const l of Object.values(state.locations)) {
    const r = growOvernight(l.soil);
    night.grew += r.grew;
    night.ripe += r.ripe;
    night.thirsty += r.thirsty;
  }

  state.day = oldDay + 1;
  const newSeason = seasonOf(state.day);
  let withered = 0;
  if (newSeason !== oldSeason) {
    for (const [id, l] of Object.entries(state.locations)) {
      if (OUTDOOR.has(id)) withered += witherOutOfSeason(l.soil, newSeason);
    }
  }

  state.weather = weatherFor(state.seed, state.day);
  if (state.weather === 'rain' || state.weather === 'storm') {
    for (const [id, l] of Object.entries(state.locations)) if (OUTDOOR.has(id)) applyRain(l.soil);
  }

  spawnClutter(state, farm, rngFor(state.seed, state.day, 5));
  refreshRequests(state);

  const p = state.player;
  let lostGold = 0;
  if (passedOut) {
    lostGold = Math.min(1000, Math.floor(p.gold * 0.08));
    p.gold -= lostGold;
    p.energy = Math.floor(p.maxEnergy * 0.7);
  } else {
    p.energy = p.maxEnergy;
  }
  p.water = CAN_CAPACITY[p.tools.can];
  state.minute = DAY_START;
  state.stats.daysPlayed += 1;

  return { day: oldDay, earned, sold, night, withered, newSeason: newSeason !== oldSeason ? newSeason : null, passedOut, lostGold, weather: state.weather };
}

const CLUTTER_CAP: Partial<Record<ObjectKind, number>> = { weed: 90, tallgrass: 160, branch: 24, flower: 60 };

/** Weeds, branches and wildflowers turn up overnight on open grass, never on soil you made. */
export function spawnClutter(state: GameState, map: MapDef, rand: Rand): void {
  const l = state.locations[map.id];
  if (!l) return;
  const season = seasonOf(state.day);
  const count = (k: ObjectKind): number => Object.values(l.objects).filter((o) => o.k === k).length;
  const open = (x: number, y: number): boolean => {
    const i = y * map.w + x;
    if (!map.tillable[i] || map.overlay[i] || map.solid[i]) return false;
    const key = tileKey(x, y);
    if (l.objects[key] || l.soil[key]) return false;
    // the yard and the first field stay tidy; the wild corners are where the chores grow
    if (x >= 6 && x < 18 && y >= 4 && y < 19) return false;
    return !(x >= 15 && x < 31 && y >= 17 && y < 29);
  };
  const place = (k: ObjectKind, n: number, variants: number): void => {
    if (count(k) >= (CLUTTER_CAP[k] ?? 99)) return;
    for (let tries = 0, placed = 0; tries < n * 30 && placed < n; tries++) {
      const x = randInt(rand, 2, map.w - 3);
      const y = randInt(rand, 2, map.h - 3);
      if (!open(x, y)) continue;
      l.objects[tileKey(x, y)] = { k, v: randInt(rand, 0, variants - 1), hp: OBJECT_HP[k] };
      placed++;
    }
  };
  if (season !== 'winter') {
    place('weed', randInt(rand, 2, 5), 3);
    place('tallgrass', randInt(rand, 3, 7), 4);
    if (season === 'spring' || season === 'summer') place('flower', randInt(rand, 1, 3), 12);
  }
  place('branch', chance(rand, 0.7) ? randInt(rand, 1, 3) : 0, 3);
  // a tree near the edge may drop a branch right beside it
  const trees = Object.entries(l.objects).filter(([, o]) => o.k === 'tree');
  if (trees.length && chance(rand, 0.4)) {
    const [k] = pick(rand, trees);
    const t = parseKey(k);
    const x = t.x + pick(rand, [-1, 1]);
    const y = t.y + 1;
    if (open(x, y)) l.objects[tileKey(x, y)] = { k: 'branch', v: randInt(rand, 0, 2), hp: 1 };
  }
}
