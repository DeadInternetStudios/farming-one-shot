import { describe, expect, it } from 'vitest';
import { BUNDLE_BY_ID, BUNDLES } from '../src/data/bundles';
import { donate, giveable, giving } from '../src/game/bundles';
import { addItem } from '../src/game/inventory';
import { newGame } from '../src/game/state';

// The shrine's button says how many things it will give. That number and what the button then does come from two functions,
// so they are checked against each other: a button that says "Give 3 items" has to give three.

const spring = BUNDLE_BY_ID['spring'];
if (!spring) throw new Error('the spring bundle is gone');

const giveAll = (st: ReturnType<typeof newGame>): number =>
  spring.slots.reduce((sum, _, i) => sum + donate(st, spring.id, i).gave, 0);

describe('what the shrine will take', () => {
  it('nothing in the bag means nothing to give', () => {
    const st = newGame(1);
    for (const b of BUNDLES) expect(giveable(st, b)).toBe(0);
  });

  it('counts each slot up to what it still needs, not up to what the bag holds', () => {
    const st = newGame(1);
    addItem(st.player.slots, 'radish', 5);
    addItem(st.player.slots, 'cauliflower', 1);
    expect(giveable(st, spring)).toBe(2 + 1);
  });

  it('is exactly what giving then hands over', () => {
    const st = newGame(1);
    addItem(st.player.slots, 'radish', 1);
    addItem(st.player.slots, 'potato', 3);
    addItem(st.player.slots, 'tulip', 2);
    const said = giveable(st, spring);
    expect(said).toBe(1 + 2 + 2);
    expect(giveAll(st)).toBe(said);
  });

  it('forgets a slot that is already full, and counts what is left once some has been given', () => {
    const st = newGame(1);
    addItem(st.player.slots, 'radish', 2);
    giveAll(st);
    addItem(st.player.slots, 'radish', 2);
    addItem(st.player.slots, 'potato', 1);
    expect(giveable(st, spring)).toBe(1);
  });
});

describe('what the shrine will take, by name', () => {
  it('lists each kind the bag would hand over, so the button and the card can say them before the press', () => {
    const st = newGame(3, 'Rowan');
    expect(giving(st, spring)).toEqual([]);
    for (const slot of spring.slots.slice(0, 2)) addItem(st.player.slots, slot.any[0] as string, slot.n);
    const list = giving(st, spring);
    expect(list.length).toBe(2);
    const listed = list.reduce((n, g) => n + g.n, 0);
    expect(listed).toBe(giveable(st, spring));
    // and the list is what a press then gives
    expect(giveAll(st)).toBe(listed);
  });
});
