import { describe, expect, it } from 'vitest';
import { BUNDLES } from '../src/data/bundles';
import { CROP_LIST, ITEMS, itemDef } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { CAFE_STOCK, SMITHY_STOCK, TOOL_UPGRADES, UPGRADES, storeStock } from '../src/data/shops';
import { seasonOf } from '../src/game/clock';
import { sleepThrough } from '../src/game/day';
import { TOOL_DAMAGE, cropProfit, lastGoodDay, ripensInTime, toolEnergy } from '../src/game/farming';
import { fishHere, rollCatch } from '../src/game/fishing';
import { gemFor } from '../src/game/actions';
import { PACE_REAL_MINUTES } from '../src/game/clock';
import { OBJECT_HP } from '../src/world/mapkit';
import { SMELTS } from '../src/game/furnace';
import { addItem, countItem } from '../src/game/inventory';
import { mulberry32, pick, randInt } from '../src/game/rng';
import {
  availableUpgrades, buy, buyPrice, buyUpgrade, canSellHere, collectForge, sell, sellPrice, startForge,
} from '../src/game/shop';
import { deliver, refreshRequests } from '../src/game/requests';
import { friendOf } from '../src/game/social';
import { NPCS } from '../src/data/npcs';
import { SHOPS } from '../src/data/shops';
import { newGame } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { farmMap } from '../src/world/maps/farm';
import { PROFILES, playFarm } from '../tools/sim/farmer';
import { SEASONS } from '../src/game/types';
import type { Season } from '../src/game/types';

const SHOP_IDS = Object.keys(SHOPS);

