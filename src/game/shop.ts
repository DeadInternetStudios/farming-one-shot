import { itemDef } from '../data/items';
import { SHOPS } from '../data/shops';
import { addItem, canAdd, removeItem } from './inventory';
import type { GameState } from './state';

export const buyPrice = (id: string): number => {
  const d = itemDef(id);
  return d.buy ?? Math.max(10, d.sell * 3);
};

/** What a shop will pay. The cafe pays extra for cooking; the smithy pays extra for metal. */
export function sellPrice(id: string, shop: string | null): number {
  const d = itemDef(id);
  let p = d.sell;
  if (shop === 'cafe' && (d.kind === 'food' || d.id.startsWith('dish-'))) p = Math.round(p * 1.2);
  if (shop === 'smithy' && /Ore|Bar|coal/.test(d.id)) p = Math.round(p * 1.15);
  return p;
}

export const canSellHere = (id: string, shop: string | null): boolean => {
  const d = itemDef(id);
  if (d.kind === 'tool' || d.kind === 'special' || d.kind === 'machine' || d.sell <= 0) return false;
  if (shop === 'smithy') return /Ore|Bar|coal/.test(d.id) || d.kind === 'gem';
  if (shop === 'cafe') return d.kind === 'food' || d.kind === 'goods' || d.kind === 'forage' || d.kind === 'crop' || d.kind === 'fish';
  return true;
};

export function buy(state: GameState, id: string, n = 1): { ok: boolean; msg: string } {
  const price = buyPrice(id) * n;
  const d = itemDef(id);
  if (state.player.gold < price) return { ok: false, msg: `You need ${price}g for that.` };
  if (!canAdd(state.player.slots, id, n)) return { ok: false, msg: 'Your bag is full.' };
  state.player.gold -= price;
  addItem(state.player.slots, id, n);
  return { ok: true, msg: `Bought ${n} ${d.name}.` };
}

export function sell(state: GameState, slot: number, n: number, shop: string | null): { ok: boolean; gold: number; msg: string } {
  const s = state.player.slots[slot];
  if (!s) return { ok: false, gold: 0, msg: '' };
  if (!canSellHere(s.id, shop)) return { ok: false, gold: 0, msg: "They don't buy that here." };
  const count = Math.min(n, s.n);
  const gold = sellPrice(s.id, shop) * count;
  const id = s.id;
  const idx = state.player.slots.indexOf(s);
  s.n -= count;
  if (s.n <= 0) state.player.slots[idx] = null;
  state.player.gold += gold;
  state.stats.earned += gold;
  void id;
  return { ok: true, gold, msg: `Sold ${count} ${itemDef(s.id).name} for ${gold}g.` };
}

export const isOpen = (shop: string, minute: number): boolean => {
  const s = SHOPS[shop];
  return !!s && minute >= s.open && minute < s.close;
};

export { removeItem };
