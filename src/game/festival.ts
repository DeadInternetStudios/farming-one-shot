import { festivalOpen } from '../data/festivals';
import type { Contest, FestivalDef, Place } from '../data/festivals';
import { itemDef } from '../data/items';
import { NPCS } from '../data/npcs';
import { addItem, takeFromSlot } from './inventory';
import { friendOf } from './social';
import type { GameState } from './state';

const PRIZE: Readonly<Record<Place, { gold: number; points: number; line: string }>> = {
  first: { gold: 400, points: 50, line: 'First prize! The whole green cheers.' },
  second: { gold: 250, points: 30, line: 'Second place, and not by much.' },
  third: { gold: 150, points: 20, line: 'Third place. A ribbon is a ribbon.' },
  entrant: { gold: 50, points: 10, line: 'Every entry earns a ribbon. Yours is a lovely one.' },
};

const RANK: readonly Place[] = ['entrant', 'third', 'second', 'first'];
const atLeast = (place: Place, from: Place): boolean => RANK.indexOf(place) >= RANK.indexOf(from);

export const entryKey = (day: number): string => `fair-${day}`;

/** What you entered today, if you did. */
export const enteredToday = (st: GameState): Place | null => {
  const v = st.flags[entryKey(st.day)];
  return typeof v === 'string' ? (v as Place) : null;
};

/** The contest you could enter right now: a fair is open and has one. */
export function openContest(st: GameState): { fest: FestivalDef; contest: Contest } | null {
  const fest = festivalOpen(st.day, st.minute);
  return fest?.contest ? { fest, contest: fest.contest } : null;
}

export function placeFor(score: number, marks: Contest['marks']): Place {
  if (score >= marks[0]) return 'first';
  if (score >= marks[1]) return 'second';
  if (score >= marks[2]) return 'third';
  return 'entrant';
}

export interface ContestResult {
  place: Place;
  gold: number;
  /** What was said, a line at a time. */
  lines: string[];
}

/** Hand in the item in a slot. The entry is kept; the prize and the cheers are yours. */
export function enterContest(st: GameState, slot: number): ContestResult | null {
  const open = openContest(st);
  const held = st.player.slots[slot];
  if (!open || !held || enteredToday(st)) return null;
  const def = itemDef(held.id);
  if (!open.contest.accepts(def)) return null;
  takeFromSlot(st.player.slots, slot, 1);
  const place = placeFor(def.sell, open.contest.marks);
  const prize = PRIZE[place];
  st.player.gold += prize.gold;
  st.stats.earned += prize.gold;
  for (const npc of NPCS) {
    const f = friendOf(st, npc.id);
    if (f.met) f.points += prize.points;
  }
  const lines = [`Mirren holds up your ${def.name} for the whole green to see.`, prize.line, `${prize.gold} gold is yours.`];
  const bonus = open.contest.bonus;
  if (bonus && atLeast(place, bonus.from)) {
    if (bonus.flag) st.flags[bonus.flag] = true;
    if (bonus.item) {
      const left = addItem(st.player.slots, bonus.item.id, bonus.item.n);
      if (left > 0) st.player.gold += itemDef(bonus.item.id).sell * left;
    }
    lines.push(bonus.text);
  }
  st.flags[entryKey(st.day)] = place;
  return { place, gold: prize.gold, lines };
}
