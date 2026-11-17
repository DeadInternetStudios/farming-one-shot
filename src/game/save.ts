import { SAVE_VERSION } from './state';
import type { GameState } from './state';

const KEY = 'lantern-hollow:save:v1';

/** Set once a backup has been put in place: the running game must not write over it on its way out. */
let frozen = false;

export function saveGame(state: GameState): boolean {
  if (frozen) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Swap in a save that came from outside, such as a backup file, and stop the running game saving over it. */
export function replaceSave(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    frozen = true;
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode: nothing to clear */
  }
}
