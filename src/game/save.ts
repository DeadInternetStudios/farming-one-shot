import { checkSave } from './savecheck';
import type { GameState } from './state';

const KEY = 'lantern-hollow:save:v1';
/** A save the game could not open, kept as it was so nothing about it is lost. */
const DAMAGED = 'lantern-hollow:save:damaged';
/** The farm that was here before a backup was restored, until the restored one has started and saved. */
const BEFORE_RESTORE = 'lantern-hollow:save:before-restore';

/** Set once a backup has been put in place or another tab has taken over: the running game must not write over it. */
let frozen = false;

/** Stops this page writing saves. A backup has just been put in place, or another tab is playing this farm. */
export function freezeSaves(): void {
  frozen = true;
}

/** True when the page is not allowed to save any more, so a message about saving would be about something else. */
export const savesFrozen = (): boolean => frozen;

/** Writes the farm. False means the browser would not keep it: storage is full, blocked, or switched off. */
export function saveGame(state: GameState): boolean {
  if (frozen) return true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    return false;
  }
  // the restored farm has started and saved: the one it replaced is no longer needed
  try {
    localStorage.removeItem(BEFORE_RESTORE);
  } catch {
    /* nothing to clean up */
  }
  return true;
}

/**
 * Swap in a save that came from outside, such as a backup file, and stop the running game saving over it.
 * The farm it replaces is kept aside until the new one has started and saved, so a bad backup costs nothing.
 */
export function replaceSave(state: GameState): boolean {
  try {
    const before = localStorage.getItem(KEY);
    if (before !== null) localStorage.setItem(BEFORE_RESTORE, before);
    localStorage.setItem(KEY, JSON.stringify(state));
    frozen = true;
    return true;
  } catch {
    // a save that cannot be kept beside the old one is not worth the risk
    try {
      localStorage.removeItem(BEFORE_RESTORE);
    } catch {
      /* nothing more to do */
    }
    return false;
  }
}

/** True when there is a farm to go back to after a restore. */
export function hasRollback(): boolean {
  try {
    return localStorage.getItem(BEFORE_RESTORE) !== null;
  } catch {
    return false;
  }
}

/** Puts the farm back that a restore replaced. */
export function undoRestore(): boolean {
  try {
    const before = localStorage.getItem(BEFORE_RESTORE);
    if (before === null) return false;
    localStorage.setItem(KEY, before);
    localStorage.removeItem(BEFORE_RESTORE);
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

/** Whether the browser keeps what the game writes. A private window or a full disk may not. */
export function canStore(): boolean {
  try {
    const probe = 'lantern-hollow:probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export type Loaded = { kind: 'none' } | { kind: 'ok'; state: GameState } | { kind: 'broken'; why: string };

function keepDamaged(raw: string): void {
  try {
    if (localStorage.getItem(DAMAGED) !== raw) localStorage.setItem(DAMAGED, raw);
  } catch {
    /* no room to keep a copy: the save is left where it is */
  }
}

/** Reads the saved farm, and says why when there is one that cannot be opened. A damaged save is set aside, not thrown away. */
export function readSave(): Loaded {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { kind: 'none' };
  }
  if (!raw) return { kind: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    keepDamaged(raw);
    return { kind: 'broken', why: 'The saved farm is cut short, so it cannot be read.' };
  }
  const checked = checkSave(parsed);
  if (checked.ok) return { kind: 'ok', state: checked.state };
  keepDamaged(raw);
  return { kind: 'broken', why: checked.msg };
}

export function loadGame(): GameState | null {
  const r = readSave();
  return r.kind === 'ok' ? r.state : null;
}

/** The text of a save that could not be opened, for a copy the player can keep. */
export function damagedCopy(): string | null {
  try {
    return localStorage.getItem(DAMAGED);
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
