import Phaser from 'phaser';
import { itemDef } from '../data/items';
import { NPC_BY_ID } from '../data/npcs';
import { MAX_BATCH, SMELTS, batchFor, collectBars, furnaceState, minutesLeft, startSmelt } from '../game/furnace';
import { canAdd, addItem, countItem, emptySlots } from '../game/inventory';
import type { Slots } from '../game/inventory';
import { deliver } from '../game/requests';
import { session } from '../game/session';
import type { ThingState } from '../game/state';
import { slotPitch, tapH } from '../display';
import { footer, popup } from './chrome';
import { COL, iconFor } from './kit';
import { ListPane, listPage } from './MenuUI';
import type { Entry } from './MenuUI';
import { Screen, isBack, isConfirm, isDown, isLeft, isRight, isUp } from './Screens';
import type { Host } from './Screens';
import { Bag } from './widgets';

export interface PickConfig {
  title: string;
  accepts(id: string): boolean;
  /** The button on each entry, such as Give or Enter. */
  action: string;
  /** What to say under an item's name. */
  lines(id: string): string[];
  empty: { title: string; lines: string[] };
  onPick(slot: number): void;
}

/** Pick one thing from the bag: a gift for a villager, an entry for a contest. */
export class PickScreen extends Screen {
  private pane: ListPane | null = null;

  constructor(host: Host, private cfg: PickConfig) {
    super(host);
  }

  private entries(): Entry[] {
    const st = session.state;
    const out: Entry[] = [];
    st.player.slots.forEach((s, i) => {
      if (!s || !this.cfg.accepts(s.id)) return;
      const d = itemDef(s.id);
      out.push({
        row: { text: d.name, icon: iconFor(st, s.id), right: s.n > 1 ? String(s.n) : '' },
        title: d.name,
        icon: iconFor(st, s.id),
        lines: this.cfg.lines(s.id),
        actions: [{
          label: this.cfg.action, kind: 'leaf', run: () => {
            this.scene.time.delayedCall(0, () => { this.close(); this.cfg.onPick(i); });
            return null;
          },
        }],
      });
    });
    if (out.length === 0) out.push({ row: { text: this.cfg.empty.title, dim: true, empty: true }, title: this.cfg.empty.title, lines: this.cfg.empty.lines });
    return out;
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const { p, row, style, area } = listPage(l, bag, this.cfg.title, { wideH: 250, tallH: 480 }, 0, this.entries(), () => this.close(), false);
    const body = this.own(new Bag(this.scene, bag.depth));
    this.pane = this.own(new ListPane(body, this.scene, area, p, () => this.entries(), undefined, row, style));
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}

/** The notice board by the shrine: errands for the villagers. */
export class BoardScreen extends Screen {
  private pane: ListPane | null = null;
  private entries(): Entry[] {
    const st = session.state;
    const list = [...st.requests].sort((a, b) => a.until - b.until);
    if (list.length === 0) {
      return [{ row: { text: 'Nothing posted', dim: true, empty: true }, title: 'Nothing posted', lines: ['New notes go up each morning, once you have met a few neighbours. Say hello around the village.'] }];
    }
    return list.map((q): Entry => {
      const d = itemDef(q.item);
      const who = NPC_BY_ID[q.npc]?.name ?? 'Someone';
      const got = countItem(st.player.slots, q.item);
      const left = q.until - st.day;
      return {
        row: { text: `${q.n} ${d.name}`, icon: iconFor(st, q.item), right: `${q.reward}g` },
        title: `${who} needs ${q.n} ${d.name}`,
        icon: iconFor(st, q.item),
        lines: [
          { t: d.name, need: { icon: iconFor(st, q.item), have: got, n: q.n } },
          `Reward: ${q.reward}g and a kind word.`,
          left <= 0 ? 'Last day to deliver.' : `${left} ${left === 1 ? 'day' : 'days'} left.`,
        ],
        actions: [{
          label: 'Deliver', kind: 'leaf', off: got < q.n, run: () => {
            const r = deliver(st, q.id);
            if (!r.ok) { session.events.emit('sfx', 'nope'); return r.msg; }
            session.events.emit('sfx', 'coin');
            session.events.emit('npc-fx', q.npc, 'heart');
            return `${who} thanks you. +${q.reward}g`;
          },
        }],
      };
    });
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const { p, row, style, area } = listPage(l, bag, 'Notice Board', { wideH: 250, tallH: 480 }, 0, this.entries(), () => this.close());
    const body = this.own(new Bag(this.scene, bag.depth));
    this.pane = this.own(new ListPane(body, this.scene, area, p, () => this.entries(), undefined, row, style));
    this.pane.say = footer(bag, p);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}

// ------------------------------------------------------------------ chests

export const CHEST_SLOTS = 24;

export function chestAt(loc: string, key: string): ThingState {
  const l = session.location(loc);
  let t = l.things[key];
  if (!t) {
    t = { kind: 'chest', items: emptySlots(CHEST_SLOTS) };
    l.things[key] = t;
  }
  t.items ??= emptySlots(CHEST_SLOTS);
  return t;
}

interface Cell {
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.BitmapText;
}

/** A tidy grid of slots. Tapping or pressing confirm hands the stack to `onPick`. */
class SlotGrid {
  readonly cells: Cell[] = [];
  readonly cols: number;
  sel = 0;
  private cursor: Phaser.GameObjects.Image;

