import Phaser from 'phaser';
import { itemDef } from '../data/items';
import { WEEKDAYS, dayOfSeason, daylight, formatTime, seasonOf, weekdayOf } from '../game/clock';
import { CAN_CAPACITY } from '../game/farming';
import { nextGoal } from '../game/goals';
import { HOTBAR_SIZE } from '../game/state';
import { session } from '../game/session';
import { PAL } from '../gen/art';
import type { Layout } from '../display';
import { settings } from '../game/settings';
import { COL, iconFor, label, nine } from './kit';
import { MS, easeOut } from './motion';

/** Hotbar spacing in interface pixels. Touch screens get 22, which is 44 CSS pixels at the phone interface scale. */
const pitchFor = (touch: boolean): number => (touch ? 22 : 19);

interface SlotView {
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.BitmapText;
  num: Phaser.GameObjects.BitmapText;
  water: Phaser.GameObjects.Rectangle;
}

interface Toast {
  parts: Phaser.GameObjects.GameObject[];
  place: (y: number) => void;
  h: number;
  born: number;
  key: string;
  n: number;
  text?: Phaser.GameObjects.BitmapText;
  base: string;
}

/** The always-on interface: clock, gold, energy, hotbar, held item name and little toasts. */
/** How clear a banner is: easing in from `from`, held until `until`, then fading out over `out` ms. */
function banner(now: number, from: number, until: number, out: number): number {
  const into = settings.calm ? 1 : easeOut((now - from) / MS.base);
  const away = now > until ? 1 - (now - until) / out : 1;
  return Math.min(into, away);
}

export class Hud {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private season!: Phaser.GameObjects.Image;
  private weather!: Phaser.GameObjects.Image;
  private dayText!: Phaser.GameObjects.BitmapText;
  private timeText!: Phaser.GameObjects.BitmapText;
  private goldText!: Phaser.GameObjects.BitmapText;
  private goldShown = -1;
  private goldTarget = 0;
  private energyFill!: Phaser.GameObjects.Rectangle;
  private energyW = 0;
  private slots: SlotView[] = [];
  private sel!: Phaser.GameObjects.Image;
  private tipBg!: Phaser.GameObjects.NineSlice;
  private tipText!: Phaser.GameObjects.BitmapText;
  private tipUntil = 0;
  private tipFrom = 0;
  private hintBg!: Phaser.GameObjects.NineSlice;
  private hintText!: Phaser.GameObjects.BitmapText;
  private hintShown = '';
  private placeBg!: Phaser.GameObjects.NineSlice;
  private placeText!: Phaser.GameObjects.BitmapText;
  private placeUntil = 0;
  private placeFrom = 0;
  private placeName = '';
  private goalBg!: Phaser.GameObjects.NineSlice;
  private goalIcon!: Phaser.GameObjects.Image;
  private goalText!: Phaser.GameObjects.BitmapText;
  private goalShown = '';
  private goalCheck = 0;
  private readonly goalRect = new Phaser.Geom.Rectangle();
  private toasts: Toast[] = [];
  private sig = '';
  private clockSig = '';
  private offset = 0;
  private visible = HOTBAR_SIZE;
  private hotbarTop = 0;
  readonly hotbarRect = new Phaser.Geom.Rectangle();

  constructor(private scene: Phaser.Scene, private l: Layout) {
    this.build();
  }

  destroy(): void {
    for (const o of this.objs) o.destroy();
    for (const t of this.toasts) for (const p of t.parts) p.destroy();
    this.objs = [];
    this.toasts = [];
    this.slots = [];
  }

