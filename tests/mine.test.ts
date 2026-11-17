import { describe, expect, it } from 'vitest';
import { MINE_ENTRY, MINE_FLOORS, mineHole, mineMap } from '../src/world/maps/mine';
import type { MapDef } from '../src/world/mapkit';

/** Tiles you can walk to from the entry, ignoring things you could dig out of the way. */
function reach(map: MapDef): Set<number> {
  const seen = new Set<number>();
  const start = MINE_ENTRY.y * map.w + MINE_ENTRY.x;
  const queue = [start];
  seen.add(start);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const x = cur % map.w;
    const y = (cur - x) / map.w;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const ni = ny * map.w + nx;
      if (map.ground[ni] === 0 || map.solid[ni] || seen.has(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

describe('the mine', () => {
  it('builds the same floor for the same seed and day, and a new one the next day', () => {
    const a = mineMap(2, 77, 5);
    const b = mineMap(2, 77, 5);
    expect(Array.from(a.ground)).toEqual(Array.from(b.ground));
    expect(a.objects).toEqual(b.objects);
    const c = mineMap(2, 77, 6);
    expect(Array.from(c.ground)).not.toEqual(Array.from(a.ground));
  });

  it('always has a roomy cave with a way down that you can walk to', () => {
    for (const seed of [1, 42, 9001]) {
      for (let day = 1; day <= 28; day += 3) {
        for (let floor = 1; floor <= MINE_FLOORS; floor++) {
          const map = mineMap(floor, seed, day);
          const seen = reach(map);
          expect(seen.size, `floor ${floor} day ${day} seed ${seed}`).toBeGreaterThanOrEqual(250);
          const down = map.warps.find((w) => w.to === `mine-${floor + 1}`);
          if (floor === MINE_FLOORS) expect(down).toBeUndefined();
          else expect(down && seen.has(down.y * map.w + down.x), `hole on floor ${floor} day ${day}`).toBe(true);
          for (const o of map.objects) expect(map.ground[o.y * map.w + o.x]).not.toBe(0);
        }
      }
    }
  });

  it('lines the ladders up between floors', () => {
    for (let floor = 2; floor <= MINE_FLOORS; floor++) {
      const up = mineMap(floor, 5, 9).warps.find((w) => w.to === `mine-${floor - 1}`);
      const hole = mineHole(floor - 1, 5, 9);
      expect(up).toBeDefined();
      expect(hole).not.toBeNull();
      expect(up?.tx).toBe(hole?.x);
      expect(up?.ty).toBe((hole?.y ?? 0) + 1);
    }
  });

  it('puts richer ore deeper down', () => {
    const count = (floor: number, kind: string): number => {
      let n = 0;
      for (let day = 1; day <= 10; day++) n += mineMap(floor, 3, day).objects.filter((o) => o.k === kind).length;
      return n;
    };
    expect(count(1, 'iron')).toBe(0);
    expect(count(1, 'gold')).toBe(0);
    expect(count(5, 'gold')).toBeGreaterThan(0);
    expect(count(3, 'iron')).toBeGreaterThan(count(1, 'iron'));
    expect(count(5, 'crystal')).toBeGreaterThan(0);
  });
});
