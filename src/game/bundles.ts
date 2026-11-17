import { BUNDLES, BUNDLE_BY_ID } from '../data/bundles';
import type { BundleDef, BundleSlot } from '../data/bundles';
import { addItem, countItem, removeItem } from './inventory';
import type { GameState } from './state';

export function progressOf(state: GameState, b: BundleDef): number[] {
  let p = state.bundles[b.id];
  if (!p) {
    p = b.slots.map(() => 0);
    state.bundles[b.id] = p;
  }
  return p;
}

export const slotDone = (state: GameState, b: BundleDef, i: number): boolean => (progressOf(state, b)[i] ?? 0) >= (b.slots[i] as BundleSlot).n;
export const isComplete = (state: GameState, b: BundleDef): boolean => b.slots.every((_, i) => slotDone(state, b, i));
export const completed = (state: GameState): BundleDef[] => BUNDLES.filter((b) => isComplete(state, b));
export const litCount = (state: GameState): number => completed(state).length;
export const allLit = (state: GameState): boolean => litCount(state) === BUNDLES.length;

/** How many of a slot the player could give right now, using the bag. */
export function available(state: GameState, slot: BundleSlot): { id: string; n: number } | null {
  for (const id of slot.any) {
    const n = countItem(state.player.slots, id);
    if (n > 0) return { id, n };
  }
  return null;
}

export interface DonateResult {
  gave: number;
  itemId: string | null;
  completedNow: boolean;
  reward: BundleDef['reward'] | null;
}

/** Give everything useful the bag holds to one slot of a bundle. */
export function donate(state: GameState, bundleId: string, index: number): DonateResult {
  const b = BUNDLE_BY_ID[bundleId];
  const none: DonateResult = { gave: 0, itemId: null, completedNow: false, reward: null };
  if (!b) return none;
  const slot = b.slots[index];
  if (!slot) return none;
  const prog = progressOf(state, b);
  const need = slot.n - (prog[index] ?? 0);
  if (need <= 0) return none;
  const have = available(state, slot);
  if (!have) return none;
  const give = Math.min(need, have.n);
  const wasDone = isComplete(state, b);
  removeItem(state.player.slots, have.id, give);
  prog[index] = (prog[index] ?? 0) + give;
  const nowDone = !wasDone && isComplete(state, b);
  if (nowDone) {
    state.player.gold += b.reward.gold;
    if (b.reward.item) addItem(state.player.slots, b.reward.item.id, b.reward.item.n);
  }
  return { gave: give, itemId: have.id, completedNow: nowDone, reward: nowDone ? b.reward : null };
}
