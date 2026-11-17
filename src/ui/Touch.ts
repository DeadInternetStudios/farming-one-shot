import Phaser from 'phaser';
import { session } from '../game/session';
import type { Layout } from '../display';

const RADIUS = 22;

/** A floating stick on the left half of the screen, plus an action button at the bottom right. */
export class Touch {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private pointerId = -1;
  private origin = new Phaser.Math.Vector2();
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(private scene: Phaser.Scene, l: Layout) {
    const zone = scene.add.zone(0, 0, Math.floor(l.uiW * 0.55), l.uiH - 30).setOrigin(0, 0).setInteractive().setDepth(1);
    this.objs.push(zone);
    this.base = scene.add.image(0, 0, 'atlas', 'ui/stick-base').setVisible(false).setDepth(5).setAlpha(0.85);
    this.knob = scene.add.image(0, 0, 'atlas', 'ui/stick-knob').setVisible(false).setDepth(6);
    this.objs.push(this.base, this.knob);

    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== -1) return;
      this.pointerId = p.id;
      this.origin.set(p.x / l.uiZoom, p.y / l.uiZoom);
      this.base.setPosition(this.origin.x, this.origin.y).setVisible(true);
      this.knob.setPosition(this.origin.x, this.origin.y).setVisible(true);
      session.events.emit('virtual-move', 0, 0);
    });
    this.onMove = (p) => {
      if (p.id !== this.pointerId) return;
      const dx = p.x / l.uiZoom - this.origin.x;
      const dy = p.y / l.uiZoom - this.origin.y;
      const d = Math.hypot(dx, dy);
      const k = d > RADIUS ? RADIUS / d : 1;
      this.knob.setPosition(this.origin.x + dx * k, this.origin.y + dy * k);
      const m = Math.min(1, d / RADIUS);
      session.events.emit('virtual-move', d < 4 ? 0 : (dx / d) * m, d < 4 ? 0 : (dy / d) * m);
    };
    this.onUp = (p) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = -1;
      this.base.setVisible(false);
      this.knob.setVisible(false);
      session.events.emit('virtual-move', 0, 0);
    };
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);

    const btn = scene.add.image(l.uiW - 26, l.uiH - 52, 'atlas', 'ui/action-btn').setDepth(5).setInteractive();
    btn.on('pointerdown', () => {
      btn.setScale(0.92);
      session.events.emit('virtual-action');
    });
    btn.on('pointerup', () => btn.setScale(1));
    btn.on('pointerout', () => btn.setScale(1));
    this.objs.push(btn);
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    for (const o of this.objs) o.destroy();
    this.objs = [];
    session.events.emit('virtual-move', 0, 0);
  }
}
