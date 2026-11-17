/** The seven lanterns. Each one lights when its bundle is complete. */
export interface BundleSlot {
  /** One or more item ids that fit this slot. */
  any: readonly string[];
  n: number;
  label: string;
}

export interface BundleDef {
  id: string;
  name: string;
  blurb: string;
  slots: readonly BundleSlot[];
  reward: { gold: number; item?: { id: string; n: number } };
}

const one = (id: string, n = 1, label = ''): BundleSlot => ({ any: [id], n, label });

export const BUNDLES: readonly BundleDef[] = [
  {
    id: 'spring', name: 'Spring Garden', blurb: 'What the first warm rains bring up.',
    slots: [one('radish', 2), one('potato', 2), one('cauliflower'), one('tulip', 2)],
    reward: { gold: 300, item: { id: 'seed-cauliflower', n: 6 } },
  },
  {
    id: 'summer', name: 'Summer Sun', blurb: 'Fruit that tastes like long evenings.',
    slots: [one('tomato', 2), one('blueberry', 3), one('melon'), one('sunflower')],
    reward: { gold: 500, item: { id: 'seed-melon', n: 4 } },
  },
  {
    id: 'fall', name: 'Harvest Table', blurb: 'The heavy, golden things.',
    slots: [one('pumpkin'), one('corn', 2), one('eggplant', 2), one('cranberry', 3)],
    reward: { gold: 700, item: { id: 'seed-pumpkin', n: 4 } },
  },
  {
    id: 'forage', name: "Forager's Basket", blurb: 'Gifts the woods leave for anyone who looks.',
    slots: [one('mushroom', 3), one('berry', 4), one('flower', 4), one('sap', 2), one('clay', 2)],
    reward: { gold: 400, item: { id: 'dish-tea', n: 3 } },
  },
  {
    id: 'angler', name: "Angler's Creel", blurb: 'Quiet patience, caught on a line.',
    slots: [one('fish-minnow'), one('fish-perch'), one('fish-trout'), one('fish-carp'), { any: ['fish-eel', 'fish-koi'], n: 1, label: 'Eel or koi' }],
    reward: { gold: 600, item: { id: 'dish-stew', n: 3 } },
  },
  {
    id: 'miner', name: "Miner's Satchel", blurb: 'What is hidden in the old quarry.',
    slots: [one('copperBar', 2), one('ironBar'), one('coal', 5), { any: ['gem-amethyst', 'gem-topaz', 'gem-aquamarine', 'gem-ruby'], n: 2, label: 'Any 2 gems' }],
    reward: { gold: 900, item: { id: 'goldBar', n: 1 } },
  },
  {
    id: 'hearth', name: 'Hearth and Home', blurb: 'The warm things that make a house a home.',
    slots: [one('egg', 4), one('milk'), one('loaf', 2), { any: ['dish-soup', 'dish-stew', 'dish-pie', 'dish-salad', 'dish-jam'], n: 2, label: 'Any 2 dishes' }, one('dish-tea')],
    reward: { gold: 800, item: { id: 'seed-pumpkin', n: 4 } },
  },
];

export const BUNDLE_BY_ID: Readonly<Record<string, BundleDef>> = Object.fromEntries(BUNDLES.map((b) => [b.id, b]));
