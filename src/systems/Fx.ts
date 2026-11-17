import Phaser from 'phaser';
import { PAL } from '../gen/art';
import type { FxEvent } from '../game/actions';
import { session } from '../game/session';

const FX_DEPTH = 8000;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** Short-lived world effects: dust, drops, chips, sparkles and items popping out of things. */
export class Fx {
  constructor(private scene: Phaser.Scene, private player: () => { x: number; y: number }) {}

  handle(e: FxEvent): void {
    const cx = e.x * 16 + 8;
    const cy = e.y * 16 + 8;
    switch (e.t) {
      case 'dust': return this.dust(cx, cy + 3);
      case 'drops': return this.drops(cx, cy);
      case 'chips': return this.chips(cx, cy, e.kind);
      case 'sparkle': return this.sparkle(cx, cy - 4);
      case 'splash': return this.splash(cx, cy);
      case 'pop': return this.pop(cx, cy, e.item, e.n);
      case 'shake': return;
    }
  }

  private frames(x: number, y: number, prefix: string, count: number, ms: number, depth = FX_DEPTH, alpha = 1): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, 'atlas', `${prefix}/0`).setDepth(depth).setAlpha(alpha);
    let i = 0;
    this.scene.time.addEvent({
      delay: ms, repeat: count - 2,
      callback: () => {
        i += 1;
        img.setFrame(`${prefix}/${i}`);
        if (i >= count - 1) this.scene.time.delayedCall(ms, () => img.destroy());
      },
    });
    return img;
  }

  dust(x: number, y: number): void {
    for (let k = 0; k < 3; k++) {
      const img = this.frames(x + rnd(-5, 5), y + rnd(-2, 3), 'fx/dust', 4, 70);
      this.scene.tweens.add({ targets: img, y: img.y - rnd(4, 9), x: img.x + rnd(-4, 4), duration: 300, ease: 'sine.out' });
    }
  }

  drops(x: number, y: number): void {
    for (let k = 0; k < 4; k++) {
      const d = this.scene.add.image(x + rnd(-5, 5), y - rnd(6, 12), 'atlas', 'fx/drop').setDepth(FX_DEPTH);
      this.scene.tweens.add({
        targets: d, y: d.y + rnd(8, 13), alpha: 0, duration: rnd(220, 340), delay: k * 40, ease: 'quad.in',
        onComplete: () => d.destroy(),
      });
    }
    const ring = this.frames(x, y + 4, 'fx/ripple', 3, 90, FX_DEPTH, 0.8);
    ring.setDepth(FX_DEPTH - 1);
  }

  chips(x: number, y: number, kind: 'wood' | 'stone' | 'leaf'): void {
    const cols = kind === 'wood' ? [PAL.wood[3], PAL.wood[4], PAL.wood[5]] : kind === 'stone' ? [PAL.stone[3], PAL.stone[4], PAL.stone[5]] : [PAL.leaf[3], PAL.leaf[4], PAL.grassSummer[4]];
    const n = kind === 'leaf' ? 6 : 7;
    for (let k = 0; k < n; k++) {
      const c = Phaser.Utils.Array.GetRandom(cols) as number;
      const size = kind === 'leaf' ? 2 : Math.random() < 0.5 ? 2 : 3;
      const p = this.scene.add.rectangle(x + rnd(-3, 3), y + rnd(-3, 3), size, size, c).setDepth(FX_DEPTH);
      const vx = rnd(-18, 18);
      const up = rnd(10, 22);
      this.scene.tweens.add({ targets: p, x: p.x + vx, duration: 420, ease: 'linear' });
      this.scene.tweens.add({
        targets: p, y: { value: p.y - up, duration: 180, ease: 'quad.out' }, alpha: { value: 0, delay: 250, duration: 220 },
        onComplete: () => p.destroy(),
      });
      this.scene.tweens.add({ targets: p, y: p.y + rnd(6, 14), delay: 180, duration: 240, ease: 'quad.in' });
    }
  }

  sparkle(x: number, y: number): void {
    for (let k = 0; k < 3; k++) {
      const img = this.frames(x + rnd(-6, 6), y + rnd(-7, 4), 'fx/sparkle-gold', 5, 70);
      img.setAlpha(0);
      this.scene.time.delayedCall(k * 70, () => img.setAlpha(1));
    }
  }

  splash(x: number, y: number): void {
    this.frames(x, y, 'fx/splash', 3, 80);
    this.frames(x, y + 3, 'fx/ripple', 3, 120, FX_DEPTH - 1);
  }

  /** An item hops out of the thing you worked on, then flies into the farmer's hands. */
  pop(x: number, y: number, item: string, n: number): void {
    const img = this.scene.add.image(x, y, 'atlas', `item/${item}`).setDepth(FX_DEPTH + 1).setScale(0.75);
    this.scene.tweens.add({ targets: img, y: y - 14, scale: 1, duration: 200, ease: 'quad.out' });
    this.scene.tweens.add({ targets: img, y: y - 4, delay: 200, duration: 130, ease: 'quad.in' });
    this.scene.time.delayedCall(420, () => {
      const p = this.player();
      this.scene.tweens.add({
        targets: img, x: p.x, y: p.y - 14, scale: 0.6, alpha: 0.2, duration: 260, ease: 'quad.in',
        onComplete: () => {
          img.destroy();
          session.events.emit('picked', item, n);
        },
      });
    });
  }

  /** Three little hearts drift up from a friend. */
  heart(x: number, y: number): void {
    for (let k = 0; k < 3; k++) {
      const h = this.scene.add.image(x + (k - 1) * 8, y, 'atlas', 'fx/heart').setDepth(FX_DEPTH + 2).setAlpha(0).setScale(0.8);
      this.scene.tweens.add({ targets: h, y: y - 14 - k * 4, scale: 1, duration: 700, delay: k * 110, ease: 'sine.out' });
      this.scene.tweens.add({ targets: h, alpha: { from: 0, to: 1 }, duration: 120, delay: k * 110 });
      this.scene.tweens.add({ targets: h, alpha: 0, duration: 300, delay: 480 + k * 110, onComplete: () => h.destroy() });
    }
  }

  floatText(x: number, y: number, text: string, font = 'hollow-o'): void {
    const t = this.scene.add.bitmapText(Math.round(x), Math.round(y), font, text).setOrigin(0.5, 1).setDepth(FX_DEPTH + 5);
    this.scene.tweens.add({ targets: t, y: y - 10, alpha: { value: 0, delay: 500, duration: 300 }, duration: 800, ease: 'sine.out', onComplete: () => t.destroy() });
  }
}