  constructor(bag: Bag, private x: number, private y: number, cols: number, private pitch: number, private slots: () => Slots, private onPick: (i: number) => void) {
    this.cols = cols;
    const n = slots().length;
    for (let i = 0; i < n; i++) {
      const cx = x + (i % cols) * pitch;
      const cy = y + Math.floor(i / cols) * pitch;
      const bg = bag.img(cx, cy, 'ui/slot', [0, 0], 1);
      const icon = bag.img(cx + 10, cy + 10, 'item/stone').setVisible(false);
      const count = bag.text(cx + 18, cy + 12, '', { origin: [1, 0], outline: true, tint: COL.cream });
      bag.zone(cx, cy, pitch, pitch, () => { this.sel = i; this.onPick(i); });
      this.cells.push({ bg, icon, count });
    }
    this.cursor = bag.img(0, 0, 'ui/slot-sel', [0, 0], 3);
  }

  get rows(): number {
    return Math.ceil(this.cells.length / this.cols);
  }

  paint(active: boolean): void {
    const st = session.state;
    const slots = this.slots();
    this.cells.forEach((c, i) => {
      const s = slots[i];
      if (s) c.icon.setFrame(iconFor(st, s.id)).setVisible(true);
      else c.icon.setVisible(false);
      c.count.setText(s && s.n > 1 ? String(s.n) : '');
    });
    this.cursor.setVisible(active).setPosition(this.x + (this.sel % this.cols) * this.pitch - 2, this.y + Math.floor(this.sel / this.cols) * this.pitch - 2);
  }
}

/** Move stacks between a chest and the bag with one tap each. */
export class ChestScreen extends Screen {
  private focus: 'chest' | 'bag' = 'chest';
  private chest!: SlotGrid;
  private pack!: SlotGrid;
  private line: Phaser.GameObjects.BitmapText | null = null;
  /** Beside the title while nothing is stored, so a bare chest says so instead of leaving a grid of holes to speak for itself. */
  private bare: Phaser.GameObjects.BitmapText | null = null;
  /** What the last move did. Cleared as soon as the cursor goes somewhere else. */
  private moved = '';

  constructor(host: Host, private loc: string, private key: string) {
    super(host);
  }