  rebuild(l: Layout): void {
    this.l = l;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.slots = [];
    this.sig = '';
    this.clockSig = '';
    this.goldShown = -1;
    this.build();
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private build(): void {
    const s = this.scene;
    const l = this.l;

    // clock, top left
    this.add(nine(s, 'dark', 3, 3, 88, 31));
    this.season = this.add(s.add.image(9, 9, 'atlas', 'ui/season-spring').setOrigin(0, 0));
    this.dayText = this.add(label(s, 23, 10, ''));
    this.weather = this.add(s.add.image(91 - 7, 9, 'atlas', 'ui/weather-sun').setOrigin(1, 0));
    this.timeText = this.add(label(s, 9, 22, '', { tint: COL.gold }));
    this.goalBg = this.add(nine(s, 'dark', 3, 37, 40, 15).setVisible(false));
    this.goalIcon = this.add(s.add.image(9, 41, 'atlas', 'ui/arrow-right').setOrigin(0, 0).setVisible(false));
    this.goalText = this.add(label(s, 19, 41, '', { tint: COL.cream, wrap: Math.min(200, l.uiW - 36) }).setVisible(false));
    this.goalShown = '';
    this.goalCheck = 0;

    // gold and energy, top right
    const gw = 58;
    const gx = l.uiW - gw - 3;
    this.add(nine(s, 'dark', gx, 3, gw, 16));
    this.add(s.add.image(gx + 6, 6, 'atlas', 'ui/coin').setOrigin(0, 0));
    this.goldText = this.add(label(s, gx + gw - 7, 7, '0', { tint: COL.gold, origin: [1, 0] }));
    this.add(nine(s, 'dark', gx, 21, gw, 13));
    this.add(s.add.image(gx + 4, 21 + 1, 'atlas', 'ui/bolt').setOrigin(0, 0));
    this.energyW = gw - 22;
    this.add(s.add.rectangle(gx + 17, 21 + 5, this.energyW, 4, PAL.ink[0]).setOrigin(0, 0));
    this.energyFill = this.add(s.add.rectangle(gx + 17, 21 + 5, this.energyW, 4, PAL.leaf[4]).setOrigin(0, 0));

    // hotbar, bottom centre
    const pitch = pitchFor(l.touch);
    this.visible = Math.max(5, Math.min(HOTBAR_SIZE, Math.floor((l.uiW - 8) / pitch)));
    const w = this.visible * pitch + 1;
    const x0 = Math.floor((l.uiW - w) / 2);
    const y0 = l.uiH - 24;
    this.hotbarTop = y0;
    this.hotbarRect.setTo(x0 - 2, y0 - 4, w + 4, 28);
    for (let i = 0; i < this.visible; i++) {
      const x = x0 + i * pitch;
      const bg = this.add(s.add.image(x, y0, 'atlas', 'ui/slot').setOrigin(0, 0));
      // the whole cell is the target, not just the picture, and it reaches up into the margin
      bg.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-(pitch - 20) / 2, -4, pitch, 28), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
      const icon = this.add(s.add.image(x + 10, y0 + 10, 'atlas', 'item/stone').setVisible(false));
      const water = this.add(s.add.rectangle(x + 3, y0 + 16, 14, 2, PAL.water[3]).setOrigin(0, 0).setVisible(false));
      const num = this.add(label(s, x + 3, y0 + 2, '', { tint: PAL.ink[4] }));
      const count = this.add(label(s, x + 18, y0 + 12, '', { outline: true, origin: [1, 0] }));
      bg.on('pointerdown', () => session.events.emit('use-slot', this.offset + i));
      this.slots.push({ bg, icon, count, num, water });
    }
    this.sel = this.add(s.add.image(x0, y0, 'atlas', 'ui/slot-sel').setOrigin(0, 0));
    this.tipBg = this.add(nine(s, 'dark', 0, 0, 40, 15).setVisible(false));
    this.tipText = this.add(label(s, 0, 0, '', { origin: [0.5, 0] }).setVisible(false));
    this.hintBg = this.add(nine(s, 'dark', 0, 0, 40, 15).setVisible(false));
    this.hintText = this.add(label(s, 0, 0, '', { origin: [0.5, 0], tint: COL.gold }).setVisible(false));
    this.hintShown = '';
    this.placeBg = this.add(nine(s, 'dark', 0, 0, 40, 17).setVisible(false));
    this.placeText = this.add(label(s, 0, 0, '', { origin: [0.5, 0] }).setVisible(false));
    this.sig = '';
    for (const o of this.objs) (o as Phaser.GameObjects.GameObject & { setDepth?: (d: number) => unknown }).setDepth?.(10);
  }

  // ---------------------------------------------------------------- toasts

  toast(text: string, icon?: string, key = text): void {
    const now = this.scene.time.now;
    const prev = this.toasts.find((t) => t.key === key && now - t.born < 1400);
    if (prev && prev.text) {
      prev.n += 1;
      prev.born = now;
      prev.text.setText(`${prev.base} x${prev.n}`);
      return;
    }
    const s = this.scene;
    const wrap = Math.min(170, this.l.uiW - 30);
    const t = label(s, 0, 0, text, { wrap, tint: COL.cream });
    const iw = icon ? 18 : 0;
    const w = Math.ceil(t.width) + 14 + iw;
    const h = Math.max(16, Math.ceil(t.height) + 9);
    const bg = nine(s, 'dark', 0, 0, w, h);
    const parts: Phaser.GameObjects.GameObject[] = [bg, t];
    const img = icon ? s.add.image(0, 0, 'atlas', icon) : null;
    if (img) parts.push(img);
    const place = (y: number): void => {
      const x = Math.floor((this.l.uiW - w) / 2);
      bg.setPosition(x, y);
      t.setPosition(x + 7 + iw, y + Math.floor((h - t.height) / 2));
      img?.setPosition(x + 14, y + h / 2);
    };
    bg.setDepth(12);
    t.setDepth(13);
    img?.setDepth(13);
    const toast: Toast = { parts, place, h, born: now, key, n: 1, text: t, base: text };
    this.toasts.push(toast);
    if (this.toasts.length > 3) {
      const old = this.toasts.shift();
      old?.parts.forEach((p) => p.destroy());
    }
  }

