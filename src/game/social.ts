import { festivalOpen, festivalSpot, gatherSpot } from '../data/festivals';
import { NPC_BY_ID, NPCS } from '../data/npcs';
import type { NpcDef, Stop, Unlock } from '../data/npcs';
import { itemDef } from '../data/items';
import { dayOfSeason, seasonOf, weekdayOf } from './clock';
import { addItem, takeFromSlot } from './inventory';
import { hashInts } from './rng';
import type { Friend, GameState } from './state';

export const POINTS_PER_HEART = 250;
export const MAX_HEARTS = 10;
export const TALK_POINTS = 20;

export const heartsOf = (points: number): number => Math.min(MAX_HEARTS, Math.floor(points / POINTS_PER_HEART));

export function friendOf(state: GameState, id: string): Friend {
  let f = state.social[id];
  if (!f) {
    f = { points: 0, met: false, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    state.social[id] = f;
  }
  return f;
}

export type Taste = 'love' | 'like' | 'neutral' | 'dislike';

export function tasteOf(npc: NpcDef, itemId: string): Taste {
  if (npc.loves.includes(itemId)) return 'love';
  if (npc.likes.includes(itemId)) return 'like';
  if (npc.dislikes.includes(itemId)) return 'dislike';
  return 'neutral';
}

export const isBirthday = (npc: NpcDef, day: number): boolean => seasonOf(day) === npc.birthday.season && dayOfSeason(day) === npc.birthday.day;

/** Where a villager is right now. Null when they are indoors or somewhere you cannot see. */
export function stopFor(npc: NpcDef, state: GameState, gather = false): Stop | null {
  const m = Math.floor(state.minute);
  const fair = gather ? gatherSpot(npc.id) : festivalSpot(npc.id, state.day, m);
  if (fair) return fair;
  const wd = weekdayOf(state.day);
  let best: Stop | null = null;
  for (const s of npc.stops) {
    if (s.from > m) continue;
    if (s.weather && !s.weather.includes(state.weather)) continue;
    if (s.days && !s.days.includes(wd)) continue;
    if (!best || s.from >= best.from) best = s;
  }
  return best;
}

export function npcsOnMap(state: GameState, map: string, gather = false): { npc: NpcDef; stop: Stop }[] {
  const out: { npc: NpcDef; stop: Stop }[] = [];
  for (const npc of NPCS) {
    const stop = stopFor(npc, state, gather);
    if (stop && stop.map === map) out.push({ npc, stop });
  }
  return out;
}

export interface Talk {
  /** Pages of speech, shown one after another. */
  pages: string[];
  unlocked: Unlock[];
  firstMeeting: boolean;
  spoke: boolean;
}

function pickLine(npc: NpcDef, state: GameState): string {
  const f = friendOf(state, npc.id);
  const h = heartsOf(f.points);
  if (isBirthday(npc, state.day)) return npc.birthdayLine;
  const fair = festivalOpen(state.day, state.minute)?.talk[npc.id];
  if (fair) return fair;
  const pool: string[] = [];
  const tier = h >= 6 ? 2 : h >= 2 ? 1 : 0;
  pool.push(...npc.talk[tier]);
  pool.push(npc.bySeason[seasonOf(state.day)]);
  const w = npc.byWeather[state.weather];
  if (w) pool.push(w, w);
  const seed = hashInts(state.seed, state.day, npc.id.length, npc.id.charCodeAt(0), f.talkedDay);
  return pool[seed % pool.length] as string;
}

/** Say hello. Talking once a day builds friendship; the first time ever is an introduction. */
export function talkTo(state: GameState, id: string): Talk {
  const npc = NPC_BY_ID[id];
  if (!npc) throw new Error('Unknown villager ' + id);
  const f = friendOf(state, id);
  const pages: string[] = [];
  const first = !f.met;
  if (first) {
    f.met = true;
    pages.push(npc.intro);
  }
  let spoke = false;
  if (f.talkedDay !== state.day) {
    f.talkedDay = state.day;
    f.points += TALK_POINTS;
    spoke = true;
  }
  if (!first) pages.push(pickLine(npc, state));
  if (!first && !spoke) pages.push('We have already had a good chat today.');
  const unlocked = claimUnlocks(state, npc);
  return { pages, unlocked, firstMeeting: first, spoke };
}

/** Hand out any friendship bonuses that have just been earned. */
export function claimUnlocks(state: GameState, npc: NpcDef): Unlock[] {
  const f = friendOf(state, npc.id);
  const h = heartsOf(f.points);
  const out: Unlock[] = [];
  for (const u of npc.unlocks) {
    if (h < u.hearts || f.claimed.includes(u.hearts)) continue;
    f.claimed.push(u.hearts);
    if (u.recipe && !state.recipes.includes(u.recipe)) state.recipes.push(u.recipe);
    if (u.item) addItem(state.player.slots, u.item.id, u.item.n);
    if (u.flag) state.flags[u.flag] = true;
    out.push(u);
  }
  return out;
}

export interface GiftResult {
  ok: boolean;
  taste: Taste;
  points: number;
  line: string;
  note?: string;
  unlocked: Unlock[];
}

const GIFT_POINTS: Record<Taste, number> = { love: 80, like: 45, neutral: 20, dislike: -20 };

export function canGift(state: GameState, id: string): string | null {
  const f = friendOf(state, id);
  if (!f.met) return 'You should introduce yourself first.';
  if (f.giftedDay === state.day) return 'You have already given a gift today.';
  if (state.day - f.weekStart >= 7) return null;
  if (f.giftsWeek >= 2) return 'Two gifts a week is plenty. Let the kindness breathe.';
  return null;
}

/** Give the item in a slot. One per call. */
export function giveGift(state: GameState, id: string, slot: number): GiftResult {
  const npc = NPC_BY_ID[id];
  const held = state.player.slots[slot];
  const none: GiftResult = { ok: false, taste: 'neutral', points: 0, line: '', unlocked: [] };
  if (!npc || !held) return none;
  const def = itemDef(held.id);
  if (def.kind === 'tool' || def.kind === 'special' || def.kind === 'machine') return { ...none, note: "That isn't something you can give away." };
  const why = canGift(state, id);
  if (why) return { ...none, note: why };
  const f = friendOf(state, id);
  const taste = tasteOf(npc, held.id);
  let points = GIFT_POINTS[taste];
  if (isBirthday(npc, state.day)) points = taste === 'dislike' ? 0 : points * 4;
  takeFromSlot(state.player.slots, slot, 1);
  if (state.day - f.weekStart >= 7) { f.weekStart = state.day; f.giftsWeek = 0; }
  f.giftsWeek += 1;
  f.giftedDay = state.day;
  f.points = Math.max(0, f.points + points);
  return { ok: true, taste, points, line: npc.gift[taste], unlocked: claimUnlocks(state, npc) };
}
