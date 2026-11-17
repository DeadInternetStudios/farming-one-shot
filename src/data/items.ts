import cropsJson from './crops.json';
import { DECOR, decorItemId } from '../features/garden/catalog';
import type { Season, ToolId } from '../game/types';

export type ItemKind = 'tool' | 'seed' | 'crop' | 'resource' | 'forage' | 'fish' | 'food' | 'gem' | 'goods' | 'gift' | 'special' | 'machine';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Atlas frame name. Tools resolve their tier at draw time. */
  icon: string;
  sell: number;
  stack: number;
  blurb: string;
  /** Energy restored when eaten. */
  energy?: number;
  /** Price in the general store, when sold there. */
  buy?: number;
}

export interface CropDef {
  id: string;
  name: string;
  seasons: Season[];
  days: number;
  regrow: number;
  yield: number;
  seed: number;
  sell: number;
  blurb: string;
  art: Record<string, string | boolean>;
}

export const CROPS: Readonly<Record<string, CropDef>> = Object.fromEntries(
  (cropsJson as unknown as CropDef[]).map((c) => [c.id, c]),
);
export const CROP_LIST: readonly CropDef[] = Object.values(CROPS);

export const TOOL_IDS: readonly ToolId[] = ['hoe', 'can', 'axe', 'pick', 'scythe', 'rod'];
const TOOL_NAMES: Record<ToolId, string> = { hoe: 'Hoe', can: 'Watering Can', axe: 'Axe', pick: 'Pickaxe', scythe: 'Scythe', rod: 'Fishing Rod' };
const TOOL_BLURBS: Record<ToolId, string> = {
  hoe: 'Turns grass into soil that is ready to plant.',
  can: 'Waters your crops. Refill it at any water.',
  axe: 'Chops trees, stumps and logs.',
  pick: 'Breaks rocks and digs out ore.',
  scythe: 'Cuts weeds and tall grass.',
  rod: 'For catching fish. Hold, then reel at the bite.',
};

const resource = (id: string, name: string, sell: number, blurb: string, extra: Partial<ItemDef> = {}): ItemDef => ({
  id, name, kind: 'resource', icon: `item/${id}`, sell, stack: 99, blurb, ...extra,
});

const BASE: ItemDef[] = [
  ...TOOL_IDS.map((id): ItemDef => ({ id, name: TOOL_NAMES[id], kind: 'tool', icon: `item/${id}`, sell: 0, stack: 1, blurb: TOOL_BLURBS[id] })),
  resource('wood', 'Wood', 8, 'A sturdy length of timber.'),
  resource('stone', 'Stone', 6, 'Good for walls, paths and furnaces.'),
  resource('fiber', 'Fiber', 4, 'Springy plant fiber.'),
  resource('hay', 'Hay', 5, 'Sweet dried grass. Animals love it.', { buy: 12 }),
  resource('coal', 'Coal', 25, 'Burns hot and long.', { buy: 60 }),
  resource('copperOre', 'Copper Ore', 18, 'A glint of orange in grey rock.', { buy: 45 }),
  resource('ironOre', 'Iron Ore', 30, 'Heavy and dependable.'),
  resource('goldOre', 'Gold Ore', 55, 'It catches the lantern light.'),
  resource('copperBar', 'Copper Bar', 110, 'Smelted copper, ready to be a tool.'),
  resource('ironBar', 'Iron Bar', 160, 'A bar of good iron.'),
  resource('goldBar', 'Gold Bar', 300, 'Shining and heavy.'),
  resource('clay', 'Clay', 12, 'Soft, cool and good for pots.'),
  resource('sap', 'Sap', 14, 'Sticky amber from the trees.'),
  { id: 'coin', name: 'Coin', kind: 'special', icon: 'item/coin', sell: 0, stack: 1, blurb: 'Shiny.' },
  { id: 'egg', name: 'Egg', kind: 'goods', icon: 'item/egg', sell: 50, stack: 99, blurb: 'Still warm.', energy: 20 },
  { id: 'loaf', name: 'Country Loaf', kind: 'food', icon: 'item/loaf', sell: 60, stack: 99, blurb: 'Crusty on the outside.', energy: 35, buy: 120 },
  { id: 'mushroom', name: 'Red Cap Mushroom', kind: 'forage', icon: 'item/mushroom', sell: 40, stack: 99, blurb: 'Found where the forest is damp.', energy: 15 },
  { id: 'berry', name: 'Wild Berries', kind: 'forage', icon: 'item/berry', sell: 25, stack: 99, blurb: 'A handful of sweet-sour jewels.', energy: 12 },
  { id: 'flower', name: 'Wildflower', kind: 'forage', icon: 'item/flower', sell: 20, stack: 99, blurb: 'Too pretty to leave in the grass.' },
  { id: 'lantern', name: 'Valley Lantern', kind: 'special', icon: 'item/lantern', sell: 0, stack: 1, blurb: 'It wants to be lit.' },
];

