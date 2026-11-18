import type Phaser from 'phaser';
import { settings } from '../game/settings';

/** One easing and three lengths for everything in the interface that changes state, so all of it moves the same way. */
export const EASE = 'Cubic.easeOut';
export const MS = { quick: 150, base: 200, slow: 280 } as const;

/** The same curve as `EASE`, for things the interface moves by hand every frame instead of with a tween. */
export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

type Part = Phaser.GameObjects.GameObject & { alpha?: number; y?: number; displayWidth?: number; setAlpha?: (a: number) => unknown };

export interface Motion {
  stop(): void;
}

const NONE: Motion = { stop: () => undefined };

interface Moving {
  p: Part;
  /** Where it should end up. */
  alpha: number;
  y: number;
  lift: boolean;
  /** What this motion last set, so a change made by anything else is noticed and left alone. */
  seenAlpha: number;
  seenY: number;
}

/**
 * Fades the objects in from nothing, rising `rise` pixels as they settle. Each ends as clear and as high as it was
 * when this was called, and objects as wide as `skipWide` (a dimmer over the whole screen) fade without moving.
 * An object that something else changes while this runs is let go, so a list repainted mid-fade keeps its new look.
 * Nothing moves when calm motion is on.
 */
export function reveal(scene: Phaser.Scene, objs: readonly Phaser.GameObjects.GameObject[], o: { ms?: number; rise?: number; skipWide?: number } = {}): Motion {
  if (settings.calm || objs.length === 0) return NONE;
  const rise = o.rise ?? 0;
  const parts: (Moving | null)[] = (objs as readonly Part[])
    .filter((p) => typeof p.alpha === 'number' && typeof p.y === 'number')
    .map((p) => ({ p, alpha: p.alpha as number, y: p.y as number, lift: rise !== 0 && (p.displayWidth ?? 0) < (o.skipWide ?? Infinity), seenAlpha: p.alpha as number, seenY: p.y as number }));
  const set = (k: number): void => {
    parts.forEach((q, i) => {
      if (!q) return;
      if (!q.p.active || q.p.alpha !== q.seenAlpha || q.p.y !== q.seenY) { parts[i] = null; return; }
      q.p.setAlpha?.(q.alpha * k);
      if (q.lift) q.p.y = q.y + (1 - k) * rise;
      q.seenAlpha = q.p.alpha as number;
      q.seenY = q.p.y as number;
    });
  };
  set(0);
  const tween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: o.ms ?? MS.base,
    ease: EASE,
    onUpdate: (t) => set(t.getValue() ?? 1),
    onComplete: () => set(1),
  });
  return { stop: () => { tween.stop(); set(1); } };
}

/** A small nudge: the thing grows by `by` and settles back. For a number that just changed. */
export function pop(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, by = 0.25): void {
  if (settings.calm) return;
  scene.tweens.killTweensOf(target);
  scene.tweens.add({ targets: target, scale: 1 + by, duration: MS.quick / 2, yoyo: true, ease: EASE });
}

/** The "no" of a switched-off button: a quick side to side that dies away. `apply` moves whatever the button is made of. */
export function shake(scene: Phaser.Scene, apply: (dx: number) => void): void {
  if (settings.calm) return;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: MS.quick,
    onUpdate: (t) => { const k = t.getValue() ?? 1; apply(Math.round(Math.sin(k * Math.PI * 4) * 2 * (1 - k))); },
    onComplete: () => apply(0),
  });
}