  private get items(): Slots {
    return chestAt(this.loc, this.key).items as Slots;
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const bagSlots = session.state.player.slots.length;
    // a touch screen's title bar is taller, to hold a close button big enough for a finger
    const lift = l.touch ? tapH(l) - 14 : 0;
    const tallAt = (c: number, pitch: number): number => 28 + lift + Math.ceil(CHEST_SLOTS / c) * pitch + 16 + Math.ceil(bagSlots / c) * pitch + 26;
    const mostAt = (pitch: number): number => Math.max(6, Math.floor((l.uiW - 36) / pitch));
    // two grids in one pop-up are a lot for a short screen: if fingertip-sized slots will not fit even in the most columns the width allows, the slots shrink to the pointer size
    let pitch = slotPitch(l);
    if (tallAt(mostAt(pitch), pitch) > l.uiH - 8) pitch = Math.min(pitch, slotPitch({ ...l, touch: false }));
    const tall = (c: number): number => tallAt(c, pitch);
    // as many columns as the screen's width allows, but no more than it takes to fit its height
    const most = mostAt(pitch);
    let cols = Math.min(10, most);
    while (cols < most && tall(cols) > l.uiH - 8) cols++;
    const h = tall(cols);
    const p = popup(bag, l, { title: 'Chest', maxW: cols * pitch + 20, wideH: h, tallH: h, close: () => this.close() });
    const { x, y } = p;
    this.bare = bag.text(p.closeX - 8, p.titleY, 'Nothing stored', { origin: [1, 0], tint: COL.dim });
    // on a narrow pop-up the title leaves less room, so the note says it in one word
    if (this.bare.x - this.bare.width < p.title.x + p.title.width + 8) this.bare.setText('Empty');
    const body = this.own(new Bag(this.scene, bag.depth));
    const chestRows = Math.ceil(CHEST_SLOTS / cols);
    this.chest = new SlotGrid(body, x + 10, y + 26 + lift, cols, pitch, () => this.items, (i) => { this.focus = 'chest'; this.move('chest', i); });
    const by = y + 26 + lift + chestRows * pitch + 6;
    bag.text(x + 12, by - 1, 'Bag', { tint: COL.dim });
    this.pack = new SlotGrid(body, x + 10, by + 11, cols, pitch, () => session.state.player.slots, (i) => { this.focus = 'bag'; this.move('bag', i); });
    this.line = bag.text(p.x + p.w / 2, p.y + p.h - 14, '', { origin: [0.5, 0], tint: COL.dim });
    // start on something, not on a hole
    const first = (slots: Slots): number => Math.max(0, slots.findIndex((s) => s !== null));
    this.chest.sel = first(this.items);
    this.pack.sel = first(session.state.player.slots);
    if (this.items.every((s) => s === null) && session.state.player.slots.some((s) => s !== null)) this.focus = 'bag';
    this.paint();
  }

  private paint(): void {
    this.bare?.setVisible(this.items.every((s) => s === null));
    this.chest.paint(this.focus === 'chest');
    this.pack.paint(this.focus === 'bag');
    const g = this.focus === 'chest' ? this.chest : this.pack;
    const s = (this.focus === 'chest' ? this.items : session.state.player.slots)[g.sel];
    const where = this.focus === 'chest' ? 'Chest' : 'Bag';
    if (this.moved) this.line?.setText(this.moved).setTint(COL.ink);
    else if (s) this.line?.setText(`${itemDef(s.id).name} x${s.n}. ${this.focus === 'chest' ? 'Tap to take it.' : 'Tap to store it.'}`).setTint(COL.ink);
    else this.line?.setText(`${where}: an empty slot.`).setTint(COL.dim);
  }

  private move(from: 'chest' | 'bag', i: number): void {
    const src = from === 'chest' ? this.items : session.state.player.slots;
    const dst = from === 'chest' ? session.state.player.slots : this.items;
    const s = src[i];
    this.moved = '';
    if (!s) { this.paint(); return; }
    if (!canAdd(dst, s.id, s.n)) {
      this.moved = from === 'chest' ? 'Your bag is full.' : 'The chest is full.';
      session.events.emit('sfx', 'nope');
      this.paint();
      return;
    }
    addItem(dst, s.id, s.n);
    src[i] = null;
    this.moved = `${itemDef(s.id).name} x${s.n} to the ${from === 'chest' ? 'bag' : 'chest'}.`;
    session.events.emit('sfx', 'tick');
    session.events.emit('selected');
    this.paint();
  }

