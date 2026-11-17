import { describe, expect, it } from 'vitest';
import { DECOR, GARDEN_STOCK, decorAt, decorIndexOf, decorItemId, frameOf } from '../src/features/garden/catalog';
import { ITEMS, itemDef } from '../src/data/items';
import { isSolidTile, placeMachine, useTool } from '../src/game/actions';
import type { Ctx } from '../src/game/actions';
import { buy, buyPrice } from '../src/game/shop';
import { addItem, countItem } from '../src/game/inventory';
import { mulberry32 } from '../src/game/rng';
import { newGame } from '../src/game/state';
import { SEASONS, tileKey } from '../src/game/types';
import { FRAME_NAMES } from '../src/gen/art';
import { farmMap } from '../src/world/maps/farm';

const frames = new Set(FRAME_NAMES);

function setup(): { ctx: Ctx; x: number; y: number } {
  const st = newGame(4);
  const map = farmMap(4, st);
  const ctx: Ctx = { state: st, map, rand: mulberry32(4) };
  const l = st.locations.farm;
  if (!l) throw new Error('no farm');
  // an open spot with room around it
  for (let y = 3; y < map.h - 3; y++) for (let x = 3; x < map.w - 3; x++) {
    const free = [0, 1, -1].every((dx) => [0, 1, -1].every((dy) => {
      const i = (y + dy) * map.w + x + dx;
      return map.tillable[i] && !map.solid[i] && !map.overlay[i] && !l.objects[tileKey(x + dx, y + dy)] && !l.soil[tileKey(x + dx, y + dy)];
    }));
    if (free) return { ctx, x, y };
  }
  throw new Error('no open ground on the farm');
}

describe('the garden catalogue', () => {
  it('has a name, a price and real art for every piece', () => {
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
    for (const d of DECOR) {
      expect(d.price, d.id).toBeGreaterThanOrEqual(40);
      expect(d.price, d.id).toBeLessThanOrEqual(1500);
      for (const s of SEASONS) expect(frames.has(frameOf(d, s)), `${d.id} ${s}`).toBe(true);
      if (d.glow) expect(frames.has(d.glow), `${d.id} glow`).toBe(true);
      expect(frames.has(`item/${decorItemId(d)}`), `${d.id} icon`).toBe(true);
    }
  });

  it('keeps its order, because placed pieces are saved by position', () => {
    expect(DECOR.slice(0, 9).map((d) => d.id)).toEqual([
      'lantern-red', 'lantern-gold', 'lantern-teal', 'lantern-pink', 'lamp-post', 'stone-lantern', 'planter', 'birdbath', 'gnome',
    ]);
  });

  it('is sold, cheapest first, at the price on its tag', () => {
    expect(GARDEN_STOCK.length).toBe(DECOR.length);
    const prices = GARDEN_STOCK.map((id) => buyPrice(id));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const d of DECOR) {
      expect(itemDef(decorItemId(d)).kind).toBe('machine');
      expect(buyPrice(decorItemId(d))).toBe(d.price);
      expect(ITEMS[decorItemId(d)]?.sell).toBe(0);
    }
  });

  it('changes a planter with the seasons and leaves a lantern alone', () => {
    const planter = DECOR.find((d) => d.id === 'planter');
    const lantern = DECOR.find((d) => d.id === 'lantern-red');
    expect(new Set(SEASONS.map((s) => frameOf(planter as NonNullable<typeof planter>, s))).size).toBe(4);
    expect(new Set(SEASONS.map((s) => frameOf(lantern as NonNullable<typeof lantern>, s))).size).toBe(1);
  });
});

