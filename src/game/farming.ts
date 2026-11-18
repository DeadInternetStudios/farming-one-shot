import { CROPS } from '../data/items';
import { DAYS_PER_SEASON, dayOfSeason, seasonOf } from './clock';
import type { CropDef } from '../data/items';
import type { Rand } from './rng';
import type { Dir, Season, Tier, Tile } from './types';
import { DIR_VEC, tileKey } from './types';

export interface CropState {
  id: string;
  /** Days of growth so far. Ripe once it reaches the crop's days. */
  age: number;
  /** True after a harvest of a crop that grows back. */
  regrowing: boolean;
  dead: boolean;
}

export interface SoilState {
  wet: boolean;
  crop?: CropState;
}
export type SoilMap = Record<string, SoilState>;

export const cropStageCount = (def: CropDef): number => Math.min(6, Math.max(4, def.days + 1));

export function cropDef(id: string): CropDef {
  const d = CROPS[id];
  if (!d) throw new Error(`Unknown crop: ${id}`);
  return d;
}

export function isRipe(c: CropState): boolean {
  return !c.dead && c.age >= cropDef(c.id).days;
}

export function cropStage(c: CropState): number {
  const def = cropDef(c.id);
  const n = cropStageCount(def);
  if (c.age >= def.days) return n - 1;
  return Math.min(n - 2, Math.floor((c.age / def.days) * (n - 1)));
}

/** Atlas frame name for a crop as it looks right now. */
export function cropFrame(c: CropState): string {
  if (c.dead) return `crop/${c.id}/dead`;
  if (c.regrowing && !isRipe(c)) return `crop/${c.id}/regrow`;
  return `crop/${c.id}/${cropStage(c)}`;
}

export type PlantResult = 'ok' | 'no-soil' | 'occupied' | 'wrong-season';

export function canPlant(soil: SoilState | undefined, cropId: string, season: Season, indoors: boolean): PlantResult {
  if (!soil) return 'no-soil';
  if (soil.crop) return 'occupied';
  if (!indoors && !cropDef(cropId).seasons.includes(season)) return 'wrong-season';
  return 'ok';
}

/** The last day a crop planted on `day` can still be standing: the crop withers on the night its season ends. */
export function lastGoodDay(cropId: string, day: number): number {
  const def = cropDef(cropId);
  let end = Math.ceil(day / DAYS_PER_SEASON) * DAYS_PER_SEASON;
  while (def.seasons.includes(seasonOf(end + 1))) end += DAYS_PER_SEASON;
  return end;
}

/** Whether a crop planted today, and watered every day, is ripe before its season is over. */
export const ripensInTime = (cropId: string, day: number): boolean => day + cropDef(cropId).days <= lastGoodDay(cropId, day);

/** One potato in five comes up as two. */
const POTATO_DOUBLE = 0.2;

/**
 * What one tile earns from a crop planted on `day` and watered every day: every harvest that fits
 * in the seasons the crop likes, less the seed. Minus infinity when it cannot ripen in time.
 */
export function cropProfit(cropId: string, day: number): number {
  const def = cropDef(cropId);
  if (!def.seasons.includes(seasonOf(day)) || !ripensInTime(cropId, day)) return -Infinity;
  const first = day + def.days;
  const harvests = def.regrow > 0 ? 1 + Math.floor((lastGoodDay(cropId, day) - first) / def.regrow) : 1;
  const yieldEach = def.yield + (cropId === 'potato' ? POTATO_DOUBLE : 0);
  return harvests * yieldEach * def.sell - def.seed;
}

/** One line telling the player how long they have to get a seed in the ground, and whether it will pay. `warn` is set when planting now is a mistake. */
export function plantAdviceFor(cropId: string, day: number): { text: string; warn: boolean } {
  const last = lastGoodDay(cropId, day) - cropDef(cropId).days;
  if (last < day) return { text: 'Too late to plant this season.', warn: true };
  let best = -1;
  for (let d = day; d <= last; d++) if (cropProfit(cropId, d) > 0) best = d;
  if (best < day) return { text: 'Planted now, it loses money.', warn: true };
  if (best === day) return { text: 'Plant it today to turn a profit.', warn: false };
  const name = seasonOf(best);
  return { text: `Plant by ${name.charAt(0).toUpperCase()}${name.slice(1)} ${dayOfSeason(best)}.`, warn: false };
}

export const plantAdvice = (cropId: string, day: number): string => plantAdviceFor(cropId, day).text;

export function plant(soils: SoilMap, key: string, cropId: string): void {
  const s = soils[key];
  if (!s) throw new Error('plant: no soil at ' + key);
  s.crop = { id: cropId, age: 0, regrowing: false, dead: false };
}

export interface Harvest {
  id: string;
  n: number;
}

