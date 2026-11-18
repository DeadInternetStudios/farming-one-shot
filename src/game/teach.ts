/**
 * The three things a new player has to be shown with their own hands: walking, using what they hold, and opening the bag.
 * Each is remembered in the farm's notes once done, so the hints retire by themselves and never come back.
 */
import type { GameState } from './state';

export type Lesson = 'walk' | 'use' | 'menu';

const NOTE: Record<Lesson, string> = { walk: 'taughtWalk', use: 'taughtUse', menu: 'taughtMenu' };

/** A farm this far along does not need the hints, whatever its notes say: it belongs to someone who already knows. */
const LAST_DAY = 3;

export const learned = (st: Pick<GameState, 'flags'>, lesson: Lesson): boolean => st.flags[NOTE[lesson]] === true;

export function learn(st: Pick<GameState, 'flags'>, lesson: Lesson): void {
  st.flags[NOTE[lesson]] = true;
}

/** True while this lesson should still be hinted at. */
export const teaching = (st: Pick<GameState, 'flags' | 'day'>, lesson: Lesson): boolean => st.day <= LAST_DAY && !learned(st, lesson);

const KEYS: Record<Lesson, string> = { walk: 'Arrows or WASD to walk', use: 'E or Space to use', menu: 'Tab for your bag' };

/** The one line for a keyboard: only the parts not yet done, so it shrinks as they learn. Empty once there is nothing left to say. */
export function keyLine(st: Pick<GameState, 'flags' | 'day'>): string {
  return (['walk', 'use', 'menu'] as const).filter((l) => teaching(st, l)).map((l) => KEYS[l]).join('  -  ');
}
