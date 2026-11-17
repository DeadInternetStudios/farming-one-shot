import { itemDef } from '../data/items';
import { addItem, canAdd, countItem, removeItem } from './inventory';
import type { GameState, ThingState } from './state';

export interface Smelt {
  ore: string;
  bar: string;
  /** Ore needed for one bar. */
  need: number;
  /** In-game minutes for each bar. */
  minutes: number;
}

export const SMELTS: readonly Smelt[] = [
  { ore: 'copperOre', bar: 'copperBar', need: 4, minutes: 40 },
  { ore: 'ironOre', bar: 'ironBar', need: 4, minutes: 70 },
  { ore: 'goldOre', bar: 'goldBar', need: 4, minutes: 100 },
];

export const MAX_BATCH = 5;
const COAL_PER_BAR = 1;

/** Every minute of every day, counted from the start of the game. */
export const clockMinutes = (state: GameState): number => state.day * 1440 + Math.floor(state.minute);

export type FurnaceState = 'idle' | 'working' | 'ready';

export function furnaceState(state: GameState, t: ThingState): FurnaceState {
  if (!t.job) return 'idle';
  return clockMinutes(state) >= t.job.readyAt ? 'ready' : 'working';
}

/** How many bars the bag can feed right now. */
export function batchFor(state: GameState, s: Smelt): number {
  const slots = state.player.slots;
  return Math.min(MAX_BATCH, Math.floor(countItem(slots, s.ore) / s.need), Math.floor(countItem(slots, 'coal') / COAL_PER_BAR));
}

export function startSmelt(state: GameState, t: ThingState, s: Smelt): { ok: boolean; msg: string } {
  if (t.job) return { ok: false, msg: 'The furnace is busy.' };
  const n = batchFor(state, s);
  if (n <= 0) return { ok: false, msg: `You need ${s.need} ${itemDef(s.ore).name} and 1 Coal for a bar.` };
  removeItem(state.player.slots, s.ore, n * s.need);
  removeItem(state.player.slots, 'coal', n * COAL_PER_BAR);
  t.job = { ore: s.ore, bar: s.bar, n, readyAt: clockMinutes(state) + n * s.minutes };
  return { ok: true, msg: `Smelting ${n} ${itemDef(s.bar).name}.` };
}

export function collectBars(state: GameState, t: ThingState): { ok: boolean; msg: string } {
  const job = t.job;
  if (!job) return { ok: false, msg: 'Nothing to collect.' };
  if (furnaceState(state, t) !== 'ready') return { ok: false, msg: 'Not done yet.' };
  if (!canAdd(state.player.slots, job.bar, job.n)) return { ok: false, msg: 'Your bag is full.' };
  addItem(state.player.slots, job.bar, job.n);
  t.job = undefined;
  return { ok: true, msg: `Took ${job.n} ${itemDef(job.bar).name}.` };
}

/** Minutes until a job is done, for the furnace screen. */
export const minutesLeft = (state: GameState, t: ThingState): number => (t.job ? Math.max(0, t.job.readyAt - clockMinutes(state)) : 0);
