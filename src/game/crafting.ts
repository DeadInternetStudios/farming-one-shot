import { RECIPES } from '../data/recipes';
import type { Ingredient, Recipe } from '../data/recipes';
import { addItem, canAdd, countItem, removeItem } from './inventory';
import type { Slots } from './inventory';
import type { GameState } from './state';

const options = (ing: Ingredient): string[] => ing.of.split('|');

/** Which item ids would be used for an ingredient, in the order they would be taken. */
export function plan(slots: Slots, ing: Ingredient): { id: string; n: number }[] | null {
  let need = ing.n;
  const out: { id: string; n: number }[] = [];
  for (const id of options(ing)) {
    const have = countItem(slots, id);
    if (have <= 0) continue;
    const take = Math.min(have, need);
    out.push({ id, n: take });
    need -= take;
    if (need <= 0) return out;
  }
  return null;
}

export const have = (slots: Slots, ing: Ingredient): number => options(ing).reduce((a, id) => a + countItem(slots, id), 0);
export const canMake = (slots: Slots, r: Recipe): boolean => r.ingredients.every((i) => plan(slots, i) !== null) && canAdd(slots, r.makes, r.n);

export function known(state: GameState, kind: Recipe['kind']): Recipe[] {
  return RECIPES.filter((r) => r.kind === kind && state.recipes.includes(r.id));
}

export function make(state: GameState, r: Recipe): boolean {
  const slots = state.player.slots;
  if (!canMake(slots, r)) return false;
  const takes = r.ingredients.map((i) => plan(slots, i) as { id: string; n: number }[]);
  for (const t of takes) for (const x of t) removeItem(slots, x.id, x.n);
  addItem(slots, r.makes, r.n);
  return true;
}
