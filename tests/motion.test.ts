import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { settings } from '../src/game/settings';
import { easeOut, reveal, shake } from '../src/ui/motion';

interface Counter {
  duration: number;
  onUpdate: (t: { getValue: () => number }) => void;
  onComplete: () => void;
}

/** A scene that only knows how to run one counter by hand, so the test decides what time it is. */
function fakeScene() {
  const made: Counter[] = [];
  const scene = { tweens: { addCounter: (c: Counter) => (made.push(c), { stop: () => undefined }) } } as unknown as Phaser.Scene;
  return {
    scene,
    made,
    at: (k: number) => (made[0] as Counter).onUpdate({ getValue: () => k }),
    done: () => (made[0] as Counter).onComplete(),
  };
}

function part(alpha = 1, y = 10, w = 40) {
  return {
    alpha,
    y,
    displayWidth: w,
    active: true,
    setAlpha(a: number) {
      this.alpha = a;
      return this;
    },
  };
}

const asObjects = (...p: ReturnType<typeof part>[]): Phaser.GameObjects.GameObject[] => p as unknown as Phaser.GameObjects.GameObject[];

describe('interface motion', () => {
  let calm = false;
  beforeEach(() => {
    calm = settings.calm;
    settings.calm = false;
  });
  afterEach(() => {
    settings.calm = calm;
  });

  it('starts clear and low, passes through the middle, and ends exactly where each object began', () => {
    const f = fakeScene();
    const a = part(1, 20);
    const b = part(0.5, 30);
    reveal(f.scene, asObjects(a, b), { rise: 4 });
    expect([a.alpha, a.y, b.alpha, b.y]).toEqual([0, 24, 0, 34]);
    f.at(0.5);
    expect([a.alpha, a.y, b.alpha, b.y]).toEqual([0.5, 22, 0.25, 32]);
    f.at(1);
    f.done();
    expect([a.alpha, a.y, b.alpha, b.y]).toEqual([1, 20, 0.5, 30]);
  });

  it('fades a screen-wide dimmer without moving it', () => {
    const f = fakeScene();
    const dim = part(0.6, 0, 480);
    const panel = part(1, 40, 200);
    reveal(f.scene, asObjects(dim, panel), { rise: 5, skipWide: 480 });
    f.at(0.2);
    expect(dim.y).toBe(0);
    expect(panel.y).toBe(44);
    expect(dim.alpha).toBeCloseTo(0.12);
  });

  it('lets go of an object that something else changes mid-fade, so a repainted list keeps its new look', () => {
    const f = fakeScene();
    const row = part(0, 10);
    const other = part(1, 10);
    reveal(f.scene, asObjects(row, other), {});
    f.at(0.4);
    row.setAlpha(0.5);
    f.at(0.8);
    f.done();
    expect(row.alpha).toBe(0.5);
    expect(other.alpha).toBe(1);
  });

  it('still fades in a picture that something moves every frame, so the fish on its line is not left clear', () => {
    const f = fakeScene();
    const fish = part(1, 50);
    reveal(f.scene, asObjects(fish), { rise: 5 });
    expect(fish.alpha).toBe(0);
    for (const k of [0.1, 0.3, 0.6]) {
      fish.y = 70 + k * 10;
      f.at(k);
      expect(fish.y).toBe(70 + k * 10);
    }
    expect(fish.alpha).toBeGreaterThan(0.5);
    f.at(1);
    f.done();
    expect(fish.alpha).toBe(1);
  });

  it('leaves everything in place when calm motion is on', () => {
    settings.calm = true;
    const f = fakeScene();
    const a = part(1, 20);
    reveal(f.scene, asObjects(a), { rise: 5 });
    expect(f.made).toHaveLength(0);
    expect([a.alpha, a.y]).toEqual([1, 20]);
  });

  it('settles at once when stopped', () => {
    const f = fakeScene();
    const a = part(1, 20);
    const m = reveal(f.scene, asObjects(a), { rise: 5 });
    f.at(0.3);
    m.stop();
    expect([a.alpha, a.y]).toEqual([1, 20]);
  });

  it('a refused button shakes and then sits back at rest', () => {
    const f = fakeScene();
    const seen: number[] = [];
    shake(f.scene, (dx) => seen.push(dx));
    for (const k of [0.1, 0.3, 0.6, 0.9]) f.at(k);
    f.done();
    expect(seen.some((dx) => dx !== 0)).toBe(true);
    expect(Math.max(...seen.map(Math.abs))).toBeLessThanOrEqual(2);
    expect(seen.at(-1)).toBe(0);
  });

  it('eases out from rest to rest', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(2)).toBe(1);
  });
});
