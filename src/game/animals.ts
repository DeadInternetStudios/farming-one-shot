import { addItem, canAdd, countItem, removeItem } from './inventory';
import type { GameState, Pet } from './state';

/** Where the coop stands on the farm, in tiles. The yard in front of it is the hens' pen. */
export const COOP = { x: 19, y: 6, w: 4, h: 4 } as const;
export const PEN = { x: 17, y: 10, w: 9, h: 4 } as const;
export const MAX_HENS = 4;
export const MAX_EGGS = 12;
/** Days a new chicken stays a chick before it lays. */
export const CHICK_DAYS = 3;

/** The coop is ordered at the store and stands the morning after. */
export function coopBuilt(st: GameState): boolean {
  const day = st.flags.coopDay;
  return typeof day === 'number' && day < st.day;
}

export const henList = (st: GameState): Pet[] => st.pets.filter((p) => p.kind === 'chicken');
export const catOf = (st: GameState): Pet | undefined => st.pets.find((p) => p.kind === 'cat');

export const isChick = (st: GameState, hen: Pet): boolean => hen.since !== undefined && st.day - hen.since < CHICK_DAYS;

/** Hens in the coop that have not had their hay today. */
export const hungryHens = (st: GameState): Pet[] => henList(st).filter((h) => h.fedDay !== st.day);

export const eggsWaiting = (st: GameState): number => (typeof st.flags.eggs === 'number' ? st.flags.eggs : 0);

export interface Feeding {
  fed: number;
  hungry: number;
}

/** Spend one hay on each hungry hen. Feeds as many as the hay allows. */
export function feedHens(st: GameState): Feeding {
  const hungry = hungryHens(st);
  const hay = Math.min(hungry.length, countItem(st.player.slots, 'hay'));
  if (hay > 0) removeItem(st.player.slots, 'hay', hay);
  hungry.slice(0, hay).forEach((h) => {
    h.fedDay = st.day;
    h.happy = Math.min(100, h.happy + 4);
  });
  return { fed: hay, hungry: hungry.length };
}

/** Take the eggs from the basket into the bag, as many as fit. */
export function collectEggs(st: GameState): number {
  let n = eggsWaiting(st);
  while (n > 0 && !canAdd(st.player.slots, 'egg', n)) n -= 1;
  if (n <= 0) return 0;
  addItem(st.player.slots, 'egg', n);
  st.flags.eggs = eggsWaiting(st) - n;
  return n;
}

/** Each grown hen that was fed today lays an egg overnight. Hungry hens grow a little sad. */
export function layEggs(st: GameState): number {
  let laid = 0;
  for (const h of henList(st)) {
    if (isChick(st, h)) continue;
    if (h.fedDay === st.day) {
      laid += 1;
      h.happy = Math.min(100, h.happy + 2);
    } else {
      h.happy = Math.max(0, h.happy - 3);
    }
  }
  const room = MAX_EGGS - eggsWaiting(st);
  laid = Math.max(0, Math.min(laid, room));
  st.flags.eggs = eggsWaiting(st) + laid;
  return laid;
}

/** A pet is happy when it gets attention. Once a day it counts. */
export function pet(st: GameState, id: string): boolean {
  const p = st.pets.find((q) => q.id === id);
  if (!p) return false;
  p.happy = Math.min(100, p.happy + 3);
  if (p.petDay === st.day) return false;
  p.petDay = st.day;
  p.happy = Math.min(100, p.happy + 5);
  return true;
}
