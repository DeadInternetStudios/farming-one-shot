export interface Ingredient {
  /** Item ids separated by | when any of them will do. */
  of: string;
  n: number;
  label?: string;
}

export interface Recipe {
  id: string;
  kind: 'craft' | 'cook';
  name: string;
  makes: string;
  n: number;
  ingredients: readonly Ingredient[];
  blurb: string;
  /** Known from the very start. */
  start?: boolean;
}

const VEG = 'radish|potato|tomato|pepper|eggplant|yam|cauliflower';
const FRUIT = 'strawberry|blueberry|cranberry|melon';

export const RECIPES: readonly Recipe[] = [
  { id: 'chest', kind: 'craft', name: 'Storage Chest', makes: 'chest', n: 1, ingredients: [{ of: 'wood', n: 20 }], blurb: 'Keeps things safe. Place it anywhere on your land.', start: true },
  { id: 'furnace', kind: 'craft', name: 'Furnace', makes: 'furnace', n: 1, ingredients: [{ of: 'stone', n: 20 }, { of: 'copperOre', n: 5 }], blurb: 'Smelts ore into bars. Feed it coal.', start: true },
  { id: 'sprinkler', kind: 'craft', name: 'Sprinkler', makes: 'sprinkler', n: 1, ingredients: [{ of: 'copperBar', n: 1 }, { of: 'wood', n: 5 }], blurb: 'Waters the four tiles around it every night.' },
  { id: 'jam', kind: 'cook', name: 'Berry Jam', makes: 'dish-jam', n: 1, ingredients: [{ of: 'berry|strawberry|blueberry|cranberry', n: 3, label: 'Any berries' }], blurb: 'Sweet and slow. Spreads on everything.', start: true },
  { id: 'salad', kind: 'cook', name: 'Garden Salad', makes: 'dish-salad', n: 1, ingredients: [{ of: 'cauliflower|tomato|pepper|radish', n: 1, label: 'A crisp vegetable' }, { of: 'berry|flower', n: 1, label: 'Berries or a flower' }], blurb: 'Crunchy, bright and quick.', start: true },
  { id: 'soup', kind: 'cook', name: 'Vegetable Soup', makes: 'dish-soup', n: 1, ingredients: [{ of: VEG, n: 2, label: 'Any vegetables' }], blurb: 'Warm, filling and forgiving.' },
  { id: 'stew', kind: 'cook', name: 'Hearty Stew', makes: 'dish-stew', n: 1, ingredients: [{ of: VEG, n: 2, label: 'Any vegetables' }, { of: 'egg', n: 1 }], blurb: 'Stick-to-your-ribs good.' },
  { id: 'pie', kind: 'cook', name: 'Fruit Pie', makes: 'dish-pie', n: 1, ingredients: [{ of: FRUIT, n: 2, label: 'Any fruits' }, { of: 'egg', n: 1 }, { of: 'wheat', n: 1 }], blurb: 'The pride of the cafe.' },
  { id: 'tea', kind: 'cook', name: 'Wildflower Tea', makes: 'dish-tea', n: 1, ingredients: [{ of: 'flower', n: 2 }], blurb: 'Gentle, golden and calming.' },
];

export const RECIPE_BY_ID: Readonly<Record<string, Recipe>> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const STARTER_RECIPES: readonly string[] = RECIPES.filter((r) => r.start).map((r) => r.id);
