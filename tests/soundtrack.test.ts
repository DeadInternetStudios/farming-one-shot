import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_FILES, BED_NAMES, SFX_NAMES, TRACK_NAMES } from '../src/gen/audio';
import { NEXT_TRACKS, bedLevels, festivalToday, musicLevel, trackFor } from '../src/game/soundtrack';
import type { Listening } from '../src/game/soundtrack';

const root = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const base: Listening = { place: 'farm', music: 'farm', kind: 'outdoor', day: 2, season: 'spring', minute: 9 * 60, weather: 'sun' };
const at = (patch: Partial<Listening>): Listening => ({ ...base, ...patch });

describe('the sound files', () => {
  it('has both formats on disk for everything listed', () => {
    for (const f of AUDIO_FILES) for (const url of f.urls) expect(existsSync(join(root, 'public', url)), url).toBe(true);
  });

  it('plays only sounds that exist', () => {
    const known = new Set<string>(SFX_NAMES);
    const used = new Set<string>();
    for (const file of sources(join(root, 'src'))) {
      const text = readFileSync(file, 'utf8');
      // the name is either the whole argument or one side of a ternary; quotes after === are comparisons, not sounds
      for (const m of text.matchAll(/emit\('sfx',([^;]*?)\);/g)) for (const lit of (m[1] as string).matchAll(/(?:^|[?:])\s*'([a-z-]+)'/g)) used.add(lit[1] as string);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const name of used) expect(known.has(name), `"${name}" is played but never made`).toBe(true);
  });

  it('gives every map a tune that was written', () => {
    for (const file of sources(join(root, 'src', 'world', 'maps'))) {
      const m = /\.music = '([a-z-]+)'/.exec(readFileSync(file, 'utf8'));
      if (m) expect(TRACK_NAMES as readonly string[], file).toContain(m[1]);
    }
  });

  it('can reach every tune from the title', () => {
    const seen = new Set<string>(['title']);
    const queue: string[] = ['title'];
    while (queue.length) {
      for (const n of NEXT_TRACKS[queue.shift() as (typeof TRACK_NAMES)[number]]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    expect([...seen].sort()).toEqual([...TRACK_NAMES].sort());
  });
});

describe('which tune plays', () => {
  it('follows the place by day', () => {
    expect(trackFor(base)).toBe('farm');
    expect(trackFor(at({ place: 'village', music: 'village' }))).toBe('village');
    expect(trackFor(at({ place: 'house', music: 'home', kind: 'interior' }))).toBe('home');
    expect(trackFor(at({ place: 'mine-3', music: 'mine', kind: 'cave' }))).toBe('mine');
  });

  it('falls back to the farm tune for a place nobody wrote one for', () => {
    expect(trackFor(at({ music: 'nowhere' }))).toBe('farm');
  });

  it('turns to the night tune outdoors in the evening, but not indoors or underground', () => {
    expect(trackFor(at({ minute: 21 * 60 }))).toBe('night');
    expect(trackFor(at({ minute: 20 * 60 }))).toBe('farm');
    expect(trackFor(at({ minute: 23 * 60, music: 'home', kind: 'interior' }))).toBe('home');
    expect(trackFor(at({ minute: 23 * 60, music: 'mine', kind: 'cave' }))).toBe('mine');
  });

  it('plays festival music in the village on festival days, and the lantern song after dusk on the last one', () => {
    const village = { place: 'village', music: 'village' };
    expect(festivalToday(7)).toBe('blossom');
    expect(festivalToday(28)).toBe('lantern');
    expect(festivalToday(8)).toBeNull();
    expect(festivalToday(28 + 14)).toBe('sunfair');
    expect(trackFor(at({ ...village, day: 7, minute: 12 * 60 }))).toBe('festival');
    expect(trackFor(at({ ...village, day: 7, minute: 9 * 60 }))).toBe('village');
    expect(trackFor(at({ ...village, day: 28, minute: 14 * 60 }))).toBe('festival');
    expect(trackFor(at({ ...village, day: 28, minute: 19 * 60 }))).toBe('lantern');
    expect(trackFor(at({ place: 'farm', day: 7, minute: 12 * 60 }))).toBe('farm');
  });

  it('keeps the tune a little lower in the rain, outdoors only', () => {
    expect(musicLevel(base)).toBe(1);
    expect(musicLevel(at({ weather: 'rain' }))).toBeLessThan(1);
    expect(musicLevel(at({ weather: 'storm' }))).toBeLessThan(musicLevel(at({ weather: 'rain' })));
    expect(musicLevel(at({ weather: 'storm', kind: 'interior' }))).toBe(1);
  });
});

describe('which background sounds play', () => {
  const levels = (l: Listening) => bedLevels(l);

  it('names every background sound and keeps each between 0 and 1', () => {
    for (const l of [base, at({ weather: 'storm' }), at({ kind: 'cave' }), at({ minute: 22 * 60 }), at({ place: 'lake' })]) {
      expect(Object.keys(levels(l)).sort()).toEqual([...BED_NAMES].sort());
      for (const v of Object.values(levels(l))) expect(v >= 0 && v <= 1).toBe(true);
    }
  });

  it('hears birds on a spring morning and crickets at night, never both', () => {
    const morning = levels(base);
    expect(morning['amb-birds']).toBeGreaterThan(0.5);
    expect(morning['amb-crickets']).toBe(0);
    const night = levels(at({ minute: 22 * 60 }));
    expect(night['amb-crickets']).toBeGreaterThan(0.5);
    expect(night['amb-birds']).toBe(0);
  });

  it('is quiet of birds and crickets in the cold and the wet', () => {
    expect(levels(at({ season: 'winter' }))['amb-birds']).toBe(0);
    expect(levels(at({ season: 'winter', minute: 22 * 60 }))['amb-crickets']).toBe(0);
    expect(levels(at({ weather: 'rain' }))['amb-birds']).toBe(0);
    expect(levels(at({ weather: 'rain', minute: 22 * 60 }))['amb-crickets']).toBe(0);
  });

  it('lets the rain in softly through walls and not at all underground', () => {
    const out = levels(at({ weather: 'rain' }))['amb-rain'];
    const inside = levels(at({ weather: 'rain', kind: 'interior' }))['amb-rain'];
    expect(out).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(0);
    expect(levels(at({ weather: 'storm' }))['amb-rain']).toBeGreaterThan(out);
    expect(levels(at({ weather: 'rain', kind: 'cave' }))['amb-rain']).toBe(0);
  });

  it('has only the cave hum underground and the lapping of water at the lake', () => {
    const cave = levels(at({ kind: 'cave', place: 'mine-1' }));
    expect(cave['amb-cave']).toBe(1);
    expect(Object.entries(cave).filter(([k, v]) => k !== 'amb-cave' && v > 0)).toEqual([]);
    expect(levels(at({ place: 'lake' }))['amb-water']).toBeGreaterThan(0);
    expect(levels(base)['amb-water']).toBe(0);
  });
});
