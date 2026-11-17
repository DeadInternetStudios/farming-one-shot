import { isFestivalDay } from '../data/festivals';
import { itemDef } from '../data/items';
import { coopBuilt, layEggs } from './animals';
import { DAY_START, seasonOf } from './clock';
import { CAN_CAPACITY, applyRain, growOvernight, witherOutOfSeason } from './farming';
import type { NightReport } from './farming';
import { refreshRequests } from './requests';
import { chance, pick, randInt, rngFor } from './rng';
import type { Rand } from './rng';
import type { GameState, LocationState } from './state';
import type { Season, Weather } from './types';
import { parseKey, tileKey } from './types';
import { GROUND, OBJECT_HP } from '../world/mapkit';
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
  /** Eggs laid in the coop overnight. */
  eggs: number;
}

const OUTDOOR = new Set(['farm']);

/** Every sprinkler waters the four tiles beside it. */
export function sprinkle(l: LocationState): void {
  for (const [key, o] of Object.entries(l.objects)) {
    if (o.k !== 'sprinkler') continue;
    const { x, y } = parseKey(key);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const soil = l.soil[tileKey(x + dx, y + dy)];
      if (soil) soil.wet = true;
    }
  }
}

/** Everything that happens between going to bed and waking up. */
export function sleepThrough(state: GameState, mapOf: (id: string) => MapDef, passedOut: boolean): DaySummary {
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

  const eggs = coopBuilt(state) ? layEggs(state) : 0;

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

  // sprinklers do their work at dawn, after the night's growth has dried everything
  for (const l of Object.values(state.locations)) sprinkle(l);

  spawnClutter(state, mapOf('farm'), rngFor(state.seed, state.day, 5));
  if (state.locations.forest) spawnForage(state, mapOf('forest'), rngFor(state.seed, state.day, 6));
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

  return { day: oldDay, earned, sold, night, withered, newSeason: newSeason !== oldSeason ? newSeason : null, passedOut, lostGold, weather: state.weather, eggs };
}

type Open = (x: number, y: number) => boolean;

/** Drops things onto random open tiles of a map, up to a cap for each kind, never on top of something else. */
function placer(l: LocationState, map: MapDef, rand: Rand, open: Open) {
  const count = (k: ObjectKind): number => Object.values(l.objects).filter((o) => o.k === k).length;
  return (k: ObjectKind, n: number, variants: number, cap: number, where: Open = open): void => {
    if (count(k) >= cap) return;
    for (let tries = 0, placed = 0; tries < n * 30 && placed < n; tries++) {
      const x = randInt(rand, 2, map.w - 3);
      const y = randInt(rand, 2, map.h - 3);
      const key = tileKey(x, y);
      if (!where(x, y) || l.objects[key] || l.soil[key]) continue;
      l.objects[key] = { k, v: randInt(rand, 0, variants - 1), hp: OBJECT_HP[k] };
      placed++;
    }
  };
}

/** Weeds, branches and wildflowers turn up overnight on open grass, never on soil you made. */
export function spawnClutter(state: GameState, map: MapDef, rand: Rand): void {
  const l = state.locations[map.id];
  if (!l) return;
  const season = seasonOf(state.day);
  const open: Open = (x, y) => {
    const i = y * map.w + x;
    if (!map.tillable[i] || map.overlay[i] || map.solid[i]) return false;
    // the yard and the first field stay tidy; the wild corners are where the chores grow
    if (x >= 6 && x < 18 && y >= 4 && y < 19) return false;
    if (x >= 18 && x < 27 && y >= 4 && y < 15) return false;
    return !(x >= 15 && x < 31 && y >= 17 && y < 29);
  };
  const place = placer(l, map, rand, open);
  if (season !== 'winter') {
    place('weed', randInt(rand, 2, 5), 3, 90);
    place('tallgrass', randInt(rand, 3, 7), 4, 160);
    if (season === 'spring' || season === 'summer') place('flower', randInt(rand, 1, 3), 12, 60);
  }
  place('branch', chance(rand, 0.7) ? randInt(rand, 1, 3) : 0, 3, 24);
  // a tree near the edge may drop a branch right beside it
  const trees = Object.entries(l.objects).filter(([, o]) => o.k === 'tree');
  if (trees.length && chance(rand, 0.4)) {
    const [k] = pick(rand, trees);
    const t = parseKey(k);
    const x = t.x + pick(rand, [-1, 1]);
    const y = t.y + 1;
    const key = tileKey(x, y);
    if (open(x, y) && !l.objects[key] && !l.soil[key]) l.objects[key] = { k: 'branch', v: randInt(rand, 0, 2), hp: 1 };
  }
}

/** The wood grows things back overnight: mushrooms, berries, wild flowers and the odd lump of clay. */
export function spawnForage(state: GameState, map: MapDef, rand: Rand): void {
  const l = state.locations[map.id];
  if (!l) return;
  const season = seasonOf(state.day);
  const grassy: Open = (x, y) => {
    const i = y * map.w + x;
    return map.ground[i] === GROUND.Grass && !map.overlay[i] && !map.solid[i];
  };
  const place = placer(l, map, rand, (x, y) => grassy(x, y) && x > 4 && x < 36 && y > 8 && y < 36);
  place('mushroom', season === 'winter' ? randInt(rand, 0, 1) : randInt(rand, 1, 3), 2, 14);
  if (season !== 'winter') place('berries', randInt(rand, 1, 2), 2, 8);
  if (season === 'spring' || season === 'summer') place('flower', randInt(rand, 1, 3), 12, 30);
  if (chance(rand, 0.25)) place('clay', 1, 1, 4, (x, y) => grassy(x, y) && x > 23 && x < 37 && y > 16 && y < 32);
}
