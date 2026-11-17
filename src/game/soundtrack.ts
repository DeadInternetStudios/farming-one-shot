import { BED_NAMES, TRACK_NAMES } from '../gen/audio';
import type { BedName, TrackName } from '../gen/audio';
import type { MapKind } from '../world/mapkit';
import { seasonOf } from './clock';
import { festivalToday } from '../data/festivals';
import type { GameState } from './state';
import type { Season, Weather } from './types';

/** Everything that decides what you should be hearing right now. */
export interface Listening {
  place: string;
  music: string;
  kind: MapKind;
  day: number;
  season: Season;
  minute: number;
  weather: Weather;
}

export function listeningTo(st: GameState, map: { id: string; music: string; kind: MapKind }): Listening {
  return { place: map.id, music: map.music, kind: map.kind, day: st.day, season: seasonOf(st.day), minute: st.minute, weather: st.weather };
}

const NIGHT_FROM = 20 * 60 + 30;
const FEAST_FROM = 10 * 60;
const FEAST_TO = 23 * 60;
const LANTERN_FROM = 18 * 60;

const isTrack = (s: string): s is TrackName => (TRACK_NAMES as readonly string[]).includes(s);

/** Which tune belongs here and now. */
export function trackFor(l: Listening): TrackName {
  if (l.kind === 'cave') return 'mine';
  const feast = festivalToday(l.day);
  if (feast && l.place === 'village' && l.minute >= FEAST_FROM && l.minute < FEAST_TO) {
    return feast === 'lantern' && l.minute >= LANTERN_FROM ? 'lantern' : 'festival';
  }
  if (l.kind === 'outdoor' && l.minute >= NIGHT_FROM) return 'night';
  return isTrack(l.music) ? l.music : 'farm';
}

/** How loud the tune is allowed to be: a little under the rain. */
export function musicLevel(l: Listening): number {
  if (l.kind !== 'outdoor') return 1;
  return l.weather === 'storm' ? 0.7 : l.weather === 'rain' ? 0.85 : 1;
}

const BIRD_SEASON: Readonly<Record<Season, number>> = { spring: 0.9, summer: 0.7, fall: 0.35, winter: 0 };
const BIRDS_UNTIL = 18 * 60;
const CRICKETS_FROM = 19 * 60 + 30;

/** How much of each looping background sound belongs here and now, from 0 to 1. */
export function bedLevels(l: Listening): Record<BedName, number> {
  const out = Object.fromEntries(BED_NAMES.map((n) => [n, 0])) as Record<BedName, number>;
  if (l.kind === 'cave') {
    out['amb-cave'] = 1;
    return out;
  }
  const outdoor = l.kind === 'outdoor';
  const wet = l.weather === 'rain' || l.weather === 'storm';
  if (wet) out['amb-rain'] = (l.weather === 'storm' ? 1 : 0.7) * (outdoor ? 1 : 0.35);
  if (!outdoor) {
    if (l.weather === 'storm') out['amb-wind'] = 0.08;
    return out;
  }
  const breeze = l.weather === 'storm' ? 0.6 : l.weather === 'snow' ? 0.4 : l.season === 'winter' ? 0.3 : l.weather === 'rain' ? 0.25 : 0.12;
  out['amb-wind'] = breeze + (l.place === 'forest' ? 0.08 : 0);
  const night = l.minute >= CRICKETS_FROM;
  const calm = l.weather === 'sun' || l.weather === 'cloud';
  if (night && calm && l.season !== 'winter') out['amb-crickets'] = l.season === 'fall' ? 0.5 : 0.8;
  if (!night && l.minute < BIRDS_UNTIL && calm) {
    const morning = l.minute < 9 * 60 ? 1 : 0.6;
    out['amb-birds'] = BIRD_SEASON[l.season] * morning * (l.weather === 'sun' ? 1 : 0.5);
  }
  if (l.place === 'lake') out['amb-water'] = 0.75;
  return out;
}

/** The tunes worth having ready: where you are most likely to go next. */
export const NEXT_TRACKS: Readonly<Record<TrackName, readonly TrackName[]>> = {
  title: ['farm', 'home'],
  farm: ['home', 'village', 'forest', 'night'],
  home: ['farm'],
  village: ['farm', 'lake', 'night', 'festival'],
  forest: ['farm', 'mine', 'night'],
  lake: ['village', 'night'],
  mine: ['forest'],
  night: ['farm', 'home'],
  festival: ['village', 'night', 'lantern'],
  lantern: ['village', 'night'],
};
