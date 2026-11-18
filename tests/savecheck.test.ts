import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSave, upgrade, whatIsWrong } from '../src/game/savecheck';
import { newGame, SAVE_VERSION } from '../src/game/state';
import type { GameState } from '../src/game/state';

const KEY = 'lantern-hollow:save:v1';

function memoryStore(failWrites = false): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => {
      if (failWrites) throw new DOMException('full', 'QuotaExceededError');
      m.set(k, String(v));
    },
  };
}

const install = (store: Storage): void => { Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true }); };
/** The save module keeps one flag about whether this page may still write, so every test gets its own copy of the module. */
const fresh = async (): Promise<typeof import('../src/game/save')> => {
  vi.resetModules();
  return import('../src/game/save');
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** What a save from the first version looked like: none of the village, and no things placed on any map. */
function oldSave(): Record<string, unknown> {
  const s = clone(newGame(3, 'Rowan')) as unknown as Record<string, unknown>;
  s.version = 1;
  for (const k of ['pace', 'social', 'bundles', 'recipes', 'requests', 'forge', 'upgrades', 'pets', 'deepest', 'seen']) delete s[k];
  s.stats = { earned: 40, shipped: 3, harvested: 6, daysPlayed: 4 };
  for (const loc of Object.values(s.locations as Record<string, Record<string, unknown>>)) delete loc.things;
  (s.player as Record<string, unknown>).gold = 777;
  return s;
}

describe('an old save', () => {
  it('is brought up to this version and keeps what the player had', () => {
    const r = checkSave(oldSave());
    expect(r.ok, r.ok ? '' : r.msg).toBe(true);
    if (!r.ok) return;
    expect(r.state.version).toBe(SAVE_VERSION);
    expect(r.state.player.gold).toBe(777);
    expect(r.state.player.name).toBe('Rowan');
    expect(r.state.stats).toMatchObject({ earned: 40, shipped: 3, harvested: 6, caught: 0, mined: 0 });
    expect(r.state.locations.farm?.things).toEqual({});
    expect(r.state.recipes.length).toBeGreaterThan(0);
  });

  it('is not touched when it is already current, and a newer one is turned away', () => {
    const now = clone(newGame(1));
    expect(JSON.stringify(upgrade(clone(now)))).toBe(JSON.stringify(now));
    const future = { ...clone(now), version: SAVE_VERSION + 1 };
    expect(whatIsWrong(upgrade(future))).toBe('That save is from a different version of the game.');
  });
});

describe('a save the game could not open', () => {
  const edits: [string, (s: Record<string, GameState[keyof GameState]> & { player: Record<string, unknown> }) => void][] = [
    ['a farmer on a map that does not exist', (s) => { s.player.loc = 'moon'; }],
    ['a farmer at no place at all', (s) => { s.player.x = Number.NaN; }],
    ['no bag', (s) => { s.player.slots = null; }],
    ['a crop nobody grows', (s) => { (s as unknown as GameState).locations.farm!.soil['4,4'] = { wet: false, crop: { id: 'moonberry', age: 1, regrowing: false, dead: false } }; }],
    ['a pet that is not a pet', (s) => { (s as unknown as { pets: unknown[] }).pets = [{ id: 'x' }]; }],
  ];
  for (const [what, edit] of edits) {
    it(`is named in plain words: ${what}`, () => {
      const s = clone(newGame(1)) as unknown as Parameters<(typeof edits)[number][1]>[0];
      edit(s);
      const r = checkSave(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.msg).toMatch(/^That save .*\.$/);
    });
  }
});

describe('the save in the browser', () => {
  beforeEach(() => install(memoryStore()));

  it('comes back as the farm that went in', async () => {
    const { saveGame, loadGame } = await fresh();
    const st = newGame(5);
    st.player.gold = 1234;
    expect(saveGame(st)).toBe(true);
    expect(loadGame()?.player.gold).toBe(1234);
  });

  it('says there is none when there is none', async () => {
    const { readSave } = await fresh();
    expect(readSave()).toEqual({ kind: 'none' });
  });

  it('keeps a copy of a broken save and says it is broken, instead of opening half a farm', async () => {
    const { damagedCopy, readSave } = await fresh();
    const half = JSON.stringify(newGame(1)).slice(0, 500);
    localStorage.setItem(KEY, half);
    const r = readSave();
    expect(r.kind).toBe('broken');
    expect(damagedCopy()).toBe(half);
    // a parseable save with a hole in it is just as broken
    localStorage.setItem(KEY, JSON.stringify({ ...clone(newGame(1)), player: { gold: 1 } }));
    expect(readSave().kind).toBe('broken');
  });

  it('opens an old save, and writes it back as the new version only when the game saves', async () => {
    const { readSave, saveGame } = await fresh();
    localStorage.setItem(KEY, JSON.stringify(oldSave()));
    const r = readSave();
    expect(r.kind).toBe('ok');
    expect((JSON.parse(localStorage.getItem(KEY) ?? '{}') as { version: number }).version).toBe(1);
    if (r.kind === 'ok') {
      expect(saveGame(r.state)).toBe(true);
      expect((JSON.parse(localStorage.getItem(KEY) ?? '{}') as { version: number }).version).toBe(SAVE_VERSION);
    }
  });

  it('can be cleared', async () => {
    const { clearSave, readSave, saveGame } = await fresh();
    saveGame(newGame(1));
    clearSave();
    expect(readSave()).toEqual({ kind: 'none' });
  });

  it('keeps the farm a restore replaced through the autosaves, and lets it go when the restored farm has been slept in', async () => {
    const { replaceSave, saveGame } = await fresh();
    const before = newGame(1);
    before.player.gold = 111;
    saveGame(before);
    const restored = newGame(2);
    restored.player.gold = 999;
    replaceSave(restored);
    // the game reloads after a restore, so this page's own flag is not the one that matters: a new page saves again and again
    vi.resetModules();
    const again = await import('../src/game/save');
    for (let i = 0; i < 5; i++) expect(again.saveGame(restored)).toBe(true);
    expect(again.hasRollback()).toBe(true);
    expect(again.rollbackFarm()?.player.gold).toBe(111);
    again.settleRestore();
    expect(again.hasRollback()).toBe(false);
    expect(again.rollbackFarm()).toBeNull();
  });

  it('puts a restored backup in place, keeps the farm it replaced, and can put it back', async () => {
    const { hasRollback, loadGame, replaceSave, saveGame, undoRestore } = await fresh();
    const before = newGame(1);
    before.player.gold = 111;
    saveGame(before);
    const restored = newGame(2);
    restored.player.gold = 999;
    expect(hasRollback()).toBe(false);
    expect(replaceSave(restored)).toBe(true);
    expect(hasRollback()).toBe(true);
    expect(loadGame()?.player.gold).toBe(999);
    expect(undoRestore()).toBe(true);
    expect(loadGame()?.player.gold).toBe(111);
    expect(hasRollback()).toBe(false);
  });
});

describe('a browser that will not keep the farm', () => {
  it('says so instead of saying it saved', async () => {
    const { replaceSave, saveGame } = await fresh();
    install(memoryStore(true));
    expect(saveGame(newGame(1))).toBe(false);
    expect(replaceSave(newGame(1))).toBe(false);
  });
});

describe('a page that has handed the farm over', () => {
  it('stops writing, and does not call that a failure', async () => {
    const { freezeSaves, loadGame, saveGame } = await fresh();
    install(memoryStore());
    const st = newGame(1);
    st.player.gold = 5;
    expect(saveGame(st)).toBe(true);
    freezeSaves();
    st.player.gold = 6;
    expect(saveGame(st)).toBe(true);
    expect(loadGame()?.player.gold).toBe(5);
  });
});
