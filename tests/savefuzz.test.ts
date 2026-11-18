import { describe, expect, it } from 'vitest';
import { BUNDLES } from '../src/data/bundles';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { RECIPES } from '../src/data/recipes';
import { UPGRADES } from '../src/data/shops';
import { sleepThrough } from '../src/game/day';
import { clockMinutes, collectBars, furnaceState, minutesLeft } from '../src/game/furnace';
import { nextGoal } from '../src/game/goals';
import { addItem } from '../src/game/inventory';
import { deliver, refreshRequests } from '../src/game/requests';
import { checkSave, whatIsWrong } from '../src/game/savecheck';
import type { GameState } from '../src/game/state';
import { buildMap } from '../src/world/maps/registry';
import { PROFILES, playFarm } from '../tools/sim/farmer';

/**
 * The save check promises that anything it lets in, the game can run on and save again. This test holds it to that: it takes a farm that
 * has everything in it, damages one value at a time in every way a hand-edited or half-written file could, and for each damaged save the
 * check lets in, plays a day and a night on it. If the game throws, or writes a save that the check would then refuse, the check let in
 * something it should not have.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** A farm with every kind of thing in it, built from a farm that has really been played. */
function rich(): GameState {
  const st = clone(playFarm(PROFILES.steady as NonNullable<(typeof PROFILES)[string]>, 24, 2).state);
  const farm = st.locations.farm;
  if (!farm) throw new Error('no farm');
  farm.objects['3,3'] = { k: 'furnace', v: 0, hp: 1 };
  farm.things['3,3'] = { kind: 'furnace', job: { ore: 'copperOre', bar: 'copperBar', n: 2, readyAt: clockMinutes(st) + 30 } };
  farm.objects['4,3'] = { k: 'chest', v: 0, hp: 1 };
  farm.things['4,3'] = { kind: 'chest', items: [{ id: 'wood', n: 12 }, null, { id: 'gem-ruby', n: 1 }] };
  farm.objects['5,3'] = { k: 'sprinkler', v: 0, hp: 1 };
  farm.things['5,3'] = { kind: 'sprinkler' };
  farm.objects['6,3'] = { k: 'decor', v: 1, hp: 1 };
  farm.objects['7,3'] = { k: 'flower', v: 7, hp: 1 };
  farm.soil['8,3'] = { wet: true, crop: { id: 'radish', age: 2, regrowing: false, dead: false } };
  for (const n of NPCS) st.social[n.id] = { points: 120, met: true, talkedDay: 3, giftedDay: 2, giftsWeek: 1, weekStart: 1, claimed: [1, 2] };
  for (const b of BUNDLES) st.bundles[b.id] = b.slots.map((s, i) => (i === 0 ? s.n : 0));
  st.recipes = RECIPES.slice(0, 5).map((r) => r.id);
  st.upgrades = UPGRADES.slice(0, 2).map((u) => u.id);
  st.seen = ['radish', 'fish-perch'];
  st.flags = { ...st.flags, letter: true, coopDay: 9, note: 'hello' };
  st.requests = [{ id: '5-mirren', npc: 'mirren', item: 'radish', n: 2, reward: 90, until: st.day + 3 }];
  st.forge = { tool: 'hoe', tier: 'copper', readyDay: st.day + 1 };
  st.pets = [{ id: 'hen-1', kind: 'chicken', name: 'Peep', fedDay: st.day - 1, happy: 40, since: st.day - 10, petDay: st.day - 1 }];
  st.deepest = 4;
  addItem(st.player.slots, 'radish', 5);
  addItem(st.player.slots, 'copperBar', 1);
  st.shipping.push({ id: 'radish', n: 2 });
  return st;
}

/** Plays the part of a day that reads the save: every look-up the game does on its numbers, names and lists, with no screen in the way. */
function playOn(st: GameState): void {
  const slots = st.player.slots;
  for (const s of slots) if (s) void ITEMS[s.id]?.name.length;
  nextGoal(st);
  for (const l of Object.values(st.locations)) {
    for (const t of Object.values(l.things)) {
      if (t.kind === 'chest') for (const s of t.items ?? []) if (s) expect(ITEMS[s.id]).toBeDefined();
      if (t.kind !== 'furnace') continue;
      furnaceState(st, t);
      minutesLeft(st, t);
      if (t.job) {
        st.minute = 1300;
        st.day = Math.max(st.day, Math.ceil(t.job.readyAt / 1440));
        collectBars(st, t);
      }
    }
  }
  for (const q of [...st.requests]) {
    addItem(st.player.slots, q.item, q.n);
    deliver(st, q.id);
  }
  refreshRequests(st);
  sleepThrough(st, (id) => buildMap(id, st), false);
}

