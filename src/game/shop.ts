import { itemDef } from '../data/items';
import { SHOPS, TOOL_UPGRADES, UPGRADES } from '../data/shops';
import type { Upgrade } from '../data/shops';
import { addItem, canAdd, countItem, removeItem } from './inventory';
import type { GameState } from './state';
import type { Tier, ToolId } from './types';

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

/** Why this purchase cannot happen right now, or null when it can. */
export function buyBlock(state: GameState, id: string, n = 1): string | null {
  const price = buyPrice(id) * n;
  if (state.player.gold < price) return `You need ${price}g for that.`;
  if (!canAdd(state.player.slots, id, n)) return 'Your bag is full.';
  return null;
}

export function buy(state: GameState, id: string, n = 1): { ok: boolean; msg: string } {
  const why = buyBlock(state, id, n);
  if (why) return { ok: false, msg: why };
  state.player.gold -= buyPrice(id) * n;
  addItem(state.player.slots, id, n);
  return { ok: true, msg: `Bought ${n} ${itemDef(id).name}.` };
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

// ---------------------------------------------------------------- farm upgrades

export const MAX_HENS_BOUGHT = 4;

/** What Mirren still has to sell for the farm, cheapest first: each upgrade once, and chickens until the coop is full. */
export function availableUpgrades(st: GameState): Upgrade[] {
  return UPGRADES.filter((u) => {
    if (st.upgrades.includes(u.id)) return false;
    if (u.requires && !st.upgrades.includes(u.requires) && !st.flags[u.requires]) return false;
    if (u.id === 'chick' && st.pets.filter((p) => p.kind === 'chicken').length >= MAX_HENS_BOUGHT) return false;
    return true;
  }).sort((a, b) => a.price - b.price);
}

function applyUpgrade(st: GameState, id: string): string {
  if (id === 'chick') {
    const n = st.pets.filter((p) => p.kind === 'chicken').length;
    st.pets.push({ id: `hen-${n + 1}`, kind: 'chicken', name: ['Clover', 'Pepper', 'Biscuit', 'Daisy'][n] ?? 'Hen', fedDay: 0, happy: 50, since: st.day });
    return 'A chicken follows you home. It will be in the coop tomorrow.';
  }
  st.upgrades.push(id);
  if (id === 'bag-1' || id === 'bag-2') {
    for (let i = 0; i < 10; i++) st.player.slots.push(null);
    return 'A roomier bag. You have ten more slots.';
  }
  if (id === 'coop') {
    st.flags['coopDay'] = st.day;
    return 'Mirren will have the coop built by tomorrow morning.';
  }
  if (id === 'cat') {
    st.pets.push({ id: 'cat', kind: 'cat', name: 'Marmalade', fedDay: 0, happy: 50, since: st.day });
    return 'A farm cat will be waiting on your porch.';
  }
  return '';
}

/** Why this upgrade cannot be bought right now, or null when it can. */
export function upgradeBlock(st: GameState, id: string): string | null {
  const u = availableUpgrades(st).find((q) => q.id === id);
  if (!u) return 'That is not for sale.';
  if (st.player.gold < u.price) return `You need ${u.price}g for that.`;
  for (const n of u.needs ?? []) if (countItem(st.player.slots, n.id) < n.n) return `You need ${n.n} ${itemDef(n.id).name}.`;
  return null;
}

/** Pay for a farm upgrade. Nothing changes unless the gold and every material are there. */
export function buyUpgrade(st: GameState, id: string): { ok: boolean; msg: string } {
  const why = upgradeBlock(st, id);
  const u = availableUpgrades(st).find((q) => q.id === id);
  if (why || !u) return { ok: false, msg: why ?? 'That is not for sale.' };
  st.player.gold -= u.price;
  for (const n of u.needs ?? []) removeItem(st.player.slots, n.id, n.n);
  return { ok: true, msg: applyUpgrade(st, u.id) };
}

// ---------------------------------------------------------------- the forge

export const NEXT_TIER: Readonly<Partial<Record<Tier, Tier>>> = { basic: 'copper', copper: 'silver', silver: 'gold' };

/** Why this tool cannot go to the anvil right now, or null when it can. */
export function forgeBlock(st: GameState, tool: ToolId): string | null {
  if (st.forge) return 'The anvil is busy. Collect the other tool first.';
  const next = NEXT_TIER[st.player.tools[tool]];
  if (!next) return 'That is as good as it gets.';
  if (!st.player.slots.some((s) => s?.id === tool)) return 'You need to bring the tool.';
  const c = TOOL_UPGRADES[next as keyof typeof TOOL_UPGRADES];
  if (st.player.gold < c.gold) return `You need ${c.gold}g.`;
  if (countItem(st.player.slots, c.bar) < c.n) return `You need ${c.n} ${itemDef(c.bar).name}.`;
  return null;
}

/** Hand a tool to Bram for the next tier. The bars and gold go now and the tool comes back two days later. */
export function startForge(st: GameState, tool: ToolId): { ok: boolean; msg: string } {
  const why = forgeBlock(st, tool);
  const next = NEXT_TIER[st.player.tools[tool]];
  if (why || !next) return { ok: false, msg: why ?? 'That is as good as it gets.' };
  const c = TOOL_UPGRADES[next as keyof typeof TOOL_UPGRADES];
  removeItem(st.player.slots, c.bar, c.n);
  removeItem(st.player.slots, tool, 1);
  st.player.gold -= c.gold;
  st.forge = { tool, tier: next, readyDay: st.day + 2 };
  return { ok: true, msg: `Done. Back in two days, ready on day ${st.forge.readyDay}.` };
}

export function collectForge(st: GameState): { ok: boolean; msg: string } {
  if (!st.forge || st.forge.readyDay > st.day) return { ok: false, msg: 'Not done yet. Come back later.' };
  if (!canAdd(st.player.slots, st.forge.tool, 1)) return { ok: false, msg: 'Your bag is full.' };
  st.player.tools[st.forge.tool] = st.forge.tier;
  addItem(st.player.slots, st.forge.tool, 1);
  st.forge = null;
  return { ok: true, msg: 'Good as new. Better, actually.' };
}
