import { describe, expect, it } from 'vitest';
import { MAX_BACKUP_BYTES, packSave, unpackSave } from '../src/features/backup/backup';
import { addItem } from '../src/game/inventory';
import { PROFILES, playFarm } from '../tools/sim/farmer';
import { newGame, SAVE_VERSION } from '../src/game/state';
import type { GameState } from '../src/game/state';

/** A farm that has been lived in: gold, a placed lantern, a chest with something in it, a full bin. */
function lived(): GameState {
  const st = newGame(7, 'Rowan');
  st.day = 17;
  st.minute = 14 * 60 + 40;
  st.player.gold = 4321;
  st.flags.coopDay = 9;
  st.flags.shrineSeen = true;
  st.stats.earned = 9001;
  addItem(st.player.slots, 'deco-lamp-post', 2);
  st.shipping.push({ id: 'radish', n: 3 });
  const farm = st.locations.farm;
  if (!farm) throw new Error('no farm');
  farm.objects['20,13'] = { k: 'decor', v: 4, hp: 1 };
  farm.objects['22,13'] = { k: 'chest', v: 0, hp: 1 };
  farm.things['22,13'] = { kind: 'chest', items: [{ id: 'wood', n: 12 }, null, { id: 'gem-ruby', n: 1 }] };
  farm.soil['5,5'] = { wet: true, crop: { id: 'radish', age: 2, regrowing: false, dead: false } };
  return st;
}

const withEdit = (edit: (s: Record<string, unknown>) => void): string => {
  const copy = JSON.parse(JSON.stringify(lived())) as Record<string, unknown>;
  edit(copy);
  return JSON.stringify(copy);
};

describe('backup files', () => {
  it('give back exactly the farm that went in', () => {
    const st = lived();
    const { filename, text } = packSave(st, new Date('2026-11-17T10:00:00Z'));
    expect(filename).toBe('lantern-hollow-day-17.json');
    const back = unpackSave(text);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.state).toEqual(JSON.parse(JSON.stringify(st)));
    expect(JSON.parse(text)).toMatchObject({ game: 'lantern-hollow', format: 1, exportedAt: '2026-11-17T10:00:00.000Z' });
  });

  it('also take a bare save, the way it sits in the browser', () => {
    const back = unpackSave(JSON.stringify(lived()));
    expect(back.ok && back.state.player.gold).toBe(4321);
  });

  it('accept a farm that has really been played for weeks, not only ones built by hand', () => {
    for (const name of ['steady', 'casual']) {
      const run = playFarm(PROFILES[name] as NonNullable<(typeof PROFILES)[string]>, 24, 3);
      const back = unpackSave(packSave(run.state).text);
      expect(back.ok, `${name}: ${back.ok ? '' : back.msg}`).toBe(true);
      expect(Object.keys(run.state.locations.farm?.soil ?? {}).length, `${name} had a field`).toBeGreaterThan(0);
    }
  });

  it('start from a new game too', () => {
    expect(unpackSave(packSave(newGame(1)).text).ok).toBe(true);
  });

  it('turn away things that are not saves, and say why in plain words', () => {
    const refused: [string, string][] = [
      ['not even JSON', '{ nope'],
      ['a list', '[1, 2, 3]'],
      ['a number', '42'],
      ['another game', JSON.stringify({ game: 'crop-circles', format: 1, save: lived() })],
      ['a newer backup format', JSON.stringify({ game: 'lantern-hollow', format: 99, save: lived() })],
      ['an empty backup', JSON.stringify({ game: 'lantern-hollow', format: 1 })],
      ['another save version', withEdit((s) => { s.version = SAVE_VERSION + 1; })],
      ['a day before the first', withEdit((s) => { s.day = 0; })],
      ['a day that is not a number', withEdit((s) => { s.day = 'tuesday'; })],
      ['a pace that does not exist', withEdit((s) => { s.pace = 'frantic'; })],
      ['negative gold', withEdit((s) => { (s.player as { gold: number }).gold = -5; })],
      ['a bag that is not a list', withEdit((s) => { (s.player as { slots: unknown }).slots = 'many'; })],
      ['an item nobody made', withEdit((s) => { (s.player as { slots: unknown[] }).slots[3] = { id: 'dragon-egg', n: 1 }; })],
      ['a stack of zero', withEdit((s) => { (s.player as { slots: unknown[] }).slots[3] = { id: 'wood', n: 0 }; })],
      ['a selected slot off the end of the bag', withEdit((s) => { (s.player as { selected: number }).selected = 500; })],
      ['no farm', withEdit((s) => { delete (s.locations as Record<string, unknown>).farm; })],
      ['a thing on the farm the game has no picture for', withEdit((s) => { ((s.locations as Record<string, { objects: Record<string, unknown> }>).farm as { objects: Record<string, unknown> }).objects['1,1'] = { k: 'spaceship', v: 0, hp: 1 }; })],
      ['an item nobody made in a chest', withEdit((s) => { ((s.locations as Record<string, { things: Record<string, unknown> }>).farm as { things: Record<string, unknown> }).things['22,13'] = { kind: 'chest', items: [{ id: 'unobtainium', n: 1 }] }; })],
      ['an item nobody made in the bin', withEdit((s) => { (s.shipping as unknown[]).push({ id: 'unobtainium', n: 1 }); })],
      ['a list that is not a list', withEdit((s) => { s.recipes = 'all of them'; })],
      ['a record that is not a record', withEdit((s) => { s.flags = [1, 2]; })],
    ];
    for (const [what, text] of refused) {
      const r = unpackSave(text);
      expect(r.ok, what).toBe(false);
      if (!r.ok) {
        expect(r.msg, what).toMatch(/^[A-Z].*\.$/);
        expect(r.msg, what).not.toMatch(/undefined|TypeError|JSON|\[object/);
      }
    }
  });

  it('fill in what a save from before a feature never kept, instead of refusing the whole farm', () => {
    const back = unpackSave(withEdit((s) => { delete s.recipes; delete s.flags; delete s.pets; (s.stats as Record<string, unknown>) = { earned: 5, shipped: 1, harvested: 2, daysPlayed: 3 }; }));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.recipes.length).toBeGreaterThan(0);
    expect(back.state.flags).toEqual({});
    expect(back.state.pets).toEqual([]);
    expect(back.state.stats).toMatchObject({ earned: 5, caught: 0, mined: 0 });
    expect(back.state.player.gold).toBe(4321);
  });

  it('say "no saved game" for a file that is something else, and "different version" only for a save that is', () => {
    const none = unpackSave('{"hello": "world"}');
    expect(!none.ok && none.msg).toBe('There is no saved game in that file.');
    const other = unpackSave(withEdit((s) => { s.version = SAVE_VERSION + 1; }));
    expect(!other.ok && other.msg).toBe('That save is from a different version of the game.');
  });

  it('refuse a file too big to be a save without reading it', () => {
    const r = unpackSave(' '.repeat(MAX_BACKUP_BYTES + 1));
    expect(r.ok).toBe(false);
  });

  it('never change the farm they were given', () => {
    const st = lived();
    const before = JSON.stringify(st);
    packSave(st);
    expect(JSON.stringify(st)).toBe(before);
  });
});
