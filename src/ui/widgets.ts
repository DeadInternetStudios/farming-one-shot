import Phaser from 'phaser';
import { PAL } from '../gen/art';
import type { Layout } from '../display';
import { COL, button, label, nine } from './kit';
import type { Button } from './kit';

export type Obj = Phaser.GameObjects.GameObject;
type Depthed = Obj & { setDepth: (d: number) => unknown };

/** Owns a set of display objects so a whole screen can be thrown away at once. */
export class Bag {
  readonly objs: Obj[] = [];
  readonly buttons: Button[] = [];
  constructor(readonly scene: Phaser.Scene, public depth: number) {}

  add<T extends Obj>(o: T, bump = 0): T {
    (o as unknown as Depthed).setDepth(this.depth + bump);
    this.objs.push(o);
    return o;
  }

  text(x: number, y: number, s: string, o: Parameters<typeof label>[4] = {}): Phaser.GameObjects.BitmapText {
    return this.add(label(this.scene, x, y, s, { tint: COL.ink, ...o }), 2);
  }

  img(x: number, y: number, frame: string, origin: [number, number] = [0.5, 0.5], bump = 2): Phaser.GameObjects.Image {
    return this.add(this.scene.add.image(Math.round(x), Math.round(y), 'atlas', frame).setOrigin(origin[0], origin[1]), bump);
  }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1, bump = 2): Phaser.GameObjects.Rectangle {
    return this.add(this.scene.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0), bump);
  }

  panel(x: number, y: number, w: number, h: number, kind: 'parchment' | 'dark' = 'parchment', bump = 1): Phaser.GameObjects.NineSlice {
    return this.add(nine(this.scene, kind, x, y, w, h), bump);
  }

  btn(x: number, y: number, w: number, text: string, kind: 'leaf' | 'wood' | 'berry' | 'sky', fn: () => void, h = 17, icon?: string, off = false): Button {
    const b = button(this.scene, x, y, w, h, text, kind, fn, icon, off);
    for (const p of b.parts) (p as unknown as Depthed).setDepth(this.depth + 4);
    this.buttons.push(b);
    return b;
  }

  zone(x: number, y: number, w: number, h: number, fn: (p: Phaser.Input.Pointer) => void): Phaser.GameObjects.Zone {
    const z = this.add(this.scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }), 5);
    z.on('pointerdown', fn);
    return z;
  }

  destroy(): void {
    for (const o of this.objs) o.destroy();
    for (const b of this.buttons) b.destroy();
    this.objs.length = 0;
    this.buttons.length = 0;
  }
}

/** A full-screen dim layer that also swallows clicks meant for the world. */
export function dimmer(bag: Bag, l: Layout, alpha = 0.5): Phaser.GameObjects.Rectangle {
  return bag.add(bag.scene.add.rectangle(0, 0, l.uiW, l.uiH, PAL.ink[0], alpha).setOrigin(0, 0).setInteractive(), 0);
}

export interface Row {
  text: string;
  right?: string;
  icon?: string;
  sub?: string;
  dim?: boolean;
  /** A row that only says there is nothing here: centred, quiet, and never picked out as the chosen one. */
  empty?: boolean;
  tint?: number;
}

interface Slot {
  bg: Phaser.GameObjects.Rectangle;
  mark: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.BitmapText;
  right: Phaser.GameObjects.BitmapText;
}

/** Sets a label, cutting it with dots if it would be wider than `room`. */
function fitText(t: Phaser.GameObjects.BitmapText, full: string, room: number): void {
  t.setText(full);
  let n = full.length;
  while (t.width > room && n > 1) {
    n -= 1;
    t.setText(`${full.slice(0, n).trimEnd()}...`);
  }
}

/** Pointer travel, in interface pixels, before a press turns into a scroll instead of a tap. */
const DRAG_SLOP = 4;

