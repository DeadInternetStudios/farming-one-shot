import { describe, expect, it } from 'vitest';
import { PressQueue } from '../src/game/pressqueue';

const spot = (x: number) => ({ x, y: 20 });

describe('presses made during a swing', () => {
  it('are made in the order they came, one per swing', () => {
    const q = new PressQueue<{ x: number; y: number }>();
    q.push(spot(20), 0);
    q.push(spot(21), 30);
    q.push(spot(22), 60);
    expect(q.next(500)?.at).toEqual(spot(20));
    expect(q.next(1000)?.at).toEqual(spot(21));
    expect(q.next(1500)?.at).toEqual(spot(22));
    expect(q.next(2000)).toBeNull();
  });

  it('keep three and let a fourth go, so a held button cannot bank a minute of work', () => {
    const q = new PressQueue<number>();
    for (let i = 0; i < 10; i += 1) q.push(i, 0);
    expect(q.size).toBe(3);
    expect([q.next(0)?.at, q.next(0)?.at, q.next(0)?.at, q.next(0)]).toEqual([0, 1, 2, null]);
  });

  it('are let go once they have waited 1.5 seconds, and the fresh ones behind them still count', () => {
    const q = new PressQueue<number>();
    q.push(1, 0);
    q.push(2, 1000);
    expect(q.next(1500)?.at).toBe(1);
    q.push(3, 1600);
    expect(q.next(2600)?.at).toBe(3);
    q.push(4, 0);
    q.push(5, 5000);
    expect(q.next(5001)?.at).toBe(5);
    expect(q.next(5002)).toBeNull();
  });

  it('can be aimed at "in front of me", which is a press with no tile', () => {
    const q = new PressQueue<{ x: number; y: number }>();
    q.push(undefined, 0);
    expect(q.next(10)).toEqual({ at: undefined });
  });

  it('are thrown away together when the game pauses', () => {
    const q = new PressQueue<number>();
    q.push(1, 0);
    q.push(2, 0);
    q.clear();
    expect(q.next(1)).toBeNull();
  });
});
