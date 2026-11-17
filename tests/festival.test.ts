import { describe, expect, it } from 'vitest';
import { FESTIVALS, festivalOpen, festivalSpot, festivalToday } from '../src/data/festivals';
import { storeStock } from '../src/data/shops';
import { NPCS } from '../src/data/npcs';
import { isSolidTile } from '../src/game/actions';
import { enterContest, enteredToday, openContest, placeFor } from '../src/game/festival';
import { FINALE_AT, FINALE_LATE, finaleDone, finaleDue, finaleReport, finishFinale } from '../src/game/finale';
import { addItem, countItem, emptySlots } from '../src/game/inventory';
import { friendOf, stopFor, talkTo } from '../src/game/social';
import { newGame, locationFromMap } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { BUNDLES } from '../src/data/bundles';
import { buildMap } from '../src/world/maps/registry';

const at = (day: number, hour: number): GameState => {
  const st = newGame(7);
  st.day = day;
  st.minute = hour * 60;
  st.player.slots = emptySlots(20);
  return st;
};

describe('the calendar', () => {
  it('holds a fair on the last day of every season, every year', () => {
    expect([7, 14, 21, 28].map(festivalToday)).toEqual(['blossom', 'sunfair', 'harvest', 'lantern']);
    expect(festivalToday(28 + 7)).toBe('blossom');
    expect(festivalToday(8)).toBeNull();
  });

  it('opens at ten and closes in the evening', () => {
    expect(festivalOpen(7, 9 * 60)).toBeNull();
    expect(festivalOpen(7, 10 * 60)?.id).toBe('blossom');
    expect(festivalOpen(7, 20 * 60)).toBeNull();
    expect(festivalOpen(28, 23 * 60)?.id).toBe('lantern');
    expect(festivalOpen(8, 12 * 60)).toBeNull();
  });
});

describe('the green on fair day', () => {
  it('gathers every villager while the fair is open', () => {
    const st = at(14, 12);
    for (const npc of NPCS) {
      const stop = stopFor(npc, st);
      expect(stop?.map, npc.id).toBe('village');
    }
    expect(stopFor(NPCS[0]!, at(14, 9))?.map ?? null).not.toBe('lake');
    expect(festivalSpot('mirren', 15, 12 * 60)).toBeNull();
  });

  it('puts everyone on open ground, one to a tile', () => {
    const st = at(7, 12);
    const map = buildMap('village', st);
    const loc = locationFromMap(map.objects);
    const seen = new Set<string>();
    for (const npc of NPCS) {
      const s = festivalSpot(npc.id, 7, 12 * 60);
      expect(s, npc.id).not.toBeNull();
      expect(isSolidTile(map, loc, s!.x, s!.y), `${npc.id} stands in something`).toBe(false);
      const key = `${s!.x},${s!.y}`;
      expect(seen.has(key), `${npc.id} shares a tile`).toBe(false);
      seen.add(key);
    }
  });

  it('puts up bunting and the judging stall only on fair days', () => {
    const plain = buildMap('village', at(8, 12));
    expect(plain.hotspots.some((h) => h.kind === 'festival')).toBe(false);
    expect(plain.props.some((p) => p.sprite.startsWith('prop/bunting'))).toBe(false);
    const fair = buildMap('village', at(7, 12));
    expect(fair.hotspots.some((h) => h.kind === 'festival')).toBe(true);
    expect(fair.props.filter((p) => p.sprite === 'prop/bunting-spring')).toHaveLength(8);
    expect(buildMap('village', at(21, 12)).props.some((p) => p.sprite === 'prop/bunting-fall')).toBe(true);
  });

  it('has something fair-like to say when you chat', () => {
    const st = at(14, 12);
    friendOf(st, 'tam');
    talkTo(st, 'tam');
    const second = talkTo(st, 'tam');
    expect(second.pages.join(' ')).toContain(FESTIVALS.sunfair.talk.tam);
  });
});