  picked(item: string, n: number): void {
    const d = itemDef(item);
    this.toast(`+${n} ${d.name}`, iconFor(session.state, item), `pick:${item}`);
  }

  showTip(): void {
    const p = session.state.player;
    const held = p.slots[p.selected];
    if (!held) return;
    const d = itemDef(held.id);
    const s = d.kind === 'tool' ? d.name : `${d.name}${held.n > 1 ? `  x${held.n}` : ''}`;
    this.tipText.setText(s);
    const w = Math.ceil(this.tipText.width) + 14;
    this.tipBg.setSize(w, 15);
    const cx = Math.floor(this.l.uiW / 2);
    const y = this.hotbarTop - 20;
    this.tipBg.setPosition(cx - Math.floor(w / 2), y);
    this.tipText.setPosition(cx, y + 4);
    this.tipFrom = this.scene.time.now;
    this.tipUntil = this.tipFrom + 1700;
    this.tipBg.setVisible(true).setAlpha(settings.calm ? 1 : 0);
    this.tipText.setVisible(true).setAlpha(settings.calm ? 1 : 0);
  }

  /** What the character is facing, when it can be used. An empty string clears it. */
  hint(text: string): void {
    if (text === this.hintShown) return;
    this.hintShown = text;
    if (!text) {
      this.hintBg.setVisible(false);
      this.hintText.setVisible(false);
      return;
    }
    this.hintText.setText(text);
    const w = Math.ceil(this.hintText.width) + 14;
    this.hintBg.setSize(w, 15);
    const cx = Math.floor(this.l.uiW / 2);
    const y = this.hotbarTop - 38;
    this.hintBg.setPosition(cx - Math.floor(w / 2), y).setVisible(true);
    this.hintText.setPosition(cx, y + 4).setVisible(true);
  }

  /** Where the centred pop-ups start. Narrow screens keep them below the goal line. */
  private topY(): number {
    return this.l.uiW < 330 ? 54 : 38;
  }

  /** The one line that says what to do next, under the clock. It steps aside for a pop-up, which would otherwise show it through its own fade. */
  private updateGoal(now: number, covered: boolean): void {
    const show = this.goalShown !== '' && !covered;
    if (this.goalBg.visible !== show) {
      this.goalBg.setVisible(show);
      this.goalIcon.setVisible(show);
      this.goalText.setVisible(show);
    }
    if (now < this.goalCheck) return;
    this.goalCheck = now + 400;
    const text = nextGoal(session.state)?.text ?? '';
    if (text === this.goalShown) return;
    this.goalShown = text;
    const on = text !== '';
    this.goalBg.setVisible(on && !covered);
    this.goalIcon.setVisible(on && !covered);
    this.goalText.setVisible(on && !covered);
    if (!on) {
      this.goalRect.setTo(0, 0, 0, 0);
      return;
    }
    this.goalText.setText(text);
    const w = Math.ceil(this.goalText.width) + 24;
    const h = Math.ceil(this.goalText.height) + 8;
    this.goalBg.setSize(w, h);
    this.goalRect.setTo(3, 37, w, h);
  }

  /** The name of the place you just arrived at, shown for a moment near the top. */
  place(name: string): void {
    if (name === this.placeName) return;
    this.placeName = name;
    this.placeText.setText(name);
    const w = Math.ceil(this.placeText.width) + 20;
    this.placeBg.setSize(w, 17);
    const cx = Math.floor(this.l.uiW / 2);
    const top = this.topY();
    this.placeBg.setPosition(cx - Math.floor(w / 2), top + 2).setVisible(true).setAlpha(settings.calm ? 1 : 0);
    this.placeText.setPosition(cx, top + 7).setVisible(true).setAlpha(settings.calm ? 1 : 0);
    this.placeFrom = this.scene.time.now;
    this.placeUntil = this.placeFrom + 2200;
  }

  // ---------------------------------------------------------------- per frame

