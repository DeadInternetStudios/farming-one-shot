import { describe, expect, it } from 'vitest';
import { EVENING, SUN, daylight, minutesPerSecond, sunClock, sunIsUp } from '../src/game/clock';
import type { PaceId } from '../src/game/clock';
import { SEASONS } from '../src/game/types';
import { hushed, lampOn, rgb, skyFor } from '../src/systems/sky';

describe('the evening', () => {
  it('falls slowly, in every season: full light before the first gold, none by the time the blue is in', () => {
    for (const season of SEASONS) {
      const set = SUN[season].set;
      expect(daylight(season, set - 90)).toBe(1);
      expect(daylight(season, set + 110)).toBe(0);
      let last = 1;
      for (let m = set - 90; m <= set + 120; m += 5) {
        const d = daylight(season, m);
        expect(d).toBeLessThanOrEqual(last + 1e-9);
        last = d;
      }
    }
  });

  it('takes about half a minute of real time at the standard pace, and longer when the day is relaxed', () => {
    const seconds = (pace: PaceId): number => (EVENING.to - EVENING.from) / minutesPerSecond(pace);
    expect(seconds('standard')).toBeGreaterThan(25);
    expect(seconds('standard')).toBeLessThan(40);
    expect(seconds('relaxed')).toBeGreaterThan(seconds('standard'));
  });

  it('comes up faster in the morning and never dips on the way', () => {
    for (const season of SEASONS) {
      const rise = SUN[season].rise;
      expect(daylight(season, rise - 60)).toBe(0);
      expect(daylight(season, rise + 60)).toBe(1);
      let last = 0;
      for (let m = rise - 60; m <= rise + 70; m += 5) {
        const d = daylight(season, m);
        expect(d).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
    }
  });

  it('knows which half of the day it is, even after midnight', () => {
    expect(sunClock('summer', SUN.summer.set)).toEqual({ evening: true, m: 0 });
    expect(sunClock('summer', 60)).toEqual({ evening: true, m: 60 + 24 * 60 - SUN.summer.set });
    expect(sunClock('summer', 6 * 60)).toEqual({ evening: false, m: 6 * 60 - SUN.summer.rise });
    expect(sunClock('winter', 6 * 60).m).toBeLessThan(0);
  });
});

describe('the clock', () => {
  it('shows a sun until the sun touches the horizon and a moon until it clears it again, in every season', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      const { rise, set } = SUN[season];
      expect(sunIsUp(season, set - 1)).toBe(true);
      expect(sunIsUp(season, set)).toBe(false);
      expect(sunIsUp(season, 24 * 60 + 90)).toBe(false);
      expect(sunIsUp(season, rise - 1)).toBe(false);
      expect(sunIsUp(season, rise)).toBe(true);
      expect(sunIsUp(season, 12 * 60)).toBe(true);
    }
  });
});

describe('the colour of the valley', () => {
  it('is untouched at noon with no lamps lit', () => {
    const s = skyFor('spring', 12 * 60, 'sun', 'outdoor');
    expect(s.ambient).toBe(0xffffff);
    expect(s.lamps).toBe(0);
    expect(s.lift).toBe(0);
  });

  it('is a lit blue night once the evening is over: every lamp on and blue added back into the shadows', () => {
    const s = skyFor('spring', SUN.spring.set + 120, 'sun', 'outdoor');
    expect(s.lamps).toBe(1);
    expect(s.lift).toBeGreaterThan(0.95);
    const blue = s.ambient & 255;
    const red = (s.ambient >> 16) & 255;
    expect(blue).toBeGreaterThan(red * 1.8);
  });

  it('is warm at the first gold, rose after the sun, never bluer than red until dusk is nearly over', () => {
    const gold = skyFor('spring', SUN.spring.set - 5, 'sun', 'outdoor').ambient;
    expect((gold >> 16) & 255).toBeGreaterThan(gold & 255);
    const rose = skyFor('spring', SUN.spring.set + 25, 'sun', 'outdoor').ambient;
    expect((rose >> 16) & 255).toBeGreaterThan(rose & 255);
  });

  it('adds the low sun back as light: none at noon, gold at the horizon, violet a little after, none in a storm or indoors', () => {
    const at = (m: number, weather: 'sun' | 'storm' = 'sun', kind: 'outdoor' | 'interior' | 'cave' = 'outdoor'): number[] => rgb(skyFor('spring', SUN.spring.set + m, weather, kind).glow);
    expect(skyFor('spring', 12 * 60, 'sun', 'outdoor').glow).toBe(0);
    const gold = at(-8);
    expect(gold[0]).toBeGreaterThan((gold[2] as number) * 4);
    const violet = at(42);
    expect(violet[2]).toBeGreaterThan(violet[0] as number);
    expect(skyFor('spring', SUN.spring.set + 120, 'sun', 'outdoor').glow).toBe(0);
    expect(at(-8, 'storm')).toEqual([0, 0, 0]);
    expect(at(-8, 'sun', 'interior')).toEqual([0, 0, 0]);
    expect(at(-8, 'sun', 'cave')).toEqual([0, 0, 0]);
  });

  it('hangs the sun low for a while either side of the horizon, behind the left edge in the evening and the right in the morning', () => {
    const at = (m: number, weather: 'sun' | 'storm' = 'sun') => skyFor('spring', m, weather, 'outdoor');
    expect(at(12 * 60).low).toBe(0);
    expect(at(SUN.spring.set + 120).low).toBe(0);
    expect(at(SUN.spring.set - 10).low).toBeGreaterThan(0.9);
    expect(at(SUN.spring.set - 10).side).toBe(-1);
    expect(at(SUN.spring.set - 60).low).toBeGreaterThan(0.2);
    expect(at(SUN.spring.rise + 5).low).toBeGreaterThan(0.8);
    expect(at(SUN.spring.rise + 5).side).toBe(1);
    expect(at(SUN.spring.set - 10, 'storm').low).toBe(0);
    expect(skyFor('spring', SUN.spring.set - 10, 'sun', 'interior').low).toBe(0);
    expect(skyFor('spring', SUN.spring.set - 10, 'sun', 'cave').low).toBe(0);
  });

  it('keeps rooms and caves out of the outdoor blue', () => {
    expect(skyFor('spring', SUN.spring.set + 120, 'sun', 'interior').lift).toBe(0);
    expect(skyFor('spring', 12 * 60, 'sun', 'cave').lift).toBe(0);
  });

  it('lights lamps earlier in rain than in sun', () => {
    const m = SUN.fall.set - 20;
    expect(skyFor('fall', m, 'rain', 'outdoor').lamps).toBeGreaterThan(skyFor('fall', m, 'sun', 'outdoor').lamps);
  });
});

