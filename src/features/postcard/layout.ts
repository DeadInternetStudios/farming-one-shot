import type { Weather } from '../../game/types';
import { dayOfSeason, daylight, formatTime, seasonOf } from '../../game/clock';

/** The postcard: a photo of the valley taken from the game screen, with a caption, ready to keep or share. */
export const POSTCARD_ON = true;

/** The part of the screen that becomes the photo. */
export interface Crop {
  /** The rectangle to copy, in screen pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** The photo's size in art pixels (one world pixel each). Always 3:2 with whole numbers. */
  cw: number;
  ch: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * The biggest 3:2 picture that fits the screen, kept to whole art pixels so the pixel art stays even,
 * and centred on the farmer (fx, fy are where they stand on screen, 0..1) without leaving the screen.
 */
export function planCrop(imgW: number, imgH: number, zoom: number, fx: number, fy: number): Crop {
  const artW = Math.max(3, Math.floor(imgW / zoom));
  const artH = Math.max(2, Math.floor(imgH / zoom));
  let cw = Math.min(artW, Math.floor(artH * 1.5));
  cw -= cw % 3;
  cw = Math.max(3, cw);
  const ch = (cw * 2) / 3;
  const sw = Math.min(imgW, cw * zoom);
  const sh = Math.min(imgH, ch * zoom);
  return {
    sx: clamp(Math.round(fx * imgW - sw / 2), 0, imgW - sw),
    sy: clamp(Math.round(fy * imgH - sh / 2), 0, imgH - sh),
    sw,
    sh,
    cw,
    ch,
  };
}

/** Where everything sits on the card, in art pixels. `k` card pixels make one art pixel. */
export interface CardPlan {
  k: number;
  w: number;
  h: number;
  /** The photo's top left corner. */
  px: number;
  py: number;
  /** The top of the caption, and the room beside it for the stamp. */
  textY: number;
  textW: number;
  stamp: { x: number; y: number; w: number; h: number };
  /** Big greeting when there is room for it. */
  bigTitle: boolean;
}

export const MARGIN = 7;
export const STAMP = { w: 24, h: 31 } as const;
/** Pixel width of "Lantern Hollow" in the game's font, doubled, plus a little air. */
const BIG_TITLE_NEEDS = 84 * 2 + 6;
/** Height of a line of text on the card, in art pixels, with the gap below it. */
export const LINE_HEIGHT = 10;

export function planCard(cw: number, ch: number): CardPlan {
  const k = Math.max(1, Math.floor(1100 / cw));
  const w = cw + MARGIN * 2;
  const textW = w - MARGIN * 2 - STAMP.w - 6;
  const bigTitle = textW >= BIG_TITLE_NEEDS;
  const textY = MARGIN + ch + 7;
  const textH = LINE_HEIGHT * (bigTitle ? 5 : 4) - 1;
  return {
    k,
    w,
    h: textY + Math.max(textH, STAMP.h) + MARGIN,
    px: MARGIN,
    py: MARGIN,
    textY,
    textW,
    stamp: { x: w - MARGIN - STAMP.w, y: textY, ...STAMP },
    bigTitle,
  };
}

const WEATHER_WORDS: Readonly<Record<Weather, string>> = { sun: 'sunny', cloud: 'cloudy', rain: 'rainy', storm: 'stormy', snow: 'snowy' };

/** "Spring 5", "9:40 pm", "rainy": the pieces of the date line, most important first. */
export function dateParts(day: number, minute: number, weather: Weather): string[] {
  const season = seasonOf(day);
  const sky = weather === 'sun' && daylight(season, minute) < 0.4 ? 'clear' : WEATHER_WORDS[weather];
  return [`${season.charAt(0).toUpperCase()}${season.slice(1)} ${dayOfSeason(day)}`, formatTime(minute), sky];
}

/** As many of the pieces as fit in `max`, joined with commas. */
export function fitLine(parts: readonly string[], measure: (s: string) => number, max: number): string {
  let line = parts[0] ?? '';
  for (let i = 1; i < parts.length; i++) {
    const next = `${line}, ${parts[i]}`;
    if (measure(next) > max) break;
    line = next;
  }
  return line;
}

/** Which of the three lanterns goes on the stamp: it changes from day to day. */
export const STAMP_LANTERNS = ['gold', 'pink', 'red'] as const;
export const stampLantern = (day: number): (typeof STAMP_LANTERNS)[number] => STAMP_LANTERNS[day % STAMP_LANTERNS.length] ?? 'gold';

export function postcardName(day: number): string {
  return `cozy-farming-simulator-mvp-${seasonOf(day)}-${dayOfSeason(day)}.png`;
}