  update(covered = false): void {
    const st = session.state;
    const p = st.player;
    const now = this.scene.time.now;

    this.updateGoal(now, covered);
    const season = seasonOf(st.day);
    const clockSig = `${st.day}|${Math.floor(st.minute / 10)}|${st.weather}`;
    if (clockSig !== this.clockSig) {
      this.clockSig = clockSig;
      const names = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;
      this.season.setFrame(`ui/season-${season}`);
      // a clear sky after dark is a moon, not a sun
      const dark = st.weather === 'sun' && daylight(season, st.minute) < 0.5;
      this.weather.setFrame(dark ? 'ui/weather-moon' : `ui/weather-${st.weather}`);
      this.dayText.setText(`${names[season]} ${dayOfSeason(st.day)}`);
      this.timeText.setText(`${WEEKDAYS[weekdayOf(st.day)]}  ${formatTime(st.minute)}`);
    }

    this.goldTarget = p.gold;
    if (this.goldShown < 0) this.goldShown = p.gold;
    if (this.goldShown !== this.goldTarget) {
      const diff = this.goldTarget - this.goldShown;
      this.goldShown += Math.abs(diff) < 3 ? diff : Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) * 0.12));
      this.goldText.setText(String(this.goldShown));
    } else if (this.goldText.text === '0' && p.gold !== 0) this.goldText.setText(String(p.gold));

    const e = Math.max(0, Math.min(1, p.energy / p.maxEnergy));
    this.energyFill.setSize(Math.max(e > 0 ? 1 : 0, Math.round(this.energyW * e)), 4);
    this.energyFill.setFillStyle(e > 0.5 ? PAL.leaf[4] : e > 0.22 ? PAL.yellow[3] : PAL.red[3]);

    // keep the selected slot inside the visible window; on a narrow bar the edge cells slide it along, so every slot can be reached by touch
    const margin = this.visible < HOTBAR_SIZE ? 1 : 0;
    if (p.selected < this.offset + margin) this.offset = Math.max(0, p.selected - margin);
    if (p.selected > this.offset + this.visible - 1 - margin) this.offset = Math.min(HOTBAR_SIZE - this.visible, p.selected - this.visible + 1 + margin);
    const sig = `${this.offset}|${p.selected}|${p.water}|${p.slots.slice(0, HOTBAR_SIZE).map((s) => (s ? `${s.id}:${s.n}` : '-')).join(',')}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.refreshSlots();
    }

    if (this.tipText.visible) {
      const a = banner(now, this.tipFrom, this.tipUntil, 300);
      if (a <= 0) {
        this.tipBg.setVisible(false);
        this.tipText.setVisible(false);
      } else {
        this.tipBg.setAlpha(a);
        this.tipText.setAlpha(a);
      }
    }

    if (this.placeText.visible) {
      const a = banner(now, this.placeFrom, this.placeUntil, 400);
      if (a <= 0) {
        this.placeBg.setVisible(false);
        this.placeText.setVisible(false);
      } else {
        this.placeBg.setAlpha(a);
        this.placeText.setAlpha(a);
      }
    }

    let y = this.topY() + (this.placeText.visible ? 24 : 0);
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i] as Toast;
      const age = now - t.born;
      if (age > 2600) {
        t.parts.forEach((q) => q.destroy());
        this.toasts.splice(i, 1);
        continue;
      }
    }
    for (const t of this.toasts) {
      const age = now - t.born;
      const a = age > 2200 ? 1 - (age - 2200) / 400 : Math.min(1, age / 120);
      t.place(y);
      for (const q of t.parts) (q as Phaser.GameObjects.GameObject & { setAlpha: (v: number) => unknown }).setAlpha(a);
      y += t.h + 2;
    }
  }

  private refreshSlots(): void {
    const st = session.state;
    const p = st.player;
    this.slots.forEach((sv, i) => {
      const idx = this.offset + i;
      const s = p.slots[idx];
      const num = idx === 9 ? '0' : String(idx + 1);
      sv.num.setText(this.l.touch ? '' : num);
      if (!s) {
        sv.icon.setVisible(false);
        sv.count.setText('');
        sv.water.setVisible(false);
      } else {
        const d = itemDef(s.id);
        sv.icon.setFrame(iconFor(st, s.id)).setVisible(true);
        sv.count.setText(s.n > 1 ? String(s.n) : '');
        if (s.id === 'can') {
          const cap = CAN_CAPACITY[p.tools.can];
          sv.water.setVisible(true).setSize(Math.max(0, Math.round((14 * p.water) / cap)), 2);
        } else sv.water.setVisible(false);
        void d;
      }
    });
    const k = p.selected - this.offset;
    const sv = this.slots[k];
    if (sv) this.sel.setPosition(sv.bg.x - 2, sv.bg.y - 2).setVisible(true);
    else this.sel.setVisible(false);
  }

  /** True when a pointer at this interface position is over a solid part of the HUD. */
  covers(x: number, y: number): boolean {
    return this.hotbarRect.contains(x, y) || (x < 94 && y < 36) || (x > this.l.uiW - 64 && y < 36) || this.goalRect.contains(x, y);
  }
}