describe('the hush over the shrine', () => {
  const noon = skyFor('spring', 12 * 60, 'sun', 'outdoor');
  const night = skyFor('spring', SUN.spring.set + 150, 'sun', 'outdoor');

  it('changes nothing at zero', () => {
    expect(hushed(noon, 0)).toBe(noon);
  });

  it('turns a bright noon into dusk with every lamp lit, and gives the sun back its glow to none', () => {
    const dusk = hushed(skyFor('spring', SUN.spring.set - 10, 'sun', 'outdoor'), 1);
    const [r, g, b] = rgb(dusk.ambient);
    expect(Math.max(r, g, b)).toBeLessThan(200);
    expect(b).toBeGreaterThan(r);
    expect(dusk.lamps).toBe(1);
    expect(dusk.glow).toBe(0);
    expect(dusk.low).toBe(0);
    expect(hushed(noon, 1).lift).toBeGreaterThan(0.4);
  });

  it('never makes a dark sky brighter, and gets there a little at a time', () => {
    const [nr, ng, nb] = rgb(night.ambient);
    const [hr, hg, hb] = rgb(hushed(night, 1).ambient);
    expect(hr).toBeLessThanOrEqual(nr);
    expect(hg).toBeLessThanOrEqual(ng);
    expect(hb).toBeLessThanOrEqual(nb);
    const half = rgb(hushed(noon, 0.5).ambient);
    const full = rgb(hushed(noon, 1).ambient);
    expect(half[0]).toBeGreaterThan(full[0]);
    expect(half[0]).toBeLessThan(255);
  });
});

describe('the lamps', () => {
  const spots = Array.from({ length: 40 }, (_, i) => [24 + i * 37, 90 + ((i * 53) % 170)] as const);

  it('are all off before the evening and all on after it', () => {
    for (const [x, y] of spots) {
      expect(lampOn(0, x, y)).toBe(0);
      expect(lampOn(1, x, y)).toBe(1);
    }
  });

  it('come on one at a time: halfway through some glow and some are still dark', () => {
    const now = spots.map(([x, y]) => lampOn(0.4, x, y));
    expect(now.some((v) => v === 1)).toBe(true);
    expect(now.some((v) => v === 0)).toBe(true);
    expect(new Set(now.map((v) => v.toFixed(2))).size).toBeGreaterThan(8);
  });

  it('never go out as the evening goes on', () => {
    for (const [x, y] of spots) {
      let last = 0;
      for (let lamps = 0; lamps <= 1.0001; lamps += 0.05) {
        const v = lampOn(lamps, x, y);
        expect(v).toBeGreaterThanOrEqual(last - 1e-9);
        last = v;
      }
    }
  });

  it('keep the same moment for the same lamp from one frame to the next', () => {
    expect(lampOn(0.37, 120, 88)).toBe(lampOn(0.37, 120, 88));
  });
});