const fish = (id: string, name: string, sell: number, blurb: string): ItemDef => ({ id: `fish-${id}`, name, kind: 'fish', icon: `item/fish-${id}`, sell, stack: 99, blurb, energy: Math.round(sell / 5) });
const gem = (id: string, name: string, sell: number, blurb: string): ItemDef => ({ id: `gem-${id}`, name, kind: 'gem', icon: `item/gem-${id}`, sell, stack: 99, blurb });
const dish = (id: string, name: string, sell: number, energy: number, blurb: string): ItemDef => ({ id: `dish-${id}`, name, kind: 'food', icon: `item/dish-${id}`, sell, stack: 99, blurb, energy });
const machine = (id: string, name: string, blurb: string): ItemDef => ({ id, name, kind: 'machine', icon: `item/${id}`, sell: 0, stack: 99, blurb });

const EXTRA: ItemDef[] = [
  fish('minnow', 'Minnow', 20, 'A flash of silver in shallow water.'),
  fish('perch', 'Perch', 35, 'Striped and spirited.'),
  fish('trout', 'Trout', 60, 'Quick and clever. Loves cold water.'),
  fish('carp', 'Carp', 45, 'Slow, wise and mossy.'),
  fish('eel', 'Eel', 90, 'Slippery, shy, and best at dusk.'),
  fish('koi', 'Silver Koi', 300, 'Tam has seen her twice. Now you have too.'),
  gem('amethyst', 'Amethyst', 100, 'Deep purple, like a held breath.'),
  gem('topaz', 'Topaz', 85, 'Warm as honey in the light.'),
  gem('aquamarine', 'Aquamarine', 120, 'A chip of lake water, frozen.'),
  gem('ruby', 'Ruby', 260, 'It glows from the inside.'),
  dish('soup', 'Vegetable Soup', 130, 50, 'Warm, filling and forgiving.'),
  dish('stew', 'Hearty Stew', 210, 80, 'Stick-to-your-ribs good.'),
  dish('pie', 'Fruit Pie', 280, 60, 'The pride of the cafe.'),
  dish('salad', 'Garden Salad', 150, 45, 'Crunchy, bright and quick.'),
  dish('jam', 'Berry Jam', 170, 35, 'Sweet and slow.'),
  dish('tea', 'Wildflower Tea', 100, 30, 'Gentle, golden and calming.'),
  machine('chest', 'Storage Chest', 'Place it on your land to store things.'),
  machine('furnace', 'Furnace', 'Smelts ore into bars. Feed it coal.'),
  machine('sprinkler', 'Sprinkler', 'Waters the four tiles around it every night.'),
];

const cropItems: ItemDef[] = CROP_LIST.flatMap((c): ItemDef[] => [
  {
    id: `seed-${c.id}`, name: `${c.name} Seeds`, kind: 'seed', icon: `item/seed-${c.id}`,
    sell: Math.floor(c.seed / 2), stack: 99, blurb: `Grows in ${c.seasons.join(' and ')}. Ripe in ${c.days} days${c.regrow ? `, then every ${c.regrow}` : ''}.`,
    buy: c.id === 'strawberry' ? undefined : c.seed,
  },
  { id: c.id, name: c.name, kind: 'crop', icon: `item/${c.id}`, sell: c.sell, stack: 99, blurb: c.blurb, energy: Math.round(c.sell / 3) },
]);

/** Garden pieces are bought in the store and put down like a chest. */
const decorItems: ItemDef[] = DECOR.map((d) => ({
  id: decorItemId(d), name: d.name, kind: 'machine', icon: `item/${decorItemId(d)}`, sell: 0, stack: 99, blurb: d.blurb, buy: d.price,
}));

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.fromEntries([...BASE, ...EXTRA, ...cropItems, ...decorItems].map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item: ${id}`);
  return d;
}

export const seedFor = (cropId: string): string => `seed-${cropId}`;
export const cropOfSeed = (seedId: string): CropDef | undefined => (seedId.startsWith('seed-') ? CROPS[seedId.slice(5)] : undefined);
