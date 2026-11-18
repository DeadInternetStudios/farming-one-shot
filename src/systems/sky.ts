import { daylight, sunClock } from '../game/clock';
import type { Season, Weather } from '../game/types';
import type { MapKind } from '../world/mapkit';

/** The colour of the sky over the valley at any minute: pure numbers, so the lighting can be tested without a screen. */

export const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const pack = (c: [number, number, number]): number => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type RGB = [number, number, number];

/** What the evening does to the colours of the valley, by minutes past sunset: white, the first gold, the sun on the horizon, rose, violet, blue, night. */
const EVENING_SKY: readonly (readonly [number, RGB])[] = [
  [-80, [255, 255, 255]],
  [-40, [255, 240, 214]],
  [0, [255, 205, 150]],
  [25, [240, 164, 160]],
  [50, [172, 120, 170]],
  [80, [92, 92, 160]],
  [110, [46, 60, 122]],
];

/** And the morning, by minutes past sunrise: night, blue, a rose before the sun, gold, white. */
const MORNING_SKY: readonly (readonly [number, RGB])[] = [
  [-60, [46, 60, 122]],
  [-30, [92, 92, 160]],
  [0, [222, 156, 160]],
  [25, [255, 206, 158]],
  [55, [255, 240, 218]],
  [90, [255, 255, 255]],
];

const WEATHER_TINT: Record<Weather, [number, number, number]> = {
  sun: [1, 1, 1], cloud: [0.9, 0.92, 0.96], rain: [0.74, 0.8, 0.92], storm: [0.55, 0.6, 0.78], snow: [0.9, 0.95, 1],
};

function ramp(frames: readonly (readonly [number, RGB])[], m: number): RGB {
  const first = frames[0] as readonly [number, RGB];
  const last = frames[frames.length - 1] as readonly [number, RGB];
  if (m <= first[0]) return first[1];
  if (m >= last[0]) return last[1];
  for (let i = 1; i < frames.length; i++) {
    const [m1, c1] = frames[i] as readonly [number, RGB];
    if (m <= m1) {
      const [m0, c0] = frames[i - 1] as readonly [number, RGB];
      return mix(c0, c1, (m - m0) / (m1 - m0));
    }
  }
  return last[1];
}

/** Each lamp has a moment of its own, so the valley lights up one lantern at a time instead of all at once. */
export function lampOn(lamps: number, x: number, y: number): number {
  if (lamps <= 0) return 0;
  if (lamps >= 1) return 1;
  const own = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  const at = 0.1 + own * 0.62;
  return smooth(at - 0.16, at + 0.16, lamps);
}

export interface SkyState {
  /** Multiply colour for the whole scene. */
  ambient: number;
  /** 0 before the evening, 1 once it is dark enough for every lamp: the lamps and windows come on one at a time between. */
  lamps: number;
  day: number;
  /** How much blue is added back into the shadows: 0 by day and indoors. */
  lift: number;
}

const ROOM_DAY = rgb(0xf6e8d2);
const ROOM_NIGHT = rgb(0x9a8aa6);

const CAVE = rgb(0x4a5688);

export function skyFor(season: Season, minute: number, weather: Weather, kind: MapKind): SkyState {
  const day = daylight(season, minute);
  if (kind === 'cave') return { ambient: pack(CAVE), lamps: 1, day: 0, lift: 0 };
  if (kind === 'interior') {
    const t = smooth(0.05, 0.9, day);
    return { ambient: pack(mix(ROOM_NIGHT, ROOM_DAY, t)), lamps: 0.55 + (1 - t) * 0.45, day, lift: 0 };
  }
  const sun = sunClock(season, minute);
  let c = ramp(sun.evening ? EVENING_SKY : MORNING_SKY, sun.m);
  if (season === 'winter') {
    // white ground shows the whole tint, so winter keeps less of it: a grey-blue night and a soft gold, not a blue or pink field
    const grey = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    c = mix(c, [grey, grey, grey], 0.4);
  }
  const w = WEATHER_TINT[weather];
  const wt = Math.max(0, Math.min(1, day * 1.2));
  c = [c[0] * (1 + (w[0] - 1) * wt), c[1] * (1 + (w[1] - 1) * wt), c[2] * (1 + (w[2] - 1) * wt)];
  const base = sun.evening ? smooth(-30, 75, sun.m) : 1 - smooth(-45, 20, sun.m);
  const lamps = Math.max(0, Math.min(1, base + (weather === 'storm' ? 0.35 : weather === 'rain' ? 0.15 : 0) * (1 - base * 0.5)));
  // snow is already bright, and blue added back onto it turns it electric
  return { ambient: pack(c), lamps, day, lift: (1 - day) ** 1.2 * (season === 'winter' ? 0.3 : 1) };
}