describe('putting garden pieces down', () => {
  it('buys a lantern, sets it on open ground, and takes it back with the axe', () => {
    const { ctx, x, y } = setup();
    const st = ctx.state;
    st.player.gold = 500;
    const id = decorItemId(DECOR[0] as NonNullable<(typeof DECOR)[0]>);
    expect(buy(st, id, 2).ok).toBe(true);
    expect(st.player.gold).toBe(500 - 2 * (DECOR[0]?.price ?? 0));
    const slot = st.player.slots.findIndex((s) => s?.id === id);
    const placed = placeMachine(ctx, id, slot, x, y);
    expect(placed.ok).toBe(true);
    expect(placed.changed).toEqual([tileKey(x, y)]);
    expect(st.locations.farm?.objects[tileKey(x, y)]).toMatchObject({ k: 'decor', v: decorIndexOf(id) });
    expect(countItem(st.player.slots, id)).toBe(1);
    expect(isSolidTile(ctx.map, st.locations.farm as NonNullable<typeof st.locations.farm>, x, y)).toBe(true);
    const back = useTool(ctx, 'axe', x, y, 'down');
    expect(back.ok).toBe(true);
    expect(st.locations.farm?.objects[tileKey(x, y)]).toBeUndefined();
    expect(countItem(st.player.slots, id)).toBe(2);
  });

  it('puts every piece down and picks every piece up as the same thing it was', () => {
    const { ctx, x, y } = setup();
    for (const d of DECOR) {
      const id = decorItemId(d);
      addItem(ctx.state.player.slots, id, 1);
      const slot = ctx.state.player.slots.findIndex((s) => s?.id === id);
      expect(placeMachine(ctx, id, slot, x, y).ok, d.id).toBe(true);
      expect(decorAt((ctx.state.locations.farm?.objects[tileKey(x, y)] as { v: number }).v)?.id).toBe(d.id);
      expect(useTool(ctx, 'pick', x, y, 'down').ok, d.id).toBe(true);
      expect(countItem(ctx.state.player.slots, id), d.id).toBe(1);
      expect(ctx.state.player.slots.some((s) => s?.id === id)).toBe(true);
      const at = ctx.state.player.slots.findIndex((s) => s?.id === id);
      ctx.state.player.slots[at] = null;
    }
  });

  it('will not build on soil, on another piece, or on water, and keeps the piece in your bag', () => {
    const { ctx, x, y } = setup();
    const st = ctx.state;
    const id = decorItemId(DECOR[1] as NonNullable<(typeof DECOR)[1]>);
    addItem(st.player.slots, id, 1);
    const slot = st.player.slots.findIndex((s) => s?.id === id);
    (st.locations.farm as NonNullable<typeof st.locations.farm>).soil[tileKey(x, y)] = { wet: false };
    expect(placeMachine(ctx, id, slot, x, y).ok).toBe(false);
    delete (st.locations.farm as NonNullable<typeof st.locations.farm>).soil[tileKey(x, y)];
    expect(placeMachine(ctx, id, slot, x, y).ok).toBe(true);
    addItem(st.player.slots, id, 1);
    const slot2 = st.player.slots.findIndex((s) => s?.id === id);
    expect(placeMachine(ctx, id, slot2, x, y).ok).toBe(false);
    expect(countItem(st.player.slots, id)).toBe(1);
    expect(placeMachine(ctx, id, slot2, 0, 0).ok).toBe(false);
  });

  it('will not take a piece back when the bag is full, and leaves it standing', () => {
    const { ctx, x, y } = setup();
    const st = ctx.state;
    const id = decorItemId(DECOR[2] as NonNullable<(typeof DECOR)[2]>);
    addItem(st.player.slots, id, 1);
    const slot = st.player.slots.findIndex((s) => s?.id === id);
    expect(placeMachine(ctx, id, slot, x, y).ok).toBe(true);
    const fillers = Object.keys(ITEMS).filter((i) => !i.startsWith('deco-'));
    expect(fillers.length).toBeGreaterThanOrEqual(st.player.slots.length);
    st.player.slots.forEach((_, i) => { st.player.slots[i] = { id: fillers[i] as string, n: 1 }; });
    expect(useTool(ctx, 'axe', x, y, 'down').ok).toBe(false);
    expect(st.locations.farm?.objects[tileKey(x, y)]?.k).toBe('decor');
  });
});
