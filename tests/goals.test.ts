import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLES } from '../src/data/bundles';
import { NPCS } from '../src/data/npcs';
import { FESTIVAL_NAMES } from '../src/data/festivals';
import { GARDEN_ON } from '../src/features/garden/catalog';
import { nextGoal } from '../src/game/goals';
import type { GameState } from '../src/game/state';
import { newGame } from '../src/game/state';

const fresh = (): GameState => newGame(1);
const soil = (st: GameState) => (st.locations.farm as NonNullable<GameState['locations']['farm']>).soil;
const meet = (st: GameState, ...ids: string[]): void => {
  for (const id of ids) st.social[id] = { points: 0, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
};
const id = (st: GameState): string | undefined => nextGoal(st)?.id;

describe('the last day of a season', () => {
  it('warns about crops the next season will take', () => {
    const st = fresh();
    st.flags.outside = true;
    st.stats.harvested = 5;
    st.stats.shipped = 5;
    meet(st, 'mirren', 'bram', 'ida', 'tam');
    st.flags.shrineSeen = true;
    st.deepest = 1;
    st.day = 13; // summer 6
    soil(st)['5,5'] = { wet: true, crop: { id: 'melon', age: 3, regrowing: false, dead: false } };
    expect(id(st)).not.toBe('season-end');
    st.day = 14;
    st.minute = 12 * 60;
    expect(id(st)).toBe('festival-today');
    st.flags['fair-14'] = 'second';
    expect(id(st)).toBe('season-end');
    // a crop that carries on into fall is fine
    soil(st)['5,5'] = { wet: true, crop: { id: 'corn', age: 3, regrowing: false, dead: false } };
    expect(id(st)).not.toBe('season-end');
  });
});

describe('the next goal', () => {
  it('walks a new player through the first day', () => {
    const st = fresh();
    expect(st.player.loc).toBe('house');
    expect(id(st)).toBe('door');
    st.flags.outside = true;
    expect(id(st)).toBe('dig');
    soil(st)['5,5'] = { wet: false };
    expect(id(st)).toBe('plant');
    soil(st)['5,5'] = { wet: false, crop: { id: 'radish', age: 0, regrowing: false, dead: false } };
    expect(id(st)).toBe('water');
    (soil(st)['5,5'] as { wet: boolean }).wet = true;
    expect(id(st)).toBe('clear');
    st.minute = 18 * 60;
    expect(id(st)).toBe('sleep');
  });

  it('asks for the harvest, then the bin, then the village', () => {
    const st = fresh();
    st.flags.outside = true;
    st.day = 4;
    soil(st)['5,5'] = { wet: true, crop: { id: 'radish', age: 3, regrowing: false, dead: false } };
    expect(id(st)).toBe('harvest');
    delete (soil(st)['5,5'] as { crop?: unknown }).crop;
    st.stats.harvested = 1;
    expect(id(st)).toBe('ship');
    st.stats.shipped = 1;
    soil(st)['5,5'] = { wet: true, crop: { id: 'radish', age: 1, regrowing: false, dead: false } };
    expect(id(st)).toBe('village');
    meet(st, 'mirren');
    expect(id(st)).toBe('meet');
    meet(st, 'bram', 'ida', 'tam');
    expect(id(st)).toBe('shrine');
    st.flags.shrineSeen = true;
    expect(id(st)).not.toBe('shrine');
  });

  it('puts the fair first on the day and the evening before', () => {
    const st = fresh();
    st.flags.outside = true;
    st.day = 7;
    st.minute = 9 * 60;
    expect(id(st)).toBe('festival-today');
    st.day = 6;
    st.minute = 18 * 60;
    expect(id(st)).toBe('festival-eve');
    st.minute = 12 * 60;
    expect(id(st)).not.toBe('festival-eve');
  });

  it('stops pointing at a fair once you have entered it, and waits for the lanterns at night', () => {
    const st = fresh();
    st.flags.outside = true;
    st.day = 14;
    st.minute = 12 * 60;
    expect(id(st)).toBe('festival-today');
    st.flags['fair-14'] = 'second';
    expect(id(st)).not.toBe('festival-today');

    st.day = 28;
    st.minute = 12 * 60;
    expect(nextGoal(st)?.text).toBe('The Lantern Festival is tonight');
    st.minute = 19 * 60;
    expect(nextGoal(st)?.text).toBe('Be at the shrine when the lanterns rise');
    st.flags.finaleDay = 28;
    expect(id(st)).not.toBe('festival-today');

    delete st.flags.finaleDay;
    st.day = 29;
    expect(id(st)).toBe('finale-late');
  });

  it('keeps going once the basics are done, and finishes with the lanterns', () => {
    const st = fresh();
    st.flags.outside = true;
    st.day = 9;
    st.stats.harvested = 9;
    st.stats.shipped = 9;
    st.stats.caught = 1;
    st.deepest = 2;
    meet(st, ...NPCS.map((n) => n.id));
    st.flags.shrineSeen = true;
    soil(st)['5,5'] = { wet: true, crop: { id: 'radish', age: 1, regrowing: false, dead: false } };
    // with gold in the pocket, the garden comes up first; with none, or once a lantern is out, it does not
    expect(id(st)).toBe(GARDEN_ON ? 'garden' : 'lantern');
    st.player.gold = 40;
    expect(id(st)).toBe('lantern');
    st.player.gold = 900;
    (st.locations.farm as { objects: Record<string, unknown> }).objects['9,9'] = { k: 'decor', v: 0, hp: 1 };
    expect(id(st)).toBe('lantern');
    for (const b of BUNDLES) st.bundles[b.id] = b.slots.map((s) => s.n);
    expect(id(st)).toBe('finale');
  });

  it('always fits on one line of the interface', () => {
    const xml = readFileSync(join(__dirname, '..', 'public', 'assets', 'font-hollow.xml'), 'utf8');
    const advance = new Map<number, number>();
    for (const m of xml.matchAll(/<char id="(\d+)"[^>]*xadvance="(\d+)"/g)) advance.set(Number(m[1]), Number(m[2]));
    const width = (s: string): number => [...s].reduce((a, c) => a + (advance.get(c.charCodeAt(0)) ?? 6), 0);

    const samples: string[] = [];
    const st = fresh();
    const push = (): void => { const g = nextGoal(st); if (g) samples.push(g.text); };
    push();
    st.flags.outside = true;
    for (const day of [1, 2, 6, 7, 13, 14, 20, 21, 27, 28]) for (const minute of [8 * 60, 18 * 60]) { st.day = day; st.minute = minute; push(); }
    for (const name of Object.values(FESTIVAL_NAMES)) samples.push(`${name} is on in the village`, `${name} opens at 10 in the village`, `${name} is tomorrow`);
    samples.push('The Lantern Festival is tonight', 'Be at the shrine when the lanterns rise', 'Olwen is waiting at the shrine after dark');
    for (const b of BUNDLES) samples.push(`Fill the ${b.name}`);
    samples.push('Say hello to the villagers (0 of 6)', 'Sleep in your bed to grow the crops', 'Dig a patch of soil with the hoe', 'All lanterns lit! Festival: Winter 7');
    expect(samples.length).toBeGreaterThan(15);
    for (const s of samples) expect(width(s), s).toBeLessThanOrEqual(200);
  });
});
