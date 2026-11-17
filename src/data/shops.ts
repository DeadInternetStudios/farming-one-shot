import { CROP_LIST } from './items';
import type { Season } from '../game/types';

export interface ShopDef {
  id: string;
  name: string;
  keeper: string;
  /** Opening hours in minutes since midnight. */
  open: number;
  close: number;
  greeting: string;
  closedLine: string;
}

export const SHOPS: Readonly<Record<string, ShopDef>> = {
  store: {
    id: 'store', name: "Mirren's General Store", keeper: 'mirren', open: 9 * 60, close: 18 * 60,
    greeting: 'Seeds, supplies, and a smile. What can I get you?',
    closedLine: 'The store is closed. Mirren opens at 9 in the morning and closes at 6.',
  },
  cafe: {
    id: 'cafe', name: "Ida's Cafe", keeper: 'ida', open: 8 * 60, close: 20 * 60,
    greeting: 'Sit anywhere! Soup is hot, and I will pay well for a home-cooked dish.',
    closedLine: 'The cafe is closed. Ida serves from 8 in the morning until 8 at night.',
  },
  smithy: {
    id: 'smithy', name: "Bram's Smithy", keeper: 'bram', open: 9 * 60, close: 17 * 60,
    greeting: 'Hm. Ore. Bars. Tools. What do you need?',
    closedLine: 'The forge is cold. Bram works from 9 until 5.',
  },
};

/** What the store has on its shelves for a season. Prices come from the item definitions. */
export function storeStock(season: Season, flags: Record<string, boolean | number | string>): string[] {
  const seeds = CROP_LIST.filter((c) => c.seasons.includes(season) && c.id !== 'strawberry').map((c) => `seed-${c.id}`);
  const out = [...seeds, 'loaf', 'hay'];
  if (flags['festival-strawberry']) out.push('seed-strawberry');
  return out;
}

export const CAFE_STOCK = ['loaf', 'dish-tea', 'dish-soup'] as const;
export const SMITHY_STOCK = ['coal', 'copperOre'] as const;

/** One-off purchases that change the farm for good. */
export interface Upgrade {
  id: string;
  name: string;
  blurb: string;
  price: number;
  needs?: { id: string; n: number }[];
  requires?: string;
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'bag-1', name: 'Bigger Bag', blurb: 'Ten more slots to carry things.', price: 1500 },
  { id: 'bag-2', name: 'Biggest Bag', blurb: 'Ten more slots again.', price: 5000, requires: 'bag-1' },
  { id: 'coop', name: 'Chicken Coop', blurb: 'A cosy coop for up to four chickens. Built overnight.', price: 1200, needs: [{ id: 'wood', n: 40 }, { id: 'stone', n: 20 }] },
  { id: 'chick', name: 'Chicken', blurb: 'One chicken for the coop. Eggs every day.', price: 400, requires: 'coop' },
  { id: 'cat', name: 'Farm Cat', blurb: 'A cat who will supervise.', price: 250 },
];

/** Tool upgrade costs. Bars and gold are taken when you hand the tool over; it is ready in two days. */
export const TOOL_UPGRADES = {
  copper: { gold: 500, bar: 'copperBar', n: 3 },
  silver: { gold: 1500, bar: 'ironBar', n: 3 },
  gold: { gold: 5000, bar: 'goldBar', n: 3 },
} as const;
