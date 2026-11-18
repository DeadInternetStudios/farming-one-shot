/**
 * Backing up and restoring a save as a file. The menu has two buttons for it.
 * To cut it, set BACKUP_ON to false: the buttons go away and nothing else changes.
 */
import { damagedCopy, hasRollback, replaceSave, undoRestore } from '../../game/save';
import { checkSave } from '../../game/savecheck';
import type { GameState } from '../../game/state';
import { downloadBlob } from '../../systems/files';

export const BACKUP_ON = true;

const GAME = 'lantern-hollow';
const FORMAT = 1;
/** A real save is a few hundred kilobytes. Anything past this is not one. */
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export function packSave(state: GameState, now: Date = new Date()): { filename: string; text: string } {
  const text = JSON.stringify({ game: GAME, format: FORMAT, exportedAt: now.toISOString(), save: state });
  return { filename: `lantern-hollow-day-${state.day}.json`, text };
}

export type Unpacked = { ok: true; state: GameState } | { ok: false; msg: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a backup file's text. A bare save, as copied from the browser, is accepted too. */
export function unpackSave(text: string): Unpacked {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, msg: 'That file is too big to be a save.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, msg: 'That file is not a Lantern Hollow save.' };
  }
  let save = parsed;
  if (isObj(parsed) && 'game' in parsed) {
    if (parsed.game !== GAME) return { ok: false, msg: 'That file is not a Lantern Hollow save.' };
    if (parsed.format !== FORMAT) return { ok: false, msg: 'A newer version of the game made that backup.' };
    save = parsed.save;
  }
  // the same two steps a save in the browser goes through, so a file can never let in what the game could not open
  return checkSave(save);
}

// ---------------------------------------------------------------- the browser end

/** Opens the file picker. Resolves with the file's text, a reason it was refused, or null when nothing was chosen. */
function chooseTextFile(): Promise<{ text: string } | { msg: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    const finish = (v: { text: string } | { msg: string } | null): void => { input.remove(); resolve(v); };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { finish(null); return; }
      if (file.size > MAX_BACKUP_BYTES) { finish({ msg: 'That file is too big to be a save.' }); return; }
      file.text().then((text) => finish({ text }), () => finish({ msg: 'The game could not read that file.' }));
    });
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export function backupToFile(state: GameState): string {
  const { filename, text } = packSave(state);
  downloadBlob(filename, new Blob([text], { type: 'application/json' }));
  return `Saved ${filename}.`;
}

/** Choose a backup, check it, make it the saved game and start the game again. Resolves with what to tell the player. */
export async function restoreFromFile(): Promise<string | null> {
  const chosen = await chooseTextFile();
  if (chosen === null) return null;
  if ('msg' in chosen) return chosen.msg;
  const read = unpackSave(chosen.text);
  if (!read.ok) return read.msg;
  if (!replaceSave(read.state)) return 'This browser would not let the game keep that save.';
  setTimeout(() => location.reload(), 900);
  return 'Restored. Starting from your backup...';
}

/** Gives the player the save the game could not open, as a file, so a farm that will not load is still theirs. */
export function damagedToFile(): string {
  const text = damagedCopy();
  if (text === null) return 'There is no damaged save to keep.';
  downloadBlob('lantern-hollow-damaged-save.json', new Blob([text], { type: 'application/json' }));
  return 'Saved lantern-hollow-damaged-save.json.';
}

/** True when a restore replaced a farm that can still be put back. */
export const canUndoRestore = (): boolean => hasRollback();

/** Puts back the farm a restore replaced, and starts the game again. */
export function undoLastRestore(): string {
  if (!undoRestore()) return 'There is no earlier farm to go back to.';
  setTimeout(() => location.reload(), 600);
  return 'Back to your earlier farm...';
}