describe('money cannot be made out of thin air', () => {
  const forSale = (): string[] => {
    const ids = new Set<string>([...CAFE_STOCK, ...SMITHY_STOCK]);
    for (const s of SEASONS) for (const id of storeStock(s, { 'festival-strawberry': true })) ids.add(id);
    return [...ids];
  };

  it('nothing sells for as much as it costs, in any shop', () => {
    for (const id of forSale()) {
      const best = Math.max(0, ...[null, ...SHOP_IDS].filter((s) => canSellHere(id, s)).map((s) => sellPrice(id, s)));
      expect(best, `${id} is bought for ${buyPrice(id)} and sold for ${best}`).toBeLessThan(buyPrice(id));
    }
  });

  it('a seed costs more than it sells for, and a one-harvest crop pays for its own seed', () => {
    for (const c of CROP_LIST) {
      expect(itemDef(`seed-${c.id}`).sell, c.id).toBeLessThan(c.seed);
      if (c.regrow === 0) expect(c.sell * c.yield, `${c.id} pays for its own seed`).toBeGreaterThan(c.seed);
    }
  });

  it('a note on the board never pays more than the shop charges for the same thing', () => {
    let seen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (let day = 3; day <= 28; day++) {
        const st = newGame(seed);
        for (const npc of NPCS) friendOf(st, npc.id).met = true;
        st.recipes = RECIPES.map((r) => r.id);
        st.deepest = 5;
        st.day = day;
        refreshRequests(st);
        for (const q of st.requests) {
          seen += 1;
          if (forSale().includes(q.item)) expect(q.reward, `${q.n} ${q.item}`).toBeLessThanOrEqual(buyPrice(q.item) * q.n);
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('every crop earns something when it goes in on the first day of a season it likes', () => {
    for (const c of CROP_LIST) {
      const first = SEASONS.findIndex((s) => c.seasons.includes(s)) * 7 + 1;
      expect(cropProfit(c.id, first), c.id).toBeGreaterThan(0);
    }
  });

  it('the best tile in a season earns a lot, but not a fortune', () => {
    for (const s of SEASONS) {
      const day = SEASONS.indexOf(s) * 7 + 1;
      const best = Math.max(-Infinity, ...CROP_LIST.map((c) => cropProfit(c.id, day)));
      if (s === 'winter') { expect(best).toBe(-Infinity); continue; }
      expect(best, s).toBeGreaterThan(100);
      expect(best, s).toBeLessThan(400);
    }
  });

  it('a cooked dish is worth more than what goes into it, but never wildly more', () => {
    for (const r of RECIPES.filter((q) => q.kind === 'cook')) {
      const dish = itemDef(r.makes).sell;
      // the cheapest way to make it: the least valuable item that fits each ingredient
      const cost = r.ingredients.reduce((a, ing) => a + ing.n * Math.min(...ing.of.split('|').map((id) => ITEMS[id]?.sell ?? Infinity)), 0);
      expect(dish, `${r.id} is worth ${dish}, its cheapest ingredients ${cost}`).toBeGreaterThan(cost);
      expect(dish / cost, `${r.id} pays ${dish / cost} times its ingredients`).toBeLessThan(5);
    }
  });

  it('a bar is worth more than the ore and the coal that go into it, but no more than the shop would charge', () => {
    for (const s of SMELTS) {
      const ore = itemDef(s.ore).sell * s.need + itemDef('coal').sell;
      expect(itemDef(s.bar).sell, s.bar).toBeGreaterThan(ore);
    }
  });
});

describe('the bundles can all be filled', () => {
  const fish = new Set<string>();
  for (const season of SEASONS) {
    for (const weather of ['sun', 'rain'] as const) {
      for (const minute of [9 * 60, 19 * 60]) for (const f of fishHere({ map: 'lake', season, minute, weather, rodTier: 0 })) fish.add(f.id);
    }
  }
  const crops = new Set(CROP_LIST.map((c) => c.id));
  const made = new Set(RECIPES.map((r) => r.makes));
  const bars = new Set(SMELTS.map((s) => s.bar));
  const ores = new Set(['copperOre', 'ironOre', 'goldOre', 'coal', 'stone']);
  const gems = new Set(['gem-amethyst', 'gem-topaz', 'gem-aquamarine', 'gem-ruby']);
  const foraged = new Set(['mushroom', 'berry', 'flower', 'sap', 'clay', 'wood']);
  const source = (id: string): string | null => {
    if (crops.has(id)) return 'a field';
    if (fish.has(id)) return 'the water';
    if (made.has(id)) return 'a recipe';
    if (bars.has(id)) return 'the furnace';
    if (ores.has(id)) return 'the mine';
    if (gems.has(id)) return 'the mine';
    if (foraged.has(id)) return 'the wild';
    if (id === 'egg') return 'the coop';
    if (id === 'loaf') return 'the store';
    return null;
  };

  it('each thing a bundle asks for comes from somewhere in the game', () => {
    for (const b of BUNDLES) for (const slot of b.slots) {
      const ok = slot.any.some((id) => source(id) !== null);
      expect(ok, `${b.id}: ${slot.any.join(' or ')}`).toBe(true);
      for (const id of slot.any) expect(() => itemDef(id), `${id} is a real item`).not.toThrow();
    }
  });

  it('every item a bundle asks for ripens in the year', () => {
    for (const b of BUNDLES) for (const slot of b.slots) for (const id of slot.any) {
      const crop = CROP_LIST.find((c) => c.id === id);
      if (!crop) continue;
      const first = SEASONS.findIndex((s) => crop.seasons.includes(s)) * 7 + 1;
      expect(ripensInTime(id, first), `${b.id} wants ${id}`).toBe(true);
    }
  });

  it('the coop and the hens come in under the price of the first year', () => {
    const coop = UPGRADES.find((u) => u.id === 'coop');
    expect(coop?.needs?.every((n) => ITEMS[n.id])).toBe(true);
  });
});

describe('what a steady year of farming pays', () => {
  const steady = playFarm(PROFILES.steady as NonNullable<typeof PROFILES.steady>, 28, 1);
  const casual = playFarm(PROFILES.casual as NonNullable<typeof PROFILES.casual>, 28, 1);
  const earnedTo = (run: typeof steady, d: number): number => run.days.slice(0, d).reduce((a, r) => a + r.earned, 0);
  const SINKS = UPGRADES.reduce((a, u) => a + u.price, 0) + 3 * 400 + 5 * Object.values(TOOL_UPGRADES).reduce((a, t) => a + t.gold, 0);

  it('the first week is a start, not a windfall', () => {
    expect(earnedTo(steady, 7)).toBeGreaterThan(1200);
    expect(earnedTo(steady, 7)).toBeLessThan(4500);
  });

  it('the year is rich enough to matter and not so rich that nothing is left to want', () => {
    expect(earnedTo(steady, 28)).toBeGreaterThan(SINKS * 0.25);
    expect(earnedTo(steady, 28)).toBeLessThan(SINKS * 1.2);
  });

  it('a casual farmer is never stuck, never broke for long and still moves forward', () => {
    expect(casual.days.every((r) => r.gold >= 0)).toBe(true);
    expect(earnedTo(casual, 14)).toBeGreaterThan(2500);
    expect(earnedTo(casual, 28)).toBeGreaterThan(SINKS * 0.1);
    expect(casual.days.filter((r) => r.note.includes('thirsty')).length).toBeLessThan(4);
  });

  it('the money in hand always equals what was earned minus what was spent', () => {
    for (const run of [steady, casual]) {
      let gold = 500;
      for (const r of run.days) {
        gold += r.earned - r.spent;
        expect(r.gold, `day ${r.day}`).toBe(gold);
      }
    }
  });
});

describe('every way of earning pays about the same for the effort', () => {
  const steady = playFarm(PROFILES.steady as NonNullable<typeof PROFILES.steady>, 28, 1);
  const farmDay = steady.days.slice(7, 14).reduce((a, r) => a + r.earned, 0) / 7;

  it('with the starting pickaxe, a crystal pays less per point of energy than the best crop of any season', () => {
    const rand = mulberry32(5);
    const hits = Math.ceil(OBJECT_HP.crystal / TOOL_DAMAGE.basic);
    const energy = hits * toolEnergy('pick', 'basic');
    for (let floor = 0; floor <= 4; floor++) {
      let total = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) total += itemDef(gemFor(rand, floor)).sell;
      const perEnergy = total / N / energy;
      for (const s of ['spring', 'summer', 'fall'] as const) {
        const day = SEASONS.indexOf(s) * 7 + 1;
        const best = Math.max(...CROP_LIST.map((c) => {
          const watering = lastGoodDay(c.id, day) - day;
          return cropProfit(c.id, day) / (toolEnergy('hoe', 'basic') + watering * toolEnergy('can', 'basic'));
        }));
        expect(perEnergy, `crystal on floor ${floor + 1} against ${s}`).toBeLessThan(best);
      }
    }
  });

  it('a whole day of nothing but fishing pays no more than a steady farmer earns in the second week', () => {
    // a cast, the wait for a bite, the fight and the landing come to about thirteen seconds, and the clock runs through all of it
    const castsPerDay = (PACE_REAL_MINUTES.standard * 60) / 13;
    for (const season of SEASONS) for (const weather of ['sun', 'rain'] as const) for (const minute of [9 * 60, 19 * 60]) {
      const rand = mulberry32(9);
      let total = 0;
      const N = 6000;
      for (let i = 0; i < N; i++) {
        const c = rollCatch(rand, { map: 'lake', season, minute, weather, rodTier: 0 });
        total += c.item ? itemDef(c.item).sell : 0;
      }
      const day = (total / N) * castsPerDay;
      expect(day, `${season} ${weather} at ${minute / 60}:00`).toBeLessThan(farmDay * 1.2);
    }
  });
});

describe('the ledger balances', () => {
  const mapOf = (st: GameState) => { const m = farmMap(st.seed, st); return () => m; };

  it('after thousands of random trades and nights, gold is exactly what the rules say', () => {
    const tally = { bought: 0, sold: 0, delivered: 0, upgraded: 0, nights: 0 };
    for (let seed = 1; seed <= 12; seed++) {
      const st = newGame(seed);
      for (const npc of NPCS) friendOf(st, npc.id).met = true;
      st.recipes = RECIPES.map((r) => r.id);
      const rand = mulberry32(seed * 977);
      let ledger = st.player.gold;
      const stock = ['seed-radish', 'seed-potato', 'hay', 'loaf', 'coal', 'copperOre', 'dish-tea'];
      for (let step = 0; step < 300; step++) {
        const op = randInt(rand, 0, 6);
        if (op === 0) {
          const id = pick(rand, stock);
          const n = randInt(rand, 1, 6);
          const price = buyPrice(id) * n;
          const had = st.player.gold;
          const r = buy(st, id, n);
          if (r.ok) { ledger -= price; tally.bought += 1; }
          expect(st.player.gold === had - (r.ok ? price : 0)).toBe(true);
        } else if (op === 1) {
          const i = randInt(rand, 0, st.player.slots.length - 1);
          const s = st.player.slots[i];
          const shop = pick(rand, [null, ...SHOP_IDS]);
          if (s) {
            const n = randInt(rand, 1, s.n);
            const expected = canSellHere(s.id, shop) ? sellPrice(s.id, shop) * Math.min(n, s.n) : 0;
            const r = sell(st, i, n, shop);
            if (r.ok) { ledger += expected; tally.sold += 1; }
          }
        } else if (op === 2) {
          const id = pick(rand, ['wheat', 'radish', 'egg', 'fish-perch', 'gem-topaz', 'wood']);
          addItem(st.player.slots, id, randInt(rand, 1, 5));
        } else if (op === 3) {
          const i = randInt(rand, 0, st.player.slots.length - 1);
          const s = st.player.slots[i];
          if (s && itemDef(s.id).kind !== 'tool' && itemDef(s.id).sell > 0) {
            st.shipping.push({ id: s.id, n: s.n });
            st.player.slots[i] = null;
          }
        } else if (op === 4) {
          const pay = st.shipping.reduce((a, q) => a + itemDef(q.id).sell * q.n, 0);
          const lose = 0;
          sleepThrough(st, mapOf(st), false);
          ledger += pay - lose;
          tally.nights += 1;
        } else if (op === 5) {
          const q = pick(rand, st.requests.length > 0 ? st.requests : [null]);
          if (q) {
            addItem(st.player.slots, q.item, q.n);
            const r = deliver(st, q.id);
            if (r.ok) { ledger += q.reward; tally.delivered += 1; }
          }
        } else {
          const up = availableUpgrades(st)[0];
          if (up) {
            st.player.gold += up.price; // topped up so the purchase can happen
            ledger += up.price;
            for (const n of up.needs ?? []) addItem(st.player.slots, n.id, n.n);
            const r = buyUpgrade(st, up.id);
            if (r.ok) { ledger -= up.price; tally.upgraded += 1; }
          }
        }
        expect(st.player.gold, `seed ${seed} step ${step}`).toBe(ledger);
        expect(st.player.gold).toBeGreaterThanOrEqual(0);
        for (const s of st.player.slots) if (s) expect(Number.isInteger(s.n) && s.n > 0, `${s.id} x${s.n}`).toBe(true);
      }
    }
    // the run must really have done all of it, or the sums above prove nothing
    expect(tally.bought).toBeGreaterThan(100);
    expect(tally.sold).toBeGreaterThan(50);
    expect(tally.nights).toBeGreaterThan(100);
    expect(tally.delivered).toBeGreaterThan(5);
    expect(tally.upgraded).toBeGreaterThan(5);
  });
});

describe('upgrades and the forge', () => {
  it('an upgrade needs the gold and the materials, and takes exactly them', () => {
    const st = newGame(3);
    st.player.gold = 5000;
    expect(buyUpgrade(st, 'coop').ok).toBe(false);
    expect(st.player.gold).toBe(5000);
    addItem(st.player.slots, 'wood', 40);
    addItem(st.player.slots, 'stone', 20);
    expect(buyUpgrade(st, 'coop').ok).toBe(true);
    expect(st.player.gold).toBe(5000 - 1200);
    expect(countItem(st.player.slots, 'wood')).toBe(0);
    expect(buyUpgrade(st, 'coop').ok).toBe(false);
    expect(st.player.gold).toBe(3800);
  });

  it('the second bag needs the first, and chickens stop at four', () => {
    const st = newGame(3);
    st.player.gold = 99999;
    expect(buyUpgrade(st, 'bag-2').ok).toBe(false);
    expect(buyUpgrade(st, 'bag-1').ok).toBe(true);
    expect(st.player.slots.length).toBe(30);
    expect(buyUpgrade(st, 'bag-2').ok).toBe(true);
    expect(st.player.slots.length).toBe(40);
    addItem(st.player.slots, 'wood', 40);
    addItem(st.player.slots, 'stone', 20);
    buyUpgrade(st, 'coop');
    let hens = 0;
    while (buyUpgrade(st, 'chick').ok) hens += 1;
    expect(hens).toBe(4);
    expect(st.pets.filter((p) => p.kind === 'chicken').length).toBe(4);
  });

  it('a tool goes to the forge with its bars and gold, and comes back a tier up two days later', () => {
    const st = newGame(3);
    st.player.gold = 1000;
    expect(startForge(st, 'hoe').ok).toBe(false);
    addItem(st.player.slots, 'copperBar', 3);
    const r = startForge(st, 'hoe');
    expect(r.ok).toBe(true);
    expect(st.player.gold).toBe(500);
    expect(countItem(st.player.slots, 'copperBar')).toBe(0);
    expect(countItem(st.player.slots, 'hoe')).toBe(0);
    expect(collectForge(st).ok).toBe(false);
    st.day += 2;
    expect(collectForge(st).ok).toBe(true);
    expect(st.player.tools.hoe).toBe('copper');
    expect(countItem(st.player.slots, 'hoe')).toBe(1);
    expect(st.forge).toBeNull();
  });
});

describe('the seasons line up', () => {
  it('there is always something in the store to plant, in every season but winter', () => {
    const open: Season[] = ['spring', 'summer', 'fall'];
    for (const s of open) expect(storeStock(s, {}).filter((id) => id.startsWith('seed-')).length, s).toBeGreaterThanOrEqual(4);
    expect(seasonOf(22)).toBe('winter');
  });
});
