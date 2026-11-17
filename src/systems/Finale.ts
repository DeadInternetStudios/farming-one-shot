import Phaser from 'phaser';
import { session } from '../game/session';
import { watchKey } from './keys';

/** Above the night overlay, so every light stays bright. */
const TOP = 9200;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;

const PAPER = ['lantern/gold', 'lantern/gold', 'lantern/pink', 'lantern/red'] as const;
const PAPER_GLOW: Readonly<Record<string, number>> = { 'lantern/gold': 0xffc95e, 'lantern/pink': 0xff9ab8, 'lantern/red': 0xff7a5e };
const BURSTS = [0xffd36b, 0xff8fb1, 0x8fe3ff, 0xb9ff9a, 0xffa86b, 0xd6a8ff] as const;

export interface FinaleStage {
  /** Where the shrine lanterns hang, left to right, in world pixels. */
  lanterns: readonly { x: number; y: number }[];
  /** The middle of the green, where the paper lanterns lift off. */
  centre: { x: number; y: number };
  /** The patch of sky in view where the fireworks go off, and how far either side of it they may stray. */
  sky: { x: number; y: number; spread: number };
  setLit(n: number): void;
}

/**
 * The end of the first year: the shrine lights lantern by lantern, paper lanterns lift off the green,
 * and when all of them shine the sky fills with fireworks. Any key or tap, after a moment, skips to the end.
 */
export class Finale {
  private timers: Phaser.Time.TimerEvent[] = [];
  private things: Phaser.GameObjects.GameObject[] = [];
  private finished = false;
  private off: (() => void) | null = null;

  constructor(private scene: Phaser.Scene) {}

  play(lit: number, stage: FinaleStage, done: () => void): void {
    const STEP = 750;
    let t = 900;
    for (let i = 0; i < lit; i++) {
      const at = stage.lanterns[i];
      this.after(t + i * STEP, () => {
        stage.setLit(i + 1);
        session.events.emit('sfx', 'lantern');
        if (at) this.flare(at.x, at.y);
      });
    }
    t += lit * STEP + 600;
    this.after(t, () => this.release(stage, lit));
    const grand = lit >= stage.lanterns.length;
    if (grand) {
      this.after(t + 500, () => session.events.emit('sfx', 'fanfare'));
      for (let k = 0; k < 8; k++) this.after(t + 1300 + k * 850, () => this.firework(stage.sky.x + rnd(-stage.sky.spread, stage.sky.spread), stage.sky.y + rnd(-22, 22)));
    }
    this.after(t + (grand ? 9800 : 7500), () => this.finish(done));

    const born = this.scene.time.now;
    const skip = (): void => {
      if (this.scene.time.now - born < 2500) return;
      stage.setLit(lit);
      this.finish(done);
    };
    this.scene.input.on('pointerdown', skip);
    const stopKey = watchKey(this.scene, 'keydown', skip);
    this.off = () => {
      this.scene.input.off('pointerdown', skip);
      stopKey();
    };
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push(this.scene.time.delayedCall(ms, () => { if (!this.finished) fn(); }));
  }

  private finish(done: () => void): void {
    if (this.finished) return;
    this.finished = true;
    this.off?.();
    for (const t of this.timers) t.remove();
    this.timers = [];
    for (const o of this.things) {
      if (!o.active) continue;
      this.scene.tweens.killTweensOf(o);
      this.scene.tweens.add({ targets: o, alpha: 0, duration: 500, onComplete: () => o.destroy() });
    }
    this.things = [];
    done();
  }