describe('the contests', () => {
  const bag = (st: GameState, id: string, n = 1): number => { addItem(st.player.slots, id, n); return st.player.slots.findIndex((s) => s?.id === id); };

  it('grades an entry by what it would sell for', () => {
    const marks = [150, 70, 40] as const;
    expect([200, 150, 149, 70, 69, 40, 39, 0].map((v) => placeFor(v, marks))).toEqual(['first', 'first', 'second', 'second', 'third', 'third', 'entrant', 'entrant']);
  });

  it('only takes what the show is about', () => {
    const st = at(14, 12);
    expect(openContest(st)?.contest.title).toBe('The Fishing Derby');
    const radish = bag(st, 'radish');
    expect(enterContest(st, radish)).toBeNull();
    expect(countItem(st.player.slots, 'radish')).toBe(1);
    const trout = bag(st, 'fish-trout');
    expect(enterContest(st, trout)).not.toBeNull();
    expect(countItem(st.player.slots, 'fish-trout')).toBe(0);
  });

  it('pays gold, shares the glory with friends you have met, and lets you enter once a day', () => {
    const st = at(14, 12);
    friendOf(st, 'mirren').met = true;
    const before = st.player.gold;
    const koi = bag(st, 'fish-koi');
    const r = enterContest(st, koi)!;
    expect(r.place).toBe('first');
    expect(st.player.gold).toBe(before + r.gold);
    expect(friendOf(st, 'mirren').points).toBeGreaterThan(0);
    expect(friendOf(st, 'bram').points).toBe(0);
    expect(enteredToday(st)).toBe('first');
    expect(countItem(st.player.slots, 'gem-aquamarine')).toBe(1);
    const another = bag(st, 'fish-perch');
    expect(enterContest(st, another)).toBeNull();
    st.day = 14 + 28;
    expect(enteredToday(st)).toBeNull();
  });

  it('is closed outside the fair and on days without one', () => {
    const slot = (st: GameState): number => { addItem(st.player.slots, 'fish-koi', 1); return 0; };
    for (const st of [at(14, 9), at(14, 21), at(15, 12), at(28, 12)]) {
      expect(enterContest(st, slot(st))).toBeNull();
    }
  });

  it('unlocks strawberry seeds for anyone who enters the Spring Show', () => {
    const st = at(7, 12);
    expect(storeStock('spring', st.flags)).not.toContain('seed-strawberry');
    const r = enterContest(st, bag(st, 'flower'))!;
    expect(r.place).toBe('entrant');
    expect(storeStock('spring', st.flags)).toContain('seed-strawberry');
  });

  it('turns a prize that does not fit in the bag into gold', () => {
    const st = at(21, 12);
    st.player.slots = emptySlots(1);
    addItem(st.player.slots, 'pumpkin', 2);
    const gold = st.player.gold;
    const r = enterContest(st, 0)!;
    expect(r.place).toBe('first');
    expect(st.player.gold).toBe(gold + r.gold + 300);
  });
});

describe('the Lantern Festival finale', () => {
  it('waits for night on the green, and carries you there late on the day itself', () => {
    expect(finaleDue(at(28, 19), 'village')).toBe(false);
    expect(finaleDue(at(28, 20), 'village')).toBe(true);
    expect(finaleDue(at(28, 20), 'farm')).toBe(false);
    expect(finaleDue(at(28, FINALE_LATE / 60), 'farm')).toBe(true);
    expect(finaleDue(at(27, 21), 'village')).toBe(false);
    expect(finaleDue(at(29, 21), 'village')).toBe(true);
    expect(finaleDue(at(29, 21), 'farm')).toBe(false);
    expect(FINALE_AT).toBeLessThan(FINALE_LATE);
  });

  it('plays once', () => {
    const st = at(28, 21);
    expect(finaleDone(st)).toBe(false);
    finishFinale(st);
    expect(finaleDone(st)).toBe(true);
    expect(finaleDue(st, 'village')).toBe(false);
  });

  it('says something kind however many lanterns are lit', () => {
    const st = at(28, 21);
    const titles = new Set<string>();
    for (const n of [0, 1, 3, 4, 6, 7]) {
      for (const b of BUNDLES) st.bundles[b.id] = b.slots.map((s, i) => (BUNDLES.indexOf(b) < n ? s.n : 0 * i));
      const r = finaleReport(st);
      expect(r.lit).toBe(n);
      expect(r.lines.length).toBeGreaterThan(0);
      titles.add(r.title);
    }
    expect(titles.size).toBe(4);
    expect(finaleReport(st).rows.map((r) => r[0])).toContain('Gold earned');
  });
});
