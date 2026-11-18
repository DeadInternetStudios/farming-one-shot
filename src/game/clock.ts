import { SEASONS } from './types';
import type { Season } from './types';

export const DAYS_PER_SEASON = 7;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;

export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;
export const DAY_MINUTES = DAY_END - DAY_START;

export type PaceId = 'relaxed' | 'standard' | 'brisk';
export const PACE_REAL_MINUTES: Readonly<Record<PaceId, number>> = { relaxed: 4.5, standard: 3.3, brisk: 2.5 };

/** Game minutes that pass per real second at a pace. */
export function minutesPerSecond(pace: PaceId): number {
  return DAY_MINUTES / (PACE_REAL_MINUTES[pace] * 60);
}

export function seasonOf(day: number): Season {
  return SEASONS[Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON)] as Season;
}
export function dayOfSeason(day: number): number {
  return ((day - 1) % DAYS_PER_SEASON) + 1;
}
export function yearOf(day: number): number {
  return Math.floor((day - 1) / DAYS_PER_YEAR) + 1;
}
export function weekdayOf(day: number): number {
  return (day - 1) % 7;
}
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function formatTime(minute: number): string {
  const total = Math.floor(minute) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? 'am' : 'pm';
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Sunrise and sunset in game minutes for each season. */
export const SUN: Readonly<Record<Season, { rise: number; set: number }>> = {
  spring: { rise: 6.0 * 60, set: 19.5 * 60 },
  summer: { rise: 5.5 * 60, set: 21.0 * 60 },
  fall: { rise: 6.5 * 60, set: 18.5 * 60 },
  winter: { rise: 7.0 * 60, set: 17.0 * 60 },
};

/** Where the day is, as minutes either side of the sun crossing the horizon: past sunset in the evening, past sunrise in the morning. Negative is before. */
export interface SunClock {
  evening: boolean;
  m: number;
}

export function sunClock(season: Season, minute: number): SunClock {
  const { rise, set } = SUN[season];
  const m = minute % (24 * 60);
  const t = m < DAY_START - 120 ? m + 24 * 60 : m; // 0:00..4:00 belongs to the night before
  return t >= (rise + set) / 2 ? { evening: true, m: t - set } : { evening: false, m: t - rise };
}

/** The evening runs from the first gold to full night over three hours of game time: about half a minute of real time at the standard pace. */
export const EVENING = { from: -80, to: 110 } as const;

/** 0 in full night, 1 in full daylight. Dusk takes the long way down, dawn a shorter way up. */
export function daylight(season: Season, minute: number): number {
  const s = sunClock(season, minute);
  return s.evening ? 1 - smoothstep(-70, 105, s.m) : smoothstep(-55, 60, s.m);
}

const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
