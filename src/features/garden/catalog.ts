// The garden: things you can buy from Mirren and put down anywhere on the farm. They are a way to spend
// gold and a way to make the valley glow. To cut the whole feature, set GARDEN_ON to false: the store stops
// selling them and the goals stop mentioning them. Anything already placed stays where it is.
import type { Season } from '../../game/types';

export const GARDEN_ON = true;

export interface DecorDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** One atlas frame, or one for each season. */
  frame: string | Readonly<Record<Season, string>>;
  /** The lit frame that fades in over it at night. */
  glow?: string;
  /** The pool of light it throws on the ground at night. `y` is how far above the bottom of its tile the light sits. */
  light?: { r: number; color: number; y: number };
}

/** Append only. A placed decoration is saved as its position in this list. */
export const DECOR: readonly DecorDef[] = [
  { id: 'lantern-red', name: 'Red Paper Lantern', blurb: 'A paper lantern on a stake. It glows red after dark.', price: 90, frame: 'deco/lantern-red', glow: 'deco/lantern-red-glow', light: { r: 46, color: 0xff7a5c, y: 16 } },
  { id: 'lantern-gold', name: 'Gold Paper Lantern', blurb: 'A paper lantern on a stake. It glows gold after dark.', price: 90, frame: 'deco/lantern-gold', glow: 'deco/lantern-gold-glow', light: { r: 46, color: 0xffcf5c, y: 16 } },
  { id: 'lantern-teal', name: 'Teal Paper Lantern', blurb: 'A paper lantern on a stake. It glows blue-green after dark.', price: 90, frame: 'deco/lantern-teal', glow: 'deco/lantern-teal-glow', light: { r: 46, color: 0x6cc4d4, y: 16 } },
  { id: 'lantern-pink', name: 'Pink Paper Lantern', blurb: 'A paper lantern on a stake. It glows pink after dark.', price: 90, frame: 'deco/lantern-pink', glow: 'deco/lantern-pink-glow', light: { r: 46, color: 0xff8fb0, y: 16 } },
  { id: 'lamp-post', name: 'Lamp Post', blurb: 'The same warm lamp that watches over the farmhouse. Lights a wide patch of ground.', price: 260, frame: 'prop/lamp', glow: 'prop/lamp-glow', light: { r: 78, color: 0xffbe66, y: 22 } },
  { id: 'stone-lantern', name: 'Stone Lantern', blurb: 'Quiet and old-looking. A small fire burns in its window all night.', price: 420, frame: 'deco/stone-lantern', glow: 'deco/stone-lantern-glow', light: { r: 58, color: 0xffb457, y: 15 } },
  { id: 'planter', name: 'Flower Planter', blurb: 'A wooden box that blooms with the season.', price: 140, frame: { spring: 'deco/planter-spring', summer: 'deco/planter-summer', fall: 'deco/planter-fall', winter: 'deco/planter-winter' } },
  { id: 'birdbath', name: 'Bird Bath', blurb: 'Stone, with a small blue visitor who never leaves.', price: 380, frame: 'deco/birdbath' },
  { id: 'gnome', name: 'Lantern Gnome', blurb: 'He has opinions about your weeding, and a lantern.', price: 220, frame: 'deco/gnome', glow: 'deco/gnome-glow', light: { r: 30, color: 0xffb457, y: 6 } },
];

export const decorItemId = (d: DecorDef): string => `deco-${d.id}`;
/** The look of a placed decoration, by the number saved with it. */
export const decorAt = (v: number): DecorDef | undefined => DECOR[v];
export const decorIndexOf = (itemId: string): number => DECOR.findIndex((d) => decorItemId(d) === itemId);
export const frameOf = (d: DecorDef, season: Season): string => (typeof d.frame === 'string' ? d.frame : d.frame[season]);
/** What the garden tab sells, cheapest first. */
export const GARDEN_STOCK: readonly string[] = DECOR.slice().sort((a, b) => a.price - b.price).map(decorItemId);
