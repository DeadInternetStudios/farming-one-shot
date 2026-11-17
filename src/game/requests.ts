import { CROP_LIST, itemDef } from '../data/items';
import { seasonOf } from './clock';
import { countItem, removeItem } from './inventory';
import { pick, randInt, rngFor } from './rng';
import type { Rand } from './rng';
import { friendOf } from './social';
import type { GameState, Request } from './state';

export const MAX_REQUESTS = 3;
const REQUEST_FRIEND_POINTS = 60;

interface Want {
  item: (state: GameState, r: Rand) => string | null;
  n: [number, number];
}

/** A crop that grows right now. In winter nothing does, so nobody asks for one. */
const crop = (state: GameState, r: Rand): string | null => {
  const season = seasonOf(state.day);
  const options = CROP_LIST.filter((c) => c.seasons.includes(season) && c.sell < 200);
  return options.length > 0 ? pick(r, options).id : null;
};

const known = (state: GameState, recipe: string, id: string): string | null => (state.recipes.includes(recipe) ? id : null);

/** What each villager might ask for. Anything they ask for is something you can get by now. */
const WANTS: Readonly<Record<string, Want[]>> = {
  mirren: [{ item: crop, n: [4, 8] }, { item: () => 'loaf', n: [1, 2] }],
  ida: [{ item: crop, n: [5, 9] }, { item: () => 'egg', n: [4, 6] }, { item: (s) => known(s, 'soup', 'dish-soup'), n: [1, 2] }, { item: (s) => known(s, 'salad', 'dish-salad'), n: [1, 3] }],
  bram: [{ item: () => 'coal', n: [4, 8] }, { item: () => 'copperOre', n: [5, 9] }, { item: (s) => (s.deepest >= 3 ? 'ironOre' : null), n: [3, 6] }],
  tam: [{ item: () => 'fish-perch', n: [1, 3] }, { item: () => 'fish-carp', n: [1, 2] }, { item: () => 'fish-trout', n: [1, 2] }],
  wren: [{ item: () => 'mushroom', n: [3, 6] }, { item: () => 'berry', n: [5, 9] }, { item: () => 'flower', n: [4, 7] }],
  olwen: [{ item: () => 'flower', n: [4, 7] }, { item: (s) => known(s, 'tea', 'dish-tea'), n: [1, 2] }, { item: () => 'berry', n: [4, 8] }],
};

export function rewardFor(item: string, n: number): number {
  return Math.round((itemDef(item).sell * n * 1.5 + 20) / 5) * 5;
}

/** Called every morning: old notes come down, and a new one may go up. */
export function refreshRequests(state: GameState): void {
  state.requests = state.requests.filter((q) => q.until >= state.day);
  if (state.day < 3 || state.requests.length >= MAX_REQUESTS) return;
  const r = rngFor(state.seed, state.day, 31);
  if (state.requests.length > 0 && r() < 0.35) return;
  const askers = Object.keys(WANTS).filter((id) => state.social[id]?.met && !state.requests.some((q) => q.npc === id));
  if (askers.length === 0) return;
  const npc = pick(r, askers);
  const want = pick(r, WANTS[npc] as Want[]);
  const item = want.item(state, r);
  if (!item) return;
  const n = randInt(r, want.n[0], want.n[1]);
  state.requests.push({ id: `${state.day}-${npc}`, npc, item, n, reward: rewardFor(item, n), until: state.day + randInt(r, 4, 6) });
}

export type Delivery = { ok: true; request: Request } | { ok: false; msg: string };

export function deliver(state: GameState, id: string): Delivery {
  const q = state.requests.find((x) => x.id === id);
  if (!q) return { ok: false, msg: 'That note is gone.' };
  if (countItem(state.player.slots, q.item) < q.n) return { ok: false, msg: `You need ${q.n} ${itemDef(q.item).name}.` };
  removeItem(state.player.slots, q.item, q.n);
  state.player.gold += q.reward;
  state.stats.earned += q.reward;
  friendOf(state, q.npc).points += REQUEST_FRIEND_POINTS;
  state.requests = state.requests.filter((x) => x.id !== id);
  return { ok: true, request: q };
}