  private glow(x: number, y: number, frame: string, tint: number, scale: number, alpha: number): Phaser.GameObjects.Image {
    const g = this.scene.add.image(x, y, 'atlas', frame).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP).setScale(scale).setAlpha(alpha);
    this.things.push(g);
    return g;
  }

  /** A shrine lantern wakes: a pulse of gold and a few sparks. */
  private flare(x: number, y: number): void {
    const g = this.glow(x, y, 'fx/glow-128', 0xffc95e, 0.25, 0.9);
    this.scene.tweens.add({ targets: g, scale: 1.1, alpha: 0, duration: 800, ease: 'quad.out', onComplete: () => g.destroy() });
    for (let k = 0; k < 7; k++) {
      const s = this.scene.add.image(x, y, 'atlas', `fx/sparkle-gold/${k % 5}`).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 1);
      this.things.push(s);
      const a = rnd(0, Math.PI * 2);
      const d = rnd(10, 28);
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 10, alpha: 0, duration: rnd(500, 850), ease: 'quad.out',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** Paper lanterns lift off the green a few at a time, then a crowd of them. */
  private release(stage: FinaleStage, lit: number): void {
    const n = 12 + lit * 5;
    const span = 6500;
    for (let k = 0; k < n; k++) this.after(k * (span / n) + rnd(0, 120), () => this.paper(stage.centre.x + rnd(-170, 170), stage.centre.y + rnd(-10, 64)));
  }

  private paper(x: number, y: number): void {
    const frame = pick(PAPER);
    const halo = this.glow(x, y, 'fx/glow-48', PAPER_GLOW[frame] ?? 0xffc95e, 0.6, 0);
    const body = this.scene.add.image(x, y, 'title', frame).setDepth(TOP + 1).setAlpha(0);
    this.things.push(body);
    const rise = rnd(180, 270);
    const sway = rnd(5, 10);
    const phase = rnd(0, Math.PI * 2);
    const p = { v: 0 };
    this.scene.tweens.add({
      targets: p, v: 1, duration: rnd(6500, 9500), ease: 'sine.inOut',
      onUpdate: () => {
        const px = x + Math.sin(p.v * 5 + phase) * sway;
        const py = y - rise * p.v;
        const a = Math.min(1, p.v * 8) * Math.min(1, (1 - p.v) * 3);
        body.setPosition(px, py).setAlpha(a);
        halo.setPosition(px, py).setAlpha(a * (0.55 + Math.sin(p.v * 30 + phase) * 0.12));
      },
      onComplete: () => { body.destroy(); halo.destroy(); },
    });
  }

  private firework(x: number, y: number): void {
    session.events.emit('sfx', 'firework');
    const color = pick(BURSTS);
    const core = this.glow(x, y, 'fx/glow-128', color, 0.3, 1);
    this.scene.tweens.add({ targets: core, scale: 2.1, alpha: 0, duration: 520, ease: 'quad.out', onComplete: () => core.destroy() });
    const rings = [{ count: 40, reach: [56, 88], time: [1200, 1600] }, { count: 24, reach: [26, 44], time: [900, 1200] }] as const;
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const a = (i / ring.count) * Math.PI * 2 + rnd(-0.1, 0.1);
        const d = rnd(ring.reach[0], ring.reach[1]);
        const star = this.scene.add.image(x, y, 'atlas', `fx/sparkle${i % 3 === 0 ? '-gold' : ''}/${i % 5}`).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 1).setScale(2);
        const dot = this.glow(x, y, 'fx/glow-48', color, 0.4, 0.6);
        this.things.push(star);
        const p = { v: 0 };
        this.scene.tweens.add({
          targets: p, v: 1, duration: rnd(ring.time[0], ring.time[1]), ease: 'cubic.out',
          onUpdate: () => {
            const px = x + Math.cos(a) * d * p.v;
            const py = y + Math.sin(a) * d * p.v + 26 * p.v * p.v;
            const fade = 1 - p.v ** 3;
            const twinkle = 0.8 + Math.sin(p.v * 40 + i) * 0.2;
            star.setPosition(px, py).setAlpha(fade * twinkle).setScale(2 - p.v * 0.9);
            dot.setPosition(px, py).setAlpha(fade * 0.6).setScale(0.4 * (1 - p.v * 0.5));
          },
          onComplete: () => { star.destroy(); dot.destroy(); },
        });
      }
    }
  }
}
