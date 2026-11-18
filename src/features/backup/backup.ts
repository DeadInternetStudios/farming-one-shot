/**
 * Backing up and restoring a save as a file. The menu has two buttons for it.
 * To cut it, set BACKUP_ON to false: the buttons go away and nothing else changes.
 */
import { ITEMS } from '../../data/items';
import { replaceSave } from '../../game/save';
import { SAVE_VERSION } from '../../game/state';
import type { GameState } from '../../game/state';
import { downloadBlob } from '../../systems/files';
import { OBJECT_HP } from '../../world/mapkit';

export const BACKUP_ON = true;

const GAME = 'lantern-hollow';
const FORMAT = 1;
/** A real save is a few hundred kilobytes. Anything past this is not one. */
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

const PACES = ['relaxed', 'standard', 'brisk'];
const WEATHERS = ['sun', 'cloud', 'rain', 'storm', 'snow'];

export function packSave(state: GameState, now: Date = new Date()): { filename: string; text: string } {
  const text = JSON.stringify({ game: GAME, format: FORMAT, exportedAt: now.toISOString(), save: state });
  return { filename: `lantern-hollow-day-${state.day}.json`, text };
}

export type Unpacked = { ok: true; state: GameState } | { ok: false; msg: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const known = (id: unknown): boolean => typeof id === 'string' && Object.hasOwn(ITEMS, id);
const stackOk = (s: unknown): boolean => s === null || (isObj(s) && known(s.id) && isNum(s.n) && Number.isInteger(s.n) && s.n > 0 && s.n <= 9999);

/** The first thing wrong with a parsed save, in plain words, or null when it looks sound. */
function whatIsWrong(s: unknown): string | null {
  if (!isObj(s) || !('version' in s)) return 'There is no saved game in that file.';
  if (s.version !== SAVE_VERSION) return 'That save is from a different version of the game.';
  if (!isNum(s.seed) || !isNum(s.minute) || !isNum(s.day) || s.day < 1 || s.day > 100000) return 'That save is missing its calendar.';
  if (!PACES.includes(s.pace as string) || !WEATHERS.includes(s.weather as string)) return 'That save is missing its settings.';
  const p = s.player;
  if (!isObj(p) || !isNum(p.gold) || p.gold < 0 || !isNum(p.energy) || !isNum(p.x) || !isNum(p.y)) return 'That save is missing its farmer.';
  if (!Array.isArray(p.slots) || p.slots.length < 10 || p.slots.length > 200 || !p.slots.every(stackOk)) return 'That save has a bag the game cannot read.';
  if (!isNum(p.selected) || p.selected < 0 || p.selected >= p.slots.length) return 'That save has a bag the game cannot read.';
  if (!isObj(s.locations) || !isObj(s.locations.farm)) return 'That save is missing the farm.';
  for (const loc of Object.values(s.locations)) {
    if (!isObj(loc) || !isObj(loc.soil) || !isObj(loc.objects) || !isObj(loc.things)) return 'That save has a place the game cannot read.';
    for (const o of Object.values(loc.objects)) if (!isObj(o) || typeof o.k !== 'string' || !Object.hasOwn(OBJECT_HP, o.k) || !isNum(o.v) || !isNum(o.hp)) return 'That save has something on the farm the game does not know.';
    for (const t of Object.values(loc.things)) if (!isObj(t) || (t.items !== undefined && !(Array.isArray(t.items) && t.items.every(stackOk)))) return 'That save has a chest the game cannot read.';
  }
  if (!Array.isArray(s.shipping) || !s.shipping.every((x) => isObj(x) && known(x.id) && isNum(x.n))) return 'That save has a shipping bin the game cannot read.';
  for (const k of ['recipes', 'requests', 'upgrades', 'pets', 'seen']) if (!Array.isArray(s[k])) return 'That save is missing some of its lists.';
  for (const k of ['flags', 'stats', 'social', 'bundles']) if (!isObj(s[k])) return 'That save is missing some of its records.';
  return null;
}

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
  const wrong = whatIsWrong(save);
  return wrong ? { ok: false, msg: wrong } : { ok: true, state: save as GameState };
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