  override onKey(code: string): void {
    if (isBack(code)) { this.close(); return; }
    const g = this.focus === 'chest' ? this.chest : this.pack;
    const n = g.cells.length;
    if (!isConfirm(code)) this.moved = '';
    if (isLeft(code)) g.sel = (g.sel + n - 1) % n;
    else if (isRight(code)) g.sel = (g.sel + 1) % n;
    else if (isUp(code)) {
      if (g.sel - g.cols >= 0) g.sel -= g.cols;
      else if (this.focus === 'bag') { this.focus = 'chest'; this.chest.sel = Math.min(this.chest.cells.length - 1, (this.chest.rows - 1) * this.chest.cols + (g.sel % g.cols)); }
    } else if (isDown(code)) {
      if (g.sel + g.cols < n) g.sel += g.cols;
      else if (this.focus === 'chest') { this.focus = 'bag'; this.pack.sel = Math.min(this.pack.cells.length - 1, this.chest.sel % this.chest.cols); }
    } else if (isConfirm(code)) { this.move(this.focus, g.sel); return; }
    this.paint();
  }
}

// ------------------------------------------------------------------ the furnace

const clockText = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Feed ore and coal in, come back later for bars. */
export class FurnaceScreen extends Screen {
  private pane: ListPane | null = null;

  constructor(host: Host, private loc: string, private key: string) {
    super(host);
  }

  private get thing(): ThingState {
    const t = session.location(this.loc).things[this.key];
    if (!t) throw new Error('No furnace at ' + this.key);
    return t;
  }

  private entries(): Entry[] {
    const st = session.state;
    const t = this.thing;
    const state = furnaceState(st, t);
    if (t.job && state !== 'idle') {
      const d = itemDef(t.job.bar);
      const left = minutesLeft(st, t);
      return [{
        row: { text: `${t.job.n} ${d.name}`, icon: iconFor(st, t.job.bar), right: state === 'ready' ? 'Ready!' : clockText(left) },
        title: state === 'ready' ? 'All done' : 'Smelting',
        icon: iconFor(st, t.job.bar),
        lines: state === 'ready' ? ['The bars are cool enough to hold.'] : [`About ${clockText(left)} to go.`, 'You can walk away. It keeps working.'],
        actions: state === 'ready' ? [{
          label: 'Take them', kind: 'leaf', run: () => {
            const r = collectBars(st, t);
            session.events.emit('sfx', r.ok ? 'coin' : 'nope');
            return r.msg;
          },
        }] : [],
      }];
    }
    return SMELTS.map((s): Entry => {
      const n = batchFor(st, s);
      const ore = countItem(st.player.slots, s.ore);
      const coal = countItem(st.player.slots, 'coal');
      return {
        row: { text: itemDef(s.bar).name, icon: iconFor(st, s.bar), right: n > 0 ? `x${n}` : '', dim: n === 0 },
        title: itemDef(s.bar).name,
        icon: iconFor(st, s.bar),
        lines: [
          `${s.need} ${itemDef(s.ore).name} and 1 Coal make one bar.`,
          { t: itemDef(s.ore).name, need: { icon: iconFor(st, s.ore), have: ore, n: s.need } },
          { t: 'Coal', need: { icon: iconFor(st, 'coal'), have: coal, n: 1 } },
          n > 0 ? `Up to ${MAX_BATCH} at once. ${n} now takes ${clockText(n * s.minutes)}.` : 'Not enough yet.',
        ],
        actions: [{
          label: 'Smelt', kind: 'leaf', off: n === 0, run: () => {
            const r = startSmelt(st, t, s);
            session.events.emit('sfx', r.ok ? 'fire' : 'nope');
            if (r.ok) session.events.emit('selected');
            return r.msg;
          },
        }],
      };
    });
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const { p, row, style, area } = listPage(l, bag, 'Furnace', { wideH: 250, tallH: 480 }, 0, this.entries(), () => this.close());
    const body = this.own(new Bag(this.scene, bag.depth));
    this.pane = this.own(new ListPane(body, this.scene, area, p, () => this.entries(), undefined, row, style));
    this.pane.say = footer(bag, p);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}
