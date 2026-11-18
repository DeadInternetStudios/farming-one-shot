import Phaser from 'phaser';
import { session } from '../game/session';
import { settings } from '../game/settings';
import type { Layout } from '../display';
import { teaching } from '../game/teach';
import { COL, iconFor, label, nine } from './kit';

const RADIUS = 22;

/** A floating stick on the left half of the screen, plus an action button at the bottom right. Left-handed play swaps the sides. */
export class Touch {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private base: Phaser.GameObjects.Image;
  private knob: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  /** The hints that retire once their thing has been done: a faint stick, a glow on the action button, a name for the bag button. */
  private ghost: Phaser.GameObjects.GameObject[] = [];
  private halo: Phaser.GameObjects.Image;
  private bagTag: Phaser.GameObjects.GameObject[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  private shown = '';
  private pointerId = -1;
  private origin = new Phaser.Math.Vector2();
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(private scene: Phaser.Scene, l: Layout) {
    const lefty = settings.lefty;
    const zoneW = Math.floor(l.uiW * 0.55);
    const zone = scene.add.zone(lefty ? l.uiW - zoneW : 0, 0, zoneW, l.uiH - 30).setOrigin(0, 0).setInteractive().setDepth(1);
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

    // the button shows what is in your hand, so you know what a press will do
    const bx = lefty ? 26 : l.uiW - 26;
    const by = l.uiH - 52;
    const btn = scene.add.image(bx, by, 'atlas', 'ui/action-btn').setDepth(5).setInteractive();
    this.icon = scene.add.image(bx, by, 'atlas', 'ui/hand').setDepth(6);
    const press = (v: number): void => { btn.setScale(v); this.icon.setScale(v); };
    btn.on('pointerdown', () => {
      press(0.92);
      session.events.emit('virtual-action');
    });
    btn.on('pointerup', () => press(1));
    btn.on('pointerout', () => press(1));
    this.objs.push(btn, this.icon);

    // the menu: the bag button over the action button, so the other thumb-reach tool is never far from the hand that uses things
    const my = by - 36;
    const menu = scene.add.image(bx, my, 'atlas', 'ui/menu-btn').setDepth(5);
    const reach = Math.max(14, Math.ceil(22 / (l.uiZoom / l.dpr)));
    menu.setInteractive({ hitArea: new Phaser.Geom.Circle(14, 14, reach), hitAreaCallback: Phaser.Geom.Circle.Contains });
    menu.on('pointerdown', () => {
      menu.setScale(0.92);
      session.events.emit('virtual-menu');
    });
    menu.on('pointerup', () => menu.setScale(1));
    menu.on('pointerout', () => menu.setScale(1));
    this.objs.push(menu);

    this.halo = scene.add.image(bx, by, 'atlas', 'fx/glow-48').setDepth(4).setTint(0xfff2b0).setAlpha(0).setScale(0.9);
    this.objs.push(this.halo);
    this.teach(l, bx, by, my, lefty);

    scene.events.on('update', this.sync, this);
    this.sync();
  }

  /** The first-minute hints for a hand on glass: where to drag, what to press, and what the bag button is. They go as each thing is done. */
  private teach(l: Layout, bx: number, by: number, my: number, lefty: boolean): void {
    const scene = this.scene;
    const gx = lefty ? l.uiW - 56 : 56;
    const gy = Math.max(84, l.uiH - 92);
    const base = scene.add.image(gx, gy, 'atlas', 'ui/stick-base').setDepth(4).setAlpha(0.32);
    const knob = scene.add.image(gx, gy, 'atlas', 'ui/stick-knob').setDepth(4).setAlpha(0.5);
    const tip = label(scene, gx, gy + 34, 'Drag to walk', { origin: [0.5, 0], outline: true });
    tip.setDepth(4);
    this.ghost.push(base, knob, tip);

    const w = 38;
    const tx = lefty ? bx + 20 : bx - 20 - w;
    const tagBg = nine(scene, 'dark', tx, my - 7, w, 15).setDepth(5);
    const tag = label(scene, tx + Math.floor(w / 2), my - 3, 'Bag', { origin: [0.5, 0], tint: COL.gold });
    tag.setDepth(6);
    this.bagTag.push(tagBg, tag);
    this.objs.push(...this.ghost, ...this.bagTag);

    if (!settings.calm) {
      this.tweens.push(scene.tweens.add({ targets: knob, x: gx + 12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      this.tweens.push(scene.tweens.add({ targets: this.halo, alpha: 0.75, scale: 1.15, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
  }

  private sync(): void {
    const st = session.state;
    const walk = teaching(st, 'walk');
    const use = teaching(st, 'use');
    const menu = teaching(st, 'menu');
    for (const g of this.ghost) (g as Phaser.GameObjects.Image).setVisible(walk);
    for (const g of this.bagTag) (g as Phaser.GameObjects.Image).setVisible(menu);
    if (!use) this.halo.setVisible(false);
    else if (settings.calm) this.halo.setAlpha(0.45).setVisible(true);
    const held = st.player.slots[st.player.selected];
    const frame = held ? iconFor(st, held.id) : 'ui/hand';
    if (frame === this.shown) return;
    this.shown = frame;
    this.icon.setFrame(frame);
  }

  destroy(): void {
    this.scene.events.off('update', this.sync, this);
    for (const t of this.tweens) t.remove();
    this.tweens = [];
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    for (const o of this.objs) o.destroy();
    this.objs = [];
    session.events.emit('virtual-move', 0, 0);
  }
}
