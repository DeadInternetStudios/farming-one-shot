import type Phaser from 'phaser';
import { FESTIVAL_NAMES, festivalToday } from '../data/festivals';
import { dayOfSeason, seasonOf, weekdayOf } from '../game/clock';
import { settings } from '../game/settings';
import type { GameState } from '../game/state';
import { PAL } from '../gen/art';
import type { Layout } from '../display';
import { COL, WEATHER_NAMES, label } from './kit';

const SEASONS = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Above the clock and the hotbar, below every pop-up. */
const DEPTH = 30;
const IN = 600;
const HOLD = 1700;
const OUT = 800;

/** What a morning says about itself: a fair if there is one today, otherwise the sky. */
export function morningLine(st: GameState): string {
  const fair = festivalToday(st.day);
  if (fair) return `${FESTIVAL_NAMES[fair] ?? 'A fair'} today`;
  return `${WEATHER_NAMES[st.weather]} morning`;
}

/** The first beat of a day: its date in big letters across a dark band, the weekday and the sky under it, then gone. It never gets in the way of playing. */
export function dayCard(scene: Phaser.Scene, l: Layout, st: GameState): void {
  const cx = Math.floor(l.uiW / 2);
  const cy = Math.floor(l.uiH * 0.3);
  const band = scene.add.rectangle(0, cy - 24, l.uiW, 54, PAL.ink[0], 0.4).setOrigin(0, 0);
  const title = label(scene, cx, cy - 6, `${SEASONS[seasonOf(st.day)]} ${dayOfSeason(st.day)}`, { outline: true, origin: [0.5, 0.5] }).setScale(3);
  const sub = label(scene, cx, cy + 16, `${WEEKDAYS[weekdayOf(st.day)]}. ${morningLine(st)}`, { outline: true, origin: [0.5, 0.5], tint: COL.gold });
  const parts = [band, title, sub];
  for (const p of parts) p.setDepth(DEPTH).setAlpha(0);
  const gone = (): void => { for (const p of parts) p.destroy(); };
  if (settings.calm) {
    for (const p of parts) p.setAlpha(1);
    scene.time.delayedCall(IN + HOLD, gone);
    return;
  }
  // the date eases up a few pixels as it arrives, like the pop-ups do
  title.setY(title.y + 6);
  scene.tweens.add({ targets: [band, sub], alpha: 1, duration: IN, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: title, alpha: 1, y: title.y - 6, duration: IN, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: parts, alpha: 0, delay: IN + HOLD, duration: OUT, ease: 'Cubic.easeIn', onComplete: gone });
}
