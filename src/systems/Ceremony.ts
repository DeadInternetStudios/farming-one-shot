import Phaser from 'phaser';
import { session } from '../game/session';
import { settings } from '../game/settings';
import { DEPTH } from '../world/MapView';
import type { Fx } from './Fx';

export interface ShrineStage {
  /** Where each lantern hangs, left to right, in world pixels. */
  lanterns: readonly { x: number; y: number }[];
  /** Where the camera looks while it happens. */
  centre: { x: number; y: number };
  setLit(n: number): void;
  look(at: { x: number; y: number } | null): void;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** A ring of light that opens from the lantern and fades as it spreads. */
function bloom(scene: Phaser.Scene, x: number, y: number, tint: number, from: number, to: number, ms: number, alpha: number): void {
  const g = scene.add.image(x, y, 'atlas', 'fx/glow-128').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow + 100).setScale(from).setAlpha(alpha);
  scene.tweens.add({ targets: g, scale: to, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
}

/**
 * A lantern lighting is the reward the whole game leans on, so it gets a moment of its own. The pop-up has closed, the world holds
 * still, the camera finds the shrine, and each new lantern comes on in turn with a bloom of gold.
 * The caller shows the shrine as it was until now, so the first light happens in front of the player.
 */
export function lightLanterns(scene: Phaser.Scene, fx: Fx, stage: ShrineStage, from: number, to: number): void {
  if (to <= from || stage.lanterns.length === 0) {
    stage.setLit(to);
    return;
  }
  session.hold();
  stage.look(stage.centre);
  const calm = settings.calm;
  const lead = calm ? 300 : 650;
  const gap = calm ? 500 : 950;
  for (let k = from; k < to; k++) {
    scene.time.delayedCall(lead + (k - from) * gap, () => {
      const at = stage.lanterns[k] ?? stage.lanterns[0];
      if (!at) return;
      stage.setLit(k + 1);
      session.events.emit('sfx', 'lantern');
      bloom(scene, at.x, at.y, 0xffd27a, 0.3, calm ? 2.2 : 3.6, calm ? 700 : 1100, calm ? 0.6 : 0.95);
      bloom(scene, at.x, at.y, 0xfff3c8, 0.2, calm ? 1.2 : 1.8, 650, 1);
      if (calm) return;
      for (let i = 0; i < 6; i++) scene.time.delayedCall(i * 70, () => fx.sparkle(at.x + rnd(-14, 14), at.y + rnd(-18, 8)));
    });
  }
  scene.time.delayedCall(lead + (to - from - 1) * gap + (calm ? 700 : 1300), () => {
    stage.look(null);
    session.release();
  });
}
