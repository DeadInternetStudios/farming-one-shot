import { describe, expect, it } from 'vitest';
import { CHICK_DAYS, MAX_EGGS, collectEggs, coopBuilt, eggsWaiting, feedHens, hungryHens, isChick, layEggs, pet } from '../src/game/animals';
import { sleepThrough } from '../src/game/day';
import { addItem, countItem, emptySlots } from '../src/game/inventory';
import type { GameState, Pet } from '../src/game/state';
import { newGame } from '../src/game/state';
import { buildMap } from '../src/world/maps/registry';

const hen = (id: string, over: Partial<Pet> = {}): Pet => ({ id, kind: 'chicken', name: id, fedDay: 0, happy: 50, ...over });

function farmWithCoop(hens = 2): GameState {
  const st = newGame(1);
  st.day = 5;
  st.flags.coopDay = 2;
  for (let i = 0; i < hens; i++) st.pets.push(hen(`hen-${i + 1}`, { since: 1 }));
  return st;
}

describe('the coop', () => {
  it('stands the morning after it is ordered', () => {
    const st = newGame(1);
    expect(coopBuilt(st)).toBe(false);
    st.flags.coopDay = st.day;
    expect(coopBuilt(st)).toBe(false);
    st.day += 1;
    expect(coopBuilt(st)).toBe(true);
  });

  it('appears on the farm map only once it is built', () => {
    const st = newGame(1);
    st.flags.coopDay = 1;
    expect(buildMap('farm', st).buildings.some((b) => b.sprite === 'building/coop')).toBe(false);
    st.day = 2;
    const farm = buildMap('farm', st);
    expect(farm.buildings.some((b) => b.sprite === 'building/coop')).toBe(true);
    expect(farm.hotspots.some((h) => h.kind === 'coop')).toBe(true);
  });
});

describe('hens', () => {
  it('eat one hay each, as far as the hay goes', () => {
    const st = farmWithCoop(3);
    st.player.slots = emptySlots(20);
    addItem(st.player.slots, 'hay', 2);
    const r = feedHens(st);
    expect(r).toEqual({ fed: 2, hungry: 3 });
    expect(countItem(st.player.slots, 'hay')).toBe(0);
    expect(hungryHens(st)).toHaveLength(1);
  });

  it('lay an egg overnight only when fed and grown', () => {
    const st = farmWithCoop(3);
    st.pets[0]!.fedDay = st.day;
    st.pets[1]!.fedDay = st.day;
    st.pets[1]!.since = st.day - 1;
    expect(isChick(st, st.pets[1]!)).toBe(true);
    expect(layEggs(st)).toBe(1);
    expect(eggsWaiting(st)).toBe(1);
    expect(st.pets[2]!.happy).toBeLessThan(50);
  });

  it('grow up after a few days', () => {
    const st = farmWithCoop(1);
    const h = st.pets[0] as Pet;
    h.since = st.day;
    expect(isChick(st, h)).toBe(true);
    st.day += CHICK_DAYS;
    expect(isChick(st, h)).toBe(false);
  });

  it('stop laying when the basket is full', () => {
    const st = farmWithCoop(4);
    st.flags.eggs = MAX_EGGS - 1;
    for (const h of st.pets) h.fedDay = st.day;
    expect(layEggs(st)).toBe(1);
    expect(eggsWaiting(st)).toBe(MAX_EGGS);
  });

  it('send their eggs to the bag, but only as many as fit', () => {
    const st = farmWithCoop(1);
    st.flags.eggs = 5;
    st.player.slots = emptySlots(1);
    addItem(st.player.slots, 'egg', 97);
    expect(collectEggs(st)).toBe(2);
    expect(eggsWaiting(st)).toBe(3);
    expect(countItem(st.player.slots, 'egg')).toBe(99);
  });

  it('turn into eggs in the morning summary', () => {
    const st = farmWithCoop(2);
    for (const h of st.pets) h.fedDay = st.day;
    const summary = sleepThrough(st, (id) => buildMap(id, st), false);
    expect(summary.eggs).toBe(2);
    expect(eggsWaiting(st)).toBe(2);
  });
});

describe('petting', () => {
  it('counts for friendship once a day', () => {
    const st = farmWithCoop(1);
    st.pets.push({ id: 'cat', kind: 'cat', name: 'Marmalade', fedDay: 0, happy: 50 });
    expect(pet(st, 'cat')).toBe(true);
    expect(pet(st, 'cat')).toBe(false);
    st.day += 1;
    expect(pet(st, 'cat')).toBe(true);
    expect(pet(st, 'nobody')).toBe(false);
  });
});
