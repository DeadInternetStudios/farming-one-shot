import Phaser from 'phaser';
import { itemDef } from '../data/items';
import { dayOfSeason, seasonOf } from '../game/clock';
import type { DaySummary } from '../game/day';
import { session } from '../game/session';
import { PAL } from '../gen/art';
import type { Layout } from '../display';
import { COL, button, iconFor, label, nine } from './kit';
import type { Button } from './kit';

const WEATHER_NAMES = { sun: 'Sunny', cloud: 'Cloudy', rain: 'Rainy', storm: 'Stormy', snow: 'Snowy' } as const;
const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;

interface Open {
  parts: Phaser.GameObjects.GameObject[];
  buttons: Button[];
  confirm: () => void;
  cancel?: () => void;
}

/** Centred pop-up panels: bed time, the day's tally, signs. One at a time. */
export class Modals {
  private cur: Open | null = null;
  private depth = 40;

  constructor(private scene: Phaser.Scene, private l: Layout) {
    scene.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (!this.cur) return;
      if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyE') this.cur.confirm();
      else if (ev.code === 'Escape' && this.cur.cancel) this.cur.cancel();
    });
  }

  get isOpen(): boolean {
    return this.cur !== null;
  }

  setLayout(l: Layout): void {
    this.l = l;
  }

  close(): void {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    for (const p of c.parts) p.destroy();
    for (const b of c.buttons) b.destroy();
    this.scene.time.delayedCall(80, () => session.release());
  }

  private begin(confirm: () => void, cancel?: () => void): { open: Open; dim: Phaser.GameObjects.Rectangle } {
    this.close();
    session.hold();
    const dim = this.scene.add.rectangle(0, 0, this.l.uiW, this.l.uiH, PAL.ink[0], 0.5).setOrigin(0, 0).setDepth(this.depth).setInteractive();
    const open: Open = { parts: [dim], buttons: [], confirm, cancel };
    this.cur = open;
    return { open, dim };
  }

  private panel(open: Open, w: number, h: number): { x: number; y: number } {
    const x = Math.floor((this.l.uiW - w) / 2);
    const y = Math.floor((this.l.uiH - h) / 2);
    open.parts.push(nine(this.scene, 'parchment', x, y, w, h).setDepth(this.depth + 1));
    return { x, y };
  }

  private text(open: Open, x: number, y: number, s: string, o: Parameters<typeof label>[4] = {}): Phaser.GameObjects.BitmapText {
    const t = label(this.scene, x, y, s, { tint: COL.ink, ...o }).setDepth(this.depth + 2);
    open.parts.push(t);
    return t;
  }

  private btn(open: Open, x: number, y: number, w: number, text: string, kind: 'leaf' | 'wood' | 'berry' | 'sky', fn: () => void): void {
    const b = button(this.scene, x, y, w, 17, text, kind, fn);
    for (const p of b.parts) (p as Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }).setDepth(this.depth + 3);
    open.buttons.push(b);
  }

  // ---------------------------------------------------------------- bed time

  askSleep(onYes: () => void): void {
    const yes = (): void => {
      this.close();
      onYes();
    };
    const { open } = this.begin(yes, () => this.close());
    const w = Math.min(156, this.l.uiW - 12);
    const h = 70;
    const { x, y } = this.panel(open, w, h);
    const hour = session.state.minute;
    const late = hour >= 20 * 60;
    this.text(open, x + w / 2, y + 13, late ? 'Ready for bed?' : 'It is still early.', { origin: [0.5, 0] });
    this.text(open, x + w / 2, y + 26, late ? 'The day ends and your crops grow.' : 'Sleep now and end the day?', { origin: [0.5, 0], tint: COL.dim, wrap: w - 20, align: 'center' });
    this.btn(open, x + 10, y + h - 26, Math.floor((w - 28) / 2), 'Sleep', 'leaf', yes);
    this.btn(open, x + w - 10 - Math.floor((w - 28) / 2), y + h - 26, Math.floor((w - 28) / 2), 'Not yet', 'wood', () => this.close());
  }

  // ---------------------------------------------------------------- signs and notes

  dialog(text: string): void {
    const { open } = this.begin(() => this.close(), () => this.close());
    const w = Math.min(190, this.l.uiW - 12);
    const t = label(this.scene, 0, 0, text, { wrap: w - 24 });
    const h = Math.ceil(t.height) + 40;
    t.destroy();
    const { x, y } = this.panel(open, w, h);
    this.text(open, x + 12, y + 12, text, { wrap: w - 24 });
    this.btn(open, x + w - 60, y + h - 26, 50, 'Okay', 'leaf', () => this.close());
  }

  // ---------------------------------------------------------------- the letter that starts the story

  letter(done: () => void): void {
    const name = session.state.player.name;
    const pages: string[][] = [
      [
        `Dear ${name},`,
        'By the time you read this I will be far down the road. The farm is yours now, just as I always promised.',
        'The soil is good and the well never runs dry. But the lanterns on the shrine in the village went dark the day I left.',
      ],
      [
        'Light them again with the best the valley grows. Seven lanterns, seven gifts.',
        'Plant something. Say hello to the neighbours. Go to bed before the owls do.',
        'With love,\nGrandma Hollis',
      ],
    ];
    const show = (n: number): void => {
      const last = n === pages.length - 1;
      const go = (): void => {
        if (last) {
          this.close();
          done();
        } else {
          show(n + 1);
        }
      };
      const { open } = this.begin(go);
      const w = Math.min(214, this.l.uiW - 12);
      const inner = w - 28;
      const lines = pages[n] as string[];
      const heights = lines.map((t) => {
        const m = label(this.scene, 0, 0, t, { wrap: inner });
        const hh = Math.ceil(m.height);
        m.destroy();
        return hh;
      });
      const h = 20 + heights.reduce((a, v) => a + v + 7, 0) + 30;
      const { x, y } = this.panel(open, w, h);
      let cy = y + 13;
      lines.forEach((t, i) => {
        this.text(open, x + 14, cy, t, { wrap: inner, tint: n === 0 && i === 0 ? COL.berry : COL.ink });
        cy += (heights[i] as number) + 7;
      });
      if (last) open.parts.push(this.scene.add.image(x + 24, y + h - 21, 'title', 'seal').setDepth(this.depth + 2));
      this.btn(open, x + w - 76, y + h - 26, 64, last ? 'Let us go' : 'Next', 'leaf', go);
    };
    show(0);
  }

  // ---------------------------------------------------------------- the day's tally

  daySummary(s: DaySummary, done: () => void): void {
    const finish = (): void => {
      this.close();
      done();
    };
    const { open } = this.begin(finish);
    const st = session.state;
    const w = Math.min(204, this.l.uiW - 8);
    const pad = 12;
    const rows = s.sold.slice(0, 5);
    const extra = s.sold.length - rows.length;
    const lines: string[] = [];
    if (s.passedOut) lines.push(`You passed out. Someone carried you home. Lost ${s.lostGold}g.`);
    if (s.newSeason) lines.push(`A new season begins: ${SEASON_NAMES[s.newSeason]}.`);
    if (s.withered > 0) lines.push(`${s.withered} crops withered in the cold turn of the season.`);
    if (s.night.ripe > 0) lines.push(`${s.night.ripe} crops are ripe and ready.`);
    if (s.night.thirsty > 0) lines.push(`${s.night.thirsty} crops were thirsty and did not grow.`);
    const notes = lines.map((l) => label(this.scene, 0, 0, l, { wrap: w - pad * 2 }));
    const notesH = notes.reduce((a, t) => a + Math.ceil(t.height) + 3, 0);
    notes.forEach((t) => t.destroy());
    const shipH = s.sold.length === 0 ? 12 : rows.length * 13 + (extra > 0 ? 11 : 0) + 17;
    const h = 22 + shipH + notesH + 34 + 28;
    const { x, y } = this.panel(open, w, h);
    let cy = y + 11;
    this.text(open, x + w / 2, cy, `Day ${dayOfSeason(s.day)} of ${SEASON_NAMES[seasonOf(s.day)]} is done`, { origin: [0.5, 0] });
    cy += 14;
    const rule = (): void => {
      open.parts.push(this.scene.add.rectangle(x + pad, cy, w - pad * 2, 1, PAL.dirt[2]).setOrigin(0, 0).setDepth(this.depth + 2));
      cy += 4;
    };
    rule();
    if (s.sold.length === 0) {
      this.text(open, x + pad, cy, 'Nothing was shipped today.', { tint: COL.dim });
      cy += 12;
    } else {
      for (const r of rows) {
        const d = itemDef(r.id);
        open.parts.push(this.scene.add.image(x + pad + 7, cy + 5, 'atlas', iconFor(st, r.id)).setScale(0.75).setDepth(this.depth + 2));
        this.text(open, x + pad + 18, cy, `${d.name}${r.n > 1 ? ` x${r.n}` : ''}`);
        this.text(open, x + w - pad, cy, `${r.gold}g`, { origin: [1, 0] });
        cy += 13;
      }
      if (extra > 0) {
        this.text(open, x + pad + 18, cy, `and ${extra} more kinds...`, { tint: COL.dim });
        cy += 11;
      }
      cy += 2;
      this.text(open, x + pad, cy, 'Earned tonight', { tint: COL.berry });
      this.text(open, x + w - pad, cy, `${s.earned}g`, { origin: [1, 0], tint: COL.berry });
      cy += 14;
    }
    for (const l of lines) {
      const t = this.text(open, x + pad, cy + 1, l, { wrap: w - pad * 2, tint: COL.dim });
      cy += Math.ceil(t.height) + 3;
    }
    cy += 3;
    rule();
    open.parts.push(this.scene.add.image(x + pad, cy + 1, 'atlas', `ui/weather-${s.weather}`).setOrigin(0, 0).setDepth(this.depth + 2));
    this.text(open, x + pad + 18, cy + 3, `Tomorrow is ${WEATHER_NAMES[s.weather].toLowerCase()}`);
    this.btn(open, x + Math.floor((w - 84) / 2), y + h - 27, 84, 'Good morning', 'leaf', finish);
  }
}