type Path = (string | number)[];

/** Where a damaged value sits, as the check sees it. Free text is shown on screen, never looked up, so any short text will do. */
const FREE_TEXT = [
  /^player\.name$/, /^pets\.\d+\.(id|name)$/, /^requests\.\d+\.(id|npc)$/, /^flags\./,
  // only ever asked "is this one in the list?", so a name the game does not know is harmless
  /^(seen|recipes|upgrades)\.\d+$/,
];

/** Each leaf in the save, and a few from each large collection (a field of soil, say) so the walk stays quick. */
function leaves(v: unknown, path: Path = [], out: { path: Path; value: unknown }[] = []): { path: Path; value: unknown }[] {
  if (Array.isArray(v)) {
    const idx = v.length > 30 ? [0, 1, 2, v.length - 1] : v.map((_, i) => i);
    for (const i of idx) leaves(v[i], [...path, i], out);
  } else if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v);
    const pick = keys.length > 30 ? [...keys.slice(0, 3), keys[keys.length - 1] as string] : keys;
    for (const k of pick) leaves((v as Record<string, unknown>)[k], [...path, k], out);
  } else out.push({ path, value: v });
  return out;
}

const set = (root: unknown, path: Path, value: unknown): void => {
  let o = root as Record<string | number, unknown>;
  for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>;
  o[path[path.length - 1] as string | number] = value;
};

const label = (path: Path): string => path.join('.');

describe('a save that has been damaged', () => {
  const base = rich();

  it('starts from a farm the check accepts and the game can play', () => {
    expect(whatIsWrong(clone(base))).toBeNull();
    const st = clone(base);
    playOn(st);
    expect(whatIsWrong(clone(st))).toBeNull();
  });

  const all = leaves(base);

  it('is damaged in plenty of places', () => {
    expect(all.length).toBeGreaterThan(150);
    expect(new Set(all.map((l) => l.path[0])).size).toBeGreaterThan(15);
  });

  it('is turned away if a name the game looks up is wrong, wherever that name sits', () => {
    const missed: string[] = [];
    for (const { path, value } of all) {
      if (typeof value !== 'string') continue;
      if (FREE_TEXT.some((re) => re.test(label(path)))) continue;
      for (const bad of ['zzz-unknown', '']) {
        const s = clone(base);
        set(s, path, bad);
        if (checkSave(s).ok) missed.push(`${label(path)} = "${bad}"`);
      }
    }
    expect(missed).toEqual([]);
  });

  it('is turned away or plays safely, whatever a number or a flag is turned into', () => {
    const trouble: string[] = [];
    let played = 0;
    const swaps: unknown[] = [-1, 0.5, 1e12, 1e308, null, 'x', [], {}, true];
    for (const { path, value } of all) {
      if (typeof value === 'string' && FREE_TEXT.some((re) => re.test(label(path)))) continue;
      for (const bad of swaps) {
        if (bad === value) continue;
        const s = clone(base);
        set(s, path, bad);
        const r = checkSave(s);
        if (!r.ok) continue;
        played += 1;
        try {
          playOn(r.state);
          const after = whatIsWrong(clone(r.state));
          if (after) trouble.push(`${label(path)} = ${JSON.stringify(bad)} then the game's own save is refused: ${after}`);
        } catch (e) {
          trouble.push(`${label(path)} = ${JSON.stringify(bad)} then ${(e as Error).message}`);
        }
      }
    }
    // some damage is harmless and gets through; the test is only worth anything if it did play on a good number of those
    expect(played).toBeGreaterThan(50);
    expect(trouble).toEqual([]);
  }, 180_000);

  it('is turned away if a chest, furnace or sprinkler has nothing behind it, or a thing has no body', () => {
    const noThing = clone(base);
    delete noThing.locations.farm?.things['4,3'];
    expect(checkSave(noThing).ok).toBe(false);
    const noBody = clone(base);
    delete noBody.locations.farm?.objects['3,3'];
    expect(checkSave(noBody).ok).toBe(false);
    const wrongKind = clone(base);
    if (wrongKind.locations.farm) wrongKind.locations.farm.things['4,3'] = { kind: 'furnace' };
    expect(checkSave(wrongKind).ok).toBe(false);
  });

  it('is turned away if the look of a thing is one the game never made', () => {
    const s = clone(base);
    const farm = s.locations.farm;
    if (farm) farm.objects['6,3'] = { k: 'decor', v: 9999, hp: 1 };
    expect(checkSave(s).ok).toBe(false);
  });
});
