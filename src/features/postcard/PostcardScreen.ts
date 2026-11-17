import Phaser from 'phaser';
import { tapH } from '../../display';
import { session } from '../../game/session';
import { COL } from '../../ui/kit';
import { Screen, isBack, isConfirm } from '../../ui/Screens';
import type { Host } from '../../ui/Screens';
import { sendPostcard, toFile } from './capture';
import type { Taken } from './capture';

const KEY = 'postcard-card';

/** The card, big on the table, with a way to keep it. */
export class PostcardScreen extends Screen {
  private file: Promise<File | null>;
  private note = '';
  private noteText: Phaser.GameObjects.BitmapText | null = null;
  private busy = false;

  constructor(host: Host, private taken: Taken) {
    super(host);
    this.file = toFile(taken);
  }

  build(): void {
    const { l, bag } = this;
    const tex = this.scene.textures;
    if (tex.exists(KEY)) tex.remove(KEY);
    tex.addCanvas(KEY, this.taken.canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.dim(0.68);

    const bh = tapH(l);
    const wide = l.uiW >= l.uiH * 1.45;
    const cw = this.taken.canvas.width;
    const ch = this.taken.canvas.height;
    const side = Math.min(88, Math.floor(l.uiW * 0.2));
    const room = wide ? { w: l.uiW - 16 - 14 - side, h: l.uiH - 16 } : { w: l.uiW - 16, h: l.uiH - 16 - bh - 20 };
    const s = Math.min(room.w / cw, room.h / ch);
    const w = Math.floor(cw * s);
    const h = Math.floor(ch * s);
    const x = wide ? Math.floor((l.uiW - (w + 14 + side)) / 2) : Math.floor((l.uiW - w) / 2);
    const y = wide ? Math.floor((l.uiH - h) / 2) : Math.max(6, Math.floor((l.uiH - h - bh - 20) / 2));

    bag.rect(x + 2, y + 3, w, h, 0x000000, 0.45, 1);
    bag.add(this.scene.add.image(x, y, KEY).setOrigin(0, 0).setDisplaySize(w, h), 2);

    const label = this.l.touch && typeof navigator.canShare === 'function' ? 'Share' : 'Save';
    if (wide) {
      const cx = x + w + 14;
      const bw = side;
      const mid = Math.floor(l.uiH / 2);
      bag.btn(cx, mid - bh - 3, bw, label, 'leaf', () => void this.keep(), bh);
      bag.btn(cx, mid + 3, bw, 'Close', 'wood', () => this.close(), bh);
      this.noteText = bag.text(cx, mid + bh + 12, this.note, { tint: COL.cream, outline: true, wrap: bw + 8 });
    } else {
      const bw = Math.min(84, Math.floor((l.uiW - 24) / 2));
      const by = y + h + 8;
      const bx = Math.floor((l.uiW - (bw * 2 + 8)) / 2);
      bag.btn(bx, by, bw, label, 'leaf', () => void this.keep(), bh);
      bag.btn(bx + bw + 8, by, bw, 'Close', 'wood', () => this.close(), bh);
      this.noteText = bag.text(Math.floor(l.uiW / 2), by + bh + 5, this.note, { tint: COL.cream, outline: true, origin: [0.5, 0], wrap: l.uiW - 16, align: 'center' });
    }
  }

  override onKey(code: string): void {
    if (isConfirm(code)) void this.keep();
    else if (isBack(code) || code === 'KeyP') this.close();
  }

  private async keep(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const file = await this.file;
    const msg = file ? await sendPostcard(file, this.l.touch) : 'The picture would not save.';
    this.busy = false;
    if (msg === null) return;
    session.events.emit('sfx', file ? 'pickup' : 'nope');
    this.note = msg;
    this.noteText?.setText(msg);
  }

  override teardown(): void {
    this.noteText = null;
    this.scene.textures.remove(KEY);
    super.teardown();
  }
}
