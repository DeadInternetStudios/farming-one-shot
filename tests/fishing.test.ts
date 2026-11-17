import { describe, expect, it } from 'vitest';
import { FishFight, barSize, biteDelay, fishHere, rollCatch } from '../src/game/fishing';
import type { Conditions } from '../src/game/fishing';
import { mulberry32 } from '../src/game/rng';

const at = (over: Partial<Conditions>): Conditions => ({ map: 'lake', season: 'spring', minute: 12 * 60, weather: 'sun', rodTier: 0, ...over });
const ids = (c: Conditions): string[] => fishHere(c).map((f) => f.id);

/** A player with ordinary reactions: they see the fish a moment late and chase it with the green bar. */
function play(seed: number, difficulty: number, lag = 0.15, size = barSize(0, false)): FishFight {
  const fight = new FishFight(mulberry32(seed), difficulty, size);
  const seen: number[] = [];
  let prev = fight.zone;
  for (let t = 0; t < 60 * 60 && fight.state === 'on'; t++) {
    seen.push(fight.fish);
    const fish = seen[Math.max(0, seen.length - 1 - Math.round(lag * 60))] as number;
    const vel = (fight.zone - prev) * 60;
    prev = fight.zone;
    fight.step(1 / 60, fish - fight.zone - vel * 0.22 > 0);
  }
  return fight;
}

describe('what bites', () => {
  it('follows the season, the hour and the weather', () => {
    expect(ids(at({}))).toEqual(expect.arrayContaining(['fish-minnow', 'fish-perch', 'fish-carp', 'fish-trout']));
    expect(ids(at({}))).not.toContain('fish-eel');
    expect(ids(at({ season: 'fall', minute: 18 * 60 }))).toContain('fish-eel');
    expect(ids(at({ season: 'fall', minute: 18 * 60 }))).not.toContain('fish-trout');
    expect(ids(at({ weather: 'rain', minute: 19 * 60 }))).toContain('fish-eel');
    expect(ids(at({ season: 'winter' }))).not.toContain('fish-carp');
    expect(ids(at({ minute: 19 * 60 }))).toContain('fish-koi');
    expect(ids(at({ minute: 10 * 60 }))).not.toContain('fish-koi');
  });

  it('keeps the forest pond small', () => {
    expect(ids(at({ map: 'forest' })).sort()).toEqual(['fish-carp', 'fish-minnow', 'fish-perch']);
  });

  it('can bring up anything on the list, and now and then only weeds', () => {
    const rand = mulberry32(5);
    const seen = new Set<string | null>();
    for (let i = 0; i < 3000; i++) seen.add(rollCatch(rand, at({ season: 'summer', minute: 19 * 60, weather: 'rain' })).item);
    for (const id of ids(at({ season: 'summer', minute: 19 * 60, weather: 'rain' }))) expect(seen.has(id), id).toBe(true);
    expect(seen.has(null)).toBe(true);
  });

  it('bites sooner at dusk and with a better rod, but never instantly', () => {
    const avg = (c: Conditions): number => {
      const rand = mulberry32(3);
      let t = 0;
      for (let i = 0; i < 400; i++) t += biteDelay(rand, c);
      return t / 400;
    };
    expect(avg(at({ minute: 18 * 60 }))).toBeLessThan(avg(at({ minute: 13 * 60 })));
    expect(avg(at({ rodTier: 3 }))).toBeLessThan(avg(at({ rodTier: 0 })));
    const rand = mulberry32(8);
    for (let i = 0; i < 400; i++) expect(biteDelay(rand, at({ minute: 18 * 60, weather: 'rain', rodTier: 3 }))).toBeGreaterThanOrEqual(1.1);
  });
});

describe('the fight', () => {
  const winRate = (difficulty: number, lag = 0.15): number => {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) if (play(seed, difficulty, lag).state === 'won') wins += 1;
    return wins / 60;
  };

  it('is usually won by someone paying attention, and gets harder with the fish', () => {
    expect(winRate(0.12)).toBeGreaterThanOrEqual(0.95);
    expect(winRate(0.3)).toBeGreaterThanOrEqual(0.9);
    expect(winRate(0.5)).toBeGreaterThanOrEqual(0.85);
    expect(winRate(0.66)).toBeGreaterThanOrEqual(0.5);
    expect(winRate(0.92)).toBeLessThan(winRate(0.5));
  });

  it('is lost by someone who never holds on', () => {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const fight = new FishFight(mulberry32(seed), 0.5, barSize(0, false));
      for (let t = 0; t < 60 * 50 && fight.state === 'on'; t++) fight.step(1 / 60, false);
      if (fight.state === 'won') wins += 1;
    }
    expect(wins).toBeLessThanOrEqual(2);
  });

  it('takes long enough to feel like something, and never forever', () => {
    for (const d of [0.12, 0.5]) {
      for (let seed = 1; seed <= 20; seed++) {
        const f = play(seed, d);
        expect(f.elapsed).toBeGreaterThan(4);
        expect(f.elapsed).toBeLessThanOrEqual(45.1);
      }
    }
  });

  it('forgives the first moments while you find the fish, then notices a slip', () => {
    const f = new FishFight(mulberry32(1), 0.1, 0.3);
    for (let i = 0; i < 60; i++) f.step(1 / 60, false);
    expect(f.perfect).toBe(true);
    for (let i = 0; i < 60; i++) f.step(1 / 60, false);
    expect(f.perfect).toBe(false);
  });

  it('gives a bigger bar to a better rod and to a friend of Tam', () => {
    expect(barSize(3, false)).toBeGreaterThan(barSize(0, false));
    expect(barSize(0, true)).toBeGreaterThan(barSize(0, false));
  });
});