/** Takes the crop off a tile if it is ripe. Crops that grow back go back to growing. */
export function harvest(soils: SoilMap, key: string, rand: Rand): Harvest | null {
  const s = soils[key];
  const c = s?.crop;
  if (!s || !c || !isRipe(c)) return null;
  const def = cropDef(c.id);
  let n = def.yield;
  if (c.id === 'potato' && rand() < POTATO_DOUBLE) n += 1;
  if (def.regrow > 0) {
    c.age = def.days - def.regrow;
    c.regrowing = true;
  } else {
    delete s.crop;
  }
  return { id: c.id, n };
}

/** Pulls out a dead crop. */
export function clearDead(soils: SoilMap, key: string): boolean {
  const s = soils[key];
  if (!s?.crop?.dead) return false;
  delete s.crop;
  return true;
}

export function till(soils: SoilMap, key: string): void {
  if (!soils[key]) soils[key] = { wet: false };
}

/** Turns empty soil back into grass. */
export function untill(soils: SoilMap, key: string): boolean {
  const s = soils[key];
  if (!s || s.crop) return false;
  delete soils[key];
  return true;
}

export interface NightReport {
  grew: number;
  ripe: number;
  thirsty: number;
}

/**
 * The night between two days. Watered crops grow one day, then the soil dries.
 * Rain for the new day is applied afterwards with `applyRain`.
 */
export function growOvernight(soils: SoilMap): NightReport {
  const r: NightReport = { grew: 0, ripe: 0, thirsty: 0 };
  for (const s of Object.values(soils)) {
    const c = s.crop;
    if (c && !c.dead) {
      if (s.wet) {
        const wasRipe = isRipe(c);
        c.age += 1;
        r.grew += 1;
        if (!wasRipe && isRipe(c)) r.ripe += 1;
      } else if (!isRipe(c)) {
        r.thirsty += 1;
      }
    }
    s.wet = false;
  }
  return r;
}

export function applyRain(soils: SoilMap): void {
  for (const s of Object.values(soils)) s.wet = true;
}

/** Crops that cannot live in the new season wither. Returns how many. */
export function witherOutOfSeason(soils: SoilMap, season: Season): number {
  let n = 0;
  for (const s of Object.values(soils)) {
    const c = s.crop;
    if (c && !c.dead && !cropDef(c.id).seasons.includes(season)) {
      c.dead = true;
      n += 1;
    }
  }
  return n;
}

// ---------- tools ----------

const TIER_INDEX: Record<Tier, number> = { basic: 0, copper: 1, silver: 2, gold: 3 };
export const tierIndex = (t: Tier): number => TIER_INDEX[t];

const BASE_ENERGY = { hoe: 2, can: 1, axe: 3, pick: 3, scythe: 1, rod: 1.5 } as const;
const TIER_ENERGY = [1, 0.85, 0.7, 0.55] as const;
export function toolEnergy(tool: keyof typeof BASE_ENERGY, tier: Tier): number {
  return Math.round(BASE_ENERGY[tool] * (TIER_ENERGY[TIER_INDEX[tier]] ?? 1) * 100) / 100;
}

export const CAN_CAPACITY: Record<Tier, number> = { basic: 18, copper: 26, silver: 36, gold: 50 };
export const TOOL_DAMAGE: Record<Tier, number> = { basic: 1, copper: 2, silver: 3, gold: 4 };

/** Tiles a watering can reaches from the tile in front of the player. */
export function waterTiles(origin: Tile, dir: Dir, tier: Tier): Tile[] {
  const f = DIR_VEC[dir];
  const side = { x: -f.y, y: f.x };
  const out: Tile[] = [];
  const at = (fwd: number, lat: number): Tile => ({ x: origin.x + f.x * fwd + side.x * lat, y: origin.y + f.y * fwd + side.y * lat });
  const t = TIER_INDEX[tier];
  if (t === 0) out.push(at(0, 0));
  else if (t === 1) for (let i = 0; i < 3; i++) out.push(at(i, 0));
  else if (t === 2) for (let i = 0; i < 3; i++) for (let l = -1; l <= 1; l++) out.push(at(i, l));
  else for (let i = 0; i < 5; i++) for (let l = -1; l <= 1; l++) out.push(at(i, l));
  return out;
}

/** Waters tiles that hold soil, spending one water each. Returns the tiles actually watered. */
export function waterSoil(soils: SoilMap, tiles: Tile[], water: number): { watered: Tile[]; used: number } {
  const watered: Tile[] = [];
  let used = 0;
  for (const t of tiles) {
    if (used >= water) break;
    const s = soils[tileKey(t.x, t.y)];
    if (s && !s.wet) {
      s.wet = true;
      watered.push(t);
      used += 1;
    }
  }
  return { watered, used };
}
