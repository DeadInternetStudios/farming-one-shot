import { emptySlots, addItem } from './inventory';
import type { Slots } from './inventory';
import type { SoilMap } from './farming';
import { DAY_START } from './clock';
import type { PaceId } from './clock';
import type { Dir, LocationId, Tier, ToolId, Weather } from './types';
import type { ObjectKind } from '../world/mapkit';
import { farmMap } from '../world/maps/farm';
import { houseMap } from '../world/maps/house';
import { OBJECT_HP } from '../world/mapkit';
import { tileKey } from './types';
import { STARTER_RECIPES } from '../data/recipes';

export const SAVE_VERSION = 2;

export interface ObjectState {
  k: ObjectKind;
  v: number;
  hp: number;
}

/** Something the player placed: a chest, a furnace or a sprinkler. */
export interface ThingState {
  kind: 'chest' | 'furnace' | 'sprinkler';
  /** Chest contents. */
  items?: Slots;
  /** Furnace work in progress: what goes in, how many bars come out, and when it is done (day * 1440 + minute). */
  job?: { ore: string; bar: string; n: number; readyAt: number };
}

export interface LocationState {
  soil: SoilMap;
  objects: Record<string, ObjectState>;
  things: Record<string, ThingState>;
}

export interface Friend {
  points: number;
  met: boolean;
  talkedDay: number;
  giftedDay: number;
  /** Gifts given this week, and the day that week began. */
  giftsWeek: number;
  weekStart: number;
  /** Heart levels whose bonus has already been given. */
  claimed: number[];
}

export interface Request {
  id: string;
  npc: string;
  item: string;
  n: number;
  reward: number;
  until: number;
}

export interface ForgeJob {
  tool: ToolId;
  tier: Tier;
  readyDay: number;
}

export interface Pet {
  id: string;
  kind: 'chicken' | 'cat';
  name: string;
  /** Last day it was fed. */
  fedDay: number;
  happy: number;
  /** The day it joined the farm. Chickens are chicks for a few days. */
  since?: number;
  /** Last day it was petted. */
  petDay?: number;
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
  stats: { earned: number; shipped: number; harvested: number; daysPlayed: number; caught: number; mined: number };
  social: Record<string, Friend>;
  /** For each bundle, how many of each slot have been given. */
  bundles: Record<string, number[]>;
  recipes: string[];
  requests: Request[];
  forge: ForgeJob | null;
  upgrades: string[];
  pets: Pet[];
  /** The deepest quarry floor reached. */
  deepest: number;
  /** Every kind of item ever held, for the almanac. */
  seen: string[];
}

export const HOTBAR_SIZE = 10;
export const START_SLOTS = 20;

export function locationFromMap(objects: { k: ObjectKind; x: number; y: number; v: number }[]): LocationState {
  const out: LocationState = { soil: {}, objects: {}, things: {} };
  for (const o of objects) out.objects[tileKey(o.x, o.y)] = { k: o.k, v: o.v, hp: OBJECT_HP[o.k] };
  return out;
}

export function newGame(seed = 1, name = 'Sprout', pace: PaceId = 'standard'): GameState {
  const farm = farmMap(seed);
  const house = houseMap(seed);
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
      name, loc: 'house', x: (house.spawn.x + 0.5) * 16, y: (house.spawn.y + 0.8) * 16, dir: 'down',
      energy: 100, maxEnergy: 100, gold: 500,
      tools: { hoe: 'basic', can: 'basic', axe: 'basic', pick: 'basic', scythe: 'basic', rod: 'basic' },
      slots, selected: 0, water: 18,
    },
    locations: { farm: locationFromMap(farm.objects) },
    shipping: [],
    flags: {},
    stats: { earned: 0, shipped: 0, harvested: 0, daysPlayed: 1, caught: 0, mined: 0 },
    social: {},
    bundles: {},
    recipes: [...STARTER_RECIPES],
    requests: [],
    forge: null,
    upgrades: [],
    pets: [],
    deepest: 0,
    seen: [],
  };
}
