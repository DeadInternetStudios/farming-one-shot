import Phaser from 'phaser';
import { session } from '../game/session';
import { COL, label } from './kit';
import { Screen, isBack, isConfirm, isDown, isUp } from './Screens';
import { Bag, ListView } from './widgets';

export interface DialogueOpts {
  name: string;
  /** Atlas frame of a bust portrait. */
  portrait?: string;
  pages: string[];
  choices?: { label: string; fn: () => void }[];
  done?: () => void;
  /** Sound pitch for the voice blips, so each speaker sounds a little different. */
  voice?: number;
}

/** Breaks text into lines that fit, so the typewriter never makes words jump. */
export function wrapText(scene: Phaser.Scene, s: string, maxW: number): string {
  const probe = label(scene, 0, 0, '').setVisible(false);
  const lines: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      probe.setText(next);
      if (probe.width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  probe.destroy();
  return lines.join('\n');
}

const CPS = 64;

export class Dialogue extends Screen {
  private page = 0;
  private shown = 0;
  private full = '';
  private text: Phaser.GameObjects.BitmapText | null = null;
  private more: Phaser.GameObjects.Image | null = null;
  private list: ListView | null = null;
  private born = 0;
  private lastBlip = 0;

  constructor(host: ConstructorParameters<typeof Screen>[0], private o: DialogueOpts) {
    super(host);
  }

  build(): void {
    const { l, bag } = this;
    this.list = null;
    this.dim(0.18);
    const w = Math.min(l.uiW - 8, 340);
    const h = 70;
    const x = Math.floor((l.uiW - w) / 2);
    const y = l.uiH - h - 32;
    bag.panel(x, y, w, h);
    let x0 = x + 14;
    if (this.o.portrait) {
      bag.panel(x + 6, y + 7, 56, 56, 'dark');
      bag.img(x + 34, y + 36, this.o.portrait, [0.5, 0.5]);
      x0 = x + 70;
    }
    const nameW = Math.ceil(label(this.scene, 0, 0, this.o.name).setVisible(false).width) + 16;
    bag.panel(x + 8, y - 8, nameW, 15, 'dark', 3);
    bag.text(x + 16, y - 4, this.o.name, { tint: COL.gold }).setDepth(bag.depth + 5);
    const tw = x + w - 10 - x0;
    this.text = bag.text(x0, y + 12, '', {});
    this.more = bag.img(x + w - 14, y + h - 12, 'ui/arrow-down').setVisible(false);
    bag.zone(x, y, w, h, () => this.advance());
    this.textW = tw;
    this.box = { x, y, w, h };
    this.startPage(this.page === 0 && this.shown === 0 ? 0 : this.page, this.shown > 0);
  }

  private textW = 0;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  private startPage(i: number, instant = false): void {
    this.page = i;
    this.full = wrapText(this.scene, this.o.pages[i] ?? '', this.textW);
    this.shown = instant ? this.full.length : 0;
    this.born = this.scene.time.now;
    this.text?.setText(this.full.slice(0, this.shown));
    this.more?.setVisible(false);
    if (instant) this.finishedPage();
  }

  private get typing(): boolean {
    return this.shown < this.full.length;
  }

  private get lastPage(): boolean {
    return this.page >= this.o.pages.length - 1;
  }

  private finishedPage(): void {
    if (this.lastPage && this.o.choices && !this.list) this.showChoices();
    else this.more?.setVisible(true);
  }

  private showChoices(): void {
    const ch = this.o.choices ?? [];
    const { x, y, w } = this.box;
    const cw = Math.min(124, w - 12);
    const rowH = 16;
    const ph = ch.length * rowH + 10;
    const px = x + w - cw - 6;
    const py = y - ph - 3;
    const cbag = this.own(new Bag(this.scene, this.bag.depth + 10));
    cbag.panel(px, py, cw, ph, 'parchment', 0);
    this.list = this.own(new ListView(cbag, px + 6, py + 5, cw - 12, ch.length * rowH, rowH, (i) => this.choose(i), () => undefined, true));
    this.list.setRows(ch.map((c) => ({ text: c.label })));
    this.more?.setVisible(false);
  }

  private choose(i: number): void {
    const c = this.o.choices?.[i];
    this.close();
    if (c) c.fn();
    else this.o.done?.();
  }

  private advance(): void {
    if (this.list) {
      this.list.pick();
      return;
    }
    if (this.typing) {
      this.shown = this.full.length;
      this.text?.setText(this.full);
      this.finishedPage();
      return;
    }
    if (!this.lastPage) {
      session.events.emit('sfx', 'tick');
      this.startPage(this.page + 1);
      return;
    }
    this.close();
    this.o.done?.();
  }

  override onKey(code: string): void {
    if (isConfirm(code)) this.advance();
    else if (isBack(code)) {
      this.close();
      this.o.done?.();
    } else if (this.list && isUp(code)) this.list.move(-1);
    else if (this.list && isDown(code)) this.list.move(1);
  }

  override update(): void {
    if (!this.text || !this.typing) return;
    const target = Math.min(this.full.length, Math.floor(((this.scene.time.now - this.born) / 1000) * CPS));
    if (target === this.shown) return;
    this.shown = target;
    this.text.setText(this.full.slice(0, this.shown));
    const ch = this.full[this.shown - 1];
    if (ch && ch !== ' ' && ch !== '\n' && this.scene.time.now - this.lastBlip > 55) {
      this.lastBlip = this.scene.time.now;
      session.events.emit('sfx', 'blip', this.o.voice ?? 1);
    }
    if (!this.typing) this.finishedPage();
  }
}
