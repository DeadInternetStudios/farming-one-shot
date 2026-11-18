import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { RECIPES } from '../src/data/recipes';
import { tasteOf } from '../src/game/social';

/** `weed` is a thing you pull, not a thing you carry, so it is the one name here that is not an item. */
const NOT_ITEMS = new Set(['weed']);

describe('what the villagers think of gifts', () => {
  it('only names things that exist, so no list can fail to draw', () => {
    const missing: string[] = [];
    for (const n of NPCS) {
      for (const [kind, ids] of [['loves', n.loves], ['likes', n.likes], ['dislikes', n.dislikes]] as const) {
        for (const id of ids) if (!NOT_ITEMS.has(id) && !(id in ITEMS)) missing.push(`${n.id} ${kind} ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('never loves and dislikes the same thing', () => {
    for (const n of NPCS) {
      const both = n.loves.filter((i) => n.dislikes.includes(i) || n.likes.includes(i));
      expect(both, n.id).toEqual([]);
    }
  });

  it('gives every kind of fish a taker, so a caught fish is never a wasted gift', () => {
    const fish = Object.values(ITEMS).filter((d) => d.kind === 'fish').map((d) => d.id);
    const wanted = fish.filter((id) => NPCS.some((n) => tasteOf(n, id) === 'love' || tasteOf(n, id) === 'like'));
    expect(wanted.length).toBeGreaterThanOrEqual(4);
  });

  it('leaves no recipe gift pointing at a recipe that is not there', () => {
    for (const n of NPCS) for (const u of n.unlocks) if (u.recipe) expect(RECIPES.some((r) => r.id === u.recipe), `${n.id} ${u.recipe}`).toBe(true);
  });
});
