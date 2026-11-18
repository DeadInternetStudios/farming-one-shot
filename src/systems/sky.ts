import { daylight, sunClock } from '../game/clock';
import type { SunClock } from '../game/clock';
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
  [-45, [255, 236, 200]],
  [-15, [255, 200, 145]],
  [0, [255, 180, 122]],
  [15, [232, 158, 156]],
  [35, [184, 138, 182]],
  [55, [132, 120, 184]],
  [80, [84, 96, 168]],
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

/**
 * The light the low sun adds on top of its tint, by minutes past sunset. Multiplying only darkens, so on its own the golden hour is a
 * dimmer day; adding gold back is what makes it glow. The added light turns rose and then violet after the sun is down, which keeps
 * the greens from going the colour of mud, and has faded out by the time the blue night's own lift takes over.
 */
const EVENING_GLOW: readonly (readonly [number, RGB])[] = [
  [-75, [0, 0, 0]],
  [-8, [44, 21, 4]],
  [15, [44, 12, 22]],
  [38, [26, 8, 36]],
  [64, [10, 4, 28]],
  [88, [0, 0, 0]],
];

/** And a shorter, thinner one before the sun is up. */
const MORNING_GLOW: readonly (readonly [number, RGB])[] = [
  [-30, [0, 0, 0]],
  [0, [26, 12, 22]],
  [18, [26, 14, 5]],
  [48, [0, 0, 0]],
];

/** How much of that light each weather lets through. */
const GLOW_WEATHER: Record<Weather, number> = { sun: 1, cloud: 0.5, rain: 0.12, storm: 0, snow: 0.5 };

function glowOf(sun: SunClock, weather: Weather, season: Season): number {
  const k = GLOW_WEATHER[weather] * (season === 'winter' ? 0.55 : 1);
  const c = ramp(sun.evening ? EVENING_GLOW : MORNING_GLOW, sun.m);
  return pack([c[0] * k, c[1] * k, c[2] * k]);
}

/** How low the sun hangs, by minutes either side of the horizon: it comes down for an hour and a half, rests on the edge, and is gone soon after it sets. */
function lowOf(sun: SunClock, weather: Weather, season: Season): number {
  const k = GLOW_WEATHER[weather] * (season === 'winter' ? 0.7 : 1);
  return k * (sun.evening ? smooth(-90, -20, sun.m) * (1 - smooth(0, 45, sun.m)) : smooth(-40, 0, sun.m) * (1 - smooth(10, 70, sun.m)));
}

export interface SkyState {
  /** Multiply colour for the whole scene. */
  ambient: number;
  /** Light added on top of the tint, packed r,g,b: the glow of the low sun. 0 when there is none. */
  glow: number;
  /** 0 before the evening, 1 once it is dark enough for every lamp: the lamps and windows come on one at a time between. */
  lamps: number;
  day: number;
  /** How much blue is added back into the shadows: 0 by day and indoors. */
  lift: number;
  /** How low the sun hangs, 0 when it is high or gone and 1 on the horizon: how far the shadows run and how hard the sunlight washes in from the side. */
  low: number;
  /** Which edge of the screen the sun is behind: -1 the left (west, in the evening), 1 the right (east, in the morning). */
  side: -1 | 1;
}

const HUSH = rgb(0x6c6aa0);

/**
 * The valley holds its breath: a lantern lighting pulls the evening over the shrine for a moment, whatever the hour, so the light has a
 * dark to be seen in, and lets it go again. A sky that is already darker than that is left as it is.
 */
export function hushed(sky: SkyState, k: number): SkyState {
  if (k <= 0) return sky;
  const [r, g, b] = rgb(sky.ambient);
  const toward = (c: number, h: number): number => c + (Math.min(c, h) - c) * k;
  const [gr, gg, gb] = rgb(sky.glow);
  return {
    ...sky,
    ambient: pack([toward(r, HUSH[0]), toward(g, HUSH[1]), toward(b, HUSH[2])]),
    glow: pack([gr * (1 - k), gg * (1 - k), gb * (1 - k)]),
    lamps: Math.max(sky.lamps, k),
    lift: Math.max(sky.lift, k * 0.45),
    low: sky.low * (1 - k),
  };
}

const ROOM_DAY = rgb(0xf6e8d2);
const ROOM_NIGHT = rgb(0x9a8aa6);

const CAVE = rgb(0x4a5688);

export function skyFor(season: Season, minute: number, weather: Weather, kind: MapKind): SkyState {
  const day = daylight(season, minute);
  if (kind === 'cave') return { ambient: pack(CAVE), glow: 0, lamps: 1, day: 0, lift: 0, low: 0, side: -1 };
  if (kind === 'interior') {
    const t = smooth(0.05, 0.9, day);
    return { ambient: pack(mix(ROOM_NIGHT, ROOM_DAY, t)), glow: 0, lamps: 0.55 + (1 - t) * 0.45, day, lift: 0, low: 0, side: -1 };
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
  return { ambient: pack(c), glow: glowOf(sun, weather, season), lamps, day, lift: (1 - day) ** 1.2 * (season === 'winter' ? 0.3 : 1), low: lowOf(sun, weather, season), side: sun.evening ? -1 : 1 };
}