/** A scrolling list with one selected row. Works with keys, taps, the wheel, and a drag with a finger or the mouse. */
export class ListView {
  private slots: Slot[] = [];
  private rows: Row[] = [];
  private offset = 0;
  sel = 0;
  private more: Phaser.GameObjects.Image;
  private bar: Phaser.GameObjects.Rectangle;
  private track: Phaser.GameObjects.Rectangle;
  private press: { y0: number; off0: number; moved: boolean } | null = null;
  /** The row under a mouse, so a desktop pointer can tell what a click would pick. Fingers never hover. */
  private hover = -1;
  private wheel: (p: Phaser.Input.Pointer, o: unknown, dx: number, dy: number) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;
  readonly visible: number;

  constructor(
    private bag: Bag,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    h: number,
    readonly rowH: number,
    private onPick: (i: number) => void,
    private onSel: (i: number) => void = () => undefined,
    private pickOnTap = true,
  ) {
    this.visible = Math.max(1, Math.floor(h / rowH));
    for (let i = 0; i < this.visible; i++) {
      const ry = y + i * rowH;
      const bg = bag.rect(x, ry, w, rowH - 1, PAL.yellow[2], 1, 1).setAlpha(0);
      const mark = bag.rect(x, ry, 2, rowH - 1, PAL.red[3], 1, 2).setVisible(false);
      const icon = bag.img(x + 9, ry + rowH / 2, 'item/stone').setVisible(false);
      const text = bag.text(x + 20, ry + Math.floor((rowH - 9) / 2), '');
      const right = bag.text(x + w - 3, ry + Math.floor((rowH - 9) / 2), '', { origin: [1, 0] });
      this.slots.push({ bg, mark, icon, text, right });
    }
    const span = this.visible * rowH;
    this.track = bag.rect(x + w - 2, y, 2, span - 1, PAL.wood[2], 0.25, 2).setVisible(false);
    this.bar = bag.rect(x + w - 2, y, 2, 4, PAL.wood[3], 1, 3).setVisible(false);
    this.more = bag.img(x + w / 2, y + span + 3, 'ui/arrow-down').setVisible(false);

    // one zone for the whole list: a press that barely moves is a tap, one that travels scrolls
    const zone = bag.add(bag.scene.add.zone(x, y, w, span).setOrigin(0, 0).setInteractive({ useHandCursor: true }), 5);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { this.press = { y0: this.uiY(p), off0: this.offset, moved: false }; });
    this.onMove = (p) => {
      const d = this.press;
      if (!d) { this.over(p); return; }
      if (!p.isDown) return;
      const dy = this.uiY(p) - d.y0;
      if (!d.moved && Math.abs(dy) < DRAG_SLOP) return;
      d.moved = true;
      this.offset = Math.max(0, Math.min(Math.max(0, this.rows.length - this.visible), d.off0 - Math.round(dy / this.rowH)));
      this.paint();
    };
    this.onUp = (p) => {
      const d = this.press;
      this.press = null;
      if (!d || d.moved) return;
      const wp = bag.scene.cameras.main.getWorldPoint(p.x, p.y);
      if (wp.x < this.x || wp.x > this.x + this.w || wp.y < this.y || wp.y >= this.y + span) return;
      this.tap(Math.floor((wp.y - this.y) / this.rowH));
    };
    this.wheel = (p, _o, _dx, dy) => {
      const wp = bag.scene.cameras.main.getWorldPoint(p.x, p.y);
      if (wp.x < this.x || wp.x > this.x + this.w || wp.y < this.y || wp.y > this.y + span) return;
      this.move(dy > 0 ? 1 : -1);
    };
    bag.scene.input.on('wheel', this.wheel);
    bag.scene.input.on('pointermove', this.onMove);
    bag.scene.input.on('pointerup', this.onUp);
  }

  private over(p: Phaser.Input.Pointer): void {
    if (p.wasTouch) return;
    const wp = this.bag.scene.cameras.main.getWorldPoint(p.x, p.y);
    const inside = wp.x >= this.x && wp.x <= this.x + this.w && wp.y >= this.y && wp.y < this.y + this.visible * this.rowH;
    const at = inside ? this.offset + Math.floor((wp.y - this.y) / this.rowH) : -1;
    if (at === this.hover) return;
    this.hover = at;
    this.paint();
  }

  private uiY(p: Phaser.Input.Pointer): number {
    return this.bag.scene.cameras.main.getWorldPoint(p.x, p.y).y;
  }

  destroy(): void {
    this.bag.scene.input.off('wheel', this.wheel);
    this.bag.scene.input.off('pointermove', this.onMove);
    this.bag.scene.input.off('pointerup', this.onUp);
  }

  get count(): number {
    return this.rows.length;
  }

  setRows(rows: Row[], keepSel = true): void {
    this.rows = rows;
    // a fresh list starts on the first thing that can be done, not on something greyed out
    if (!keepSel) { this.sel = Math.max(0, rows.findIndex((r) => !r.dim)); this.offset = 0; }
    this.sel = Math.max(0, Math.min(rows.length - 1, this.sel));
    this.fit();
    this.paint();
  }

  private fit(): void {
    if (this.sel < this.offset) this.offset = this.sel;
    if (this.sel >= this.offset + this.visible) this.offset = this.sel - this.visible + 1;
    this.offset = Math.max(0, Math.min(Math.max(0, this.rows.length - this.visible), this.offset));
  }

  private tap(i: number): void {
    const idx = this.offset + i;
    if (idx >= this.rows.length) return;
    const was = this.sel;
    this.sel = idx;
    this.paint();
    if (was !== idx) this.onSel(idx);
    if (this.pickOnTap || was === idx) this.onPick(idx);
  }

  move(d: number): void {
    if (this.rows.length === 0) return;
    this.sel = (this.sel + d + this.rows.length) % this.rows.length;
    this.fit();
    this.paint();
    this.onSel(this.sel);
  }

  pick(): void {
    if (this.rows.length > 0) this.onPick(this.sel);
  }

  select(i: number): void {
    this.sel = Math.max(0, Math.min(this.rows.length - 1, i));
    this.fit();
    this.paint();
  }

  paint(): void {
    const scrolls = this.rows.length > this.visible;
    const edge = this.x + this.w - (scrolls ? 7 : 3);
    this.slots.forEach((s, i) => {
      const idx = this.offset + i;
      const r = this.rows[idx];
      if (!r) {
        s.bg.setAlpha(0);
        s.mark.setVisible(false);
        s.icon.setVisible(false);
        s.text.setText('');
        s.right.setText('');
        return;
      }
      const tint = r.tint ?? (r.dim ? COL.dim : COL.ink);
      const quiet = r.empty === true;
      s.bg.setAlpha(quiet ? 0 : idx === this.sel ? 0.5 : idx === this.hover ? 0.22 : 0);
      s.mark.setVisible(!quiet && idx === this.sel);
      s.right.setText(r.right ?? '').setTint(tint).setX(edge);
      const left = this.x + (r.icon ? 20 : 3);
      if (quiet) {
        s.text.setOrigin(0.5, 0).setTint(tint).setX(this.x + this.w / 2);
        fitText(s.text, r.text, this.w - 8);
      } else {
        s.text.setOrigin(0, 0);
        fitText(s.text.setTint(tint).setX(left), r.text, edge - left - (r.right ? s.right.width + 6 : 0));
      }
      if (r.icon) s.icon.setFrame(r.icon).setVisible(true).setAlpha(r.dim ? 0.55 : 1);
      else s.icon.setVisible(false);
    });
    this.more.setVisible(this.offset + this.visible < this.rows.length);
    this.track.setVisible(scrolls);
    this.bar.setVisible(scrolls);
    if (scrolls) {
      const span = this.visible * this.rowH - 1;
      const thumb = Math.max(6, Math.round((span * this.visible) / this.rows.length));
      const room = Math.max(1, this.rows.length - this.visible);
      this.bar.setSize(2, thumb).setY(this.y + Math.round(((span - thumb) * this.offset) / room));
    }
  }
}

/** A row of little hearts, filled up to `n` out of `of`. */
export function hearts(bag: Bag, x: number, y: number, n: number, of = 10): void {
  for (let i = 0; i < of; i++) bag.img(x + i * 8, y, i < n ? 'ui/heart-full' : 'ui/heart-empty', [0, 0], 3);
}
