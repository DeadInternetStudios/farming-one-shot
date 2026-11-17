import { emptySlots, addItem } from './inventory';
import type { Slots } from './inventory';
import type { SoilMap } from './farming';
import { DAY_START } from './clock';
import type { PaceId } from './clock';
import type { Dir, LocationId, Tier, ToolId, Weather } from './types';
import type { ObjectKind } from '../world/mapkit';
import { farmMap } from '../world/maps/farm';
import { OBJECT_HP } from '../world/mapkit';
import { tileKey } from './types';

export const SAVE_VERSION = 1;

export interface ObjectState {
  k: ObjectKind;
  v: number;
  hp: number;
}

export interface LocationState {
  soil: SoilMap;
  objects: Record<string, ObjectState>;
}

export interface PlayerState {
  name: string;
  loc: LocationId;
  /** Feet position in world pixels. */
  x: number;
  y: number;
  dir: Dir;
  energy: number;
  maxEnergy: number;
  gold: number;
  tools: Record<ToolId, Tier>;
  slots: Slots;
  selected: number;
  water: number;
}

export interface GameState {
  version: number;
  seed: number;
  pace: PaceId;
  day: number;
  minute: number;
  weather: Weather;
  player: PlayerState;
  locations: Record<LocationId, LocationState>;
  /** Items waiting in the shipping bin for tonight. */
  shipping: { id: string; n: number }[];
  /** Everything the story and the tutorial remember. */
  flags: Record<string, boolean | number | string>;
  stats: { earned: number; shipped: number; harvested: number; daysPlayed: number };
}

export const HOTBAR_SIZE = 10;
export const START_SLOTS = 20;

export function locationFromMap(objects: { k: ObjectKind; x: number; y: number; v: number }[]): LocationState {
  const out: LocationState = { soil: {}, objects: {} };
  for (const o of objects) out.objects[tileKey(o.x, o.y)] = { k: o.k, v: o.v, hp: OBJECT_HP[o.k] };
  return out;
}

export function newGame(seed = 1, name = 'Sprout', pace: PaceId = 'standard'): GameState {
  const farm = farmMap(seed);
  const slots = emptySlots(START_SLOTS);
  for (const t of ['hoe', 'can', 'axe', 'pick', 'scythe'] as const) addItem(slots, t, 1);
  addItem(slots, 'seed-radish', 12);
  addItem(slots, 'seed-potato', 6);
  return {
    version: SAVE_VERSION,
    seed,
    pace,
    day: 1,
    minute: DAY_START,
    weather: 'sun',
    player: {
      name, loc: 'farm', x: (farm.spawn.x + 0.5) * 16, y: (farm.spawn.y + 0.8) * 16, dir: 'down',
      energy: 100, maxEnergy: 100, gold: 500,
      tools: { hoe: 'basic', can: 'basic', axe: 'basic', pick: 'basic', scythe: 'basic', rod: 'basic' },
      slots, selected: 0, water: 18,
    },
    locations: { farm: locationFromMap(farm.objects) },
    shipping: [],
    flags: {},
    stats: { earned: 0, shipped: 0, harvested: 0, daysPlayed: 1 },
  };
}
