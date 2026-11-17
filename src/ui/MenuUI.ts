import Phaser from 'phaser';
import { BUNDLES } from '../data/bundles';
import type { BundleDef } from '../data/bundles';
import { itemDef } from '../data/items';
import { NPCS } from '../data/npcs';
import { RECIPES } from '../data/recipes';
import type { Recipe } from '../data/recipes';
import { PACE_REAL_MINUTES, dayOfSeason, seasonOf } from '../game/clock';
import type { PaceId } from '../game/clock';
import { available, donate, isComplete, progressOf, slotDone } from '../game/bundles';
import { have, make, plan } from '../game/crafting';
import { saveGame } from '../game/save';
import { session } from '../game/session';
import { settings, saveSettings } from '../game/settings';
import { friendOf, heartsOf } from '../game/social';
import { COL, iconFor } from './kit';
import { Screen, isBack, isConfirm, isDown, isLeft, isRight, isUp } from './Screens';
import { Bag, ListView, hearts } from './widgets';
import type { Row } from './widgets';
import { wrapText } from './DialogueUI';

export interface Line {
  t: string;
  tint?: number;
}

export interface Entry {
  row: Row;
  title: string;
  icon?: string;
  lines: (string | Line)[];
  actions?: { label: string; kind: 'leaf' | 'wood' | 'berry' | 'sky'; run: () => string | null }[];
  adjust?: (d: number) => void;
  extra?: (bag: Bag, x: number, y: number, w: number) => number;
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A list on one side and a card about the selected entry on the other. Shared by the menu pages. */
export class ListPane {
  private list: ListView;
  private info: Bag;
  private entries: Entry[] = [];
  private wide: boolean;
  private card: Area;
  say: (m: string) => void = () => undefined;

  constructor(bag: Bag, private scene: Phaser.Scene, a: Area, wide: boolean, private get: () => Entry[], private onChange: () => void = () => undefined) {
    this.wide = wide;
    const listW = wide ? Math.floor(a.w * 0.5) - 4 : a.w;
    const listH = wide ? a.h : Math.floor(a.h * 0.46);
    this.list = new ListView(bag, a.x, a.y, listW, listH, 17, (i) => this.pick(i, 0), () => this.paint(), false);
    this.card = wide ? { x: a.x + listW + 10, y: a.y, w: a.w - listW - 10, h: a.h } : { x: a.x, y: a.y + listH + 8, w: a.w, h: a.h - listH - 8 };
    this.info = new Bag(scene, bag.depth);
    this.refresh(true);
  }

  destroy(): void {
    this.list.destroy();
    this.info.destroy();
  }

  refresh(reset = false): void {
    this.entries = this.get();
    this.list.setRows(this.entries.map((e) => e.row), !reset);
    this.paint();
  }

  private pick(i: number, which: number): void {
    const a = this.entries[i]?.actions?.[which];
    if (!a) return;
    const m = a.run();
    if (m) this.say(m);
    this.onChange();
    this.refresh();
  }

  private paint(): void {
    const b = this.info;
    b.destroy();
    const e = this.entries[this.list.sel];
    if (!e) return;
    const { x, y, w, h } = this.card;
    let ty: number;
    if (e.icon) {
      b.img(x + 17, y + 17, e.icon).setScale(2);
      b.text(x + 38, y + 4, e.title, { wrap: w - 40 });
      ty = y + 38;
    } else {
      b.text(x + 2, y + 2, e.title, { wrap: w - 4 });
      ty = y + 16;
    }
    for (const ln of e.lines) {
      const line = typeof ln === 'string' ? { t: ln } : ln;
      const tx = b.text(x + 2, ty, wrapText(this.scene, line.t, w - 4), { tint: line.tint ?? COL.dim });
      ty += Math.ceil(tx.height) + 3;
    }
    if (e.extra) ty = e.extra(b, x + 2, ty + 1, w - 4);
    const acts = e.actions ?? [];
    const bw = Math.floor((w - 4 - (acts.length - 1) * 4) / Math.max(1, acts.length));
    const by = this.wide ? y + h - 18 : Math.min(y + h - 18, ty + 2);
    acts.forEach((a, i) => b.btn(x + 2 + i * (bw + 4), by, bw, a.label, a.kind, () => this.pick(this.list.sel, i)));
  }

  key(code: string, ev: KeyboardEvent): boolean {
    if (isUp(code)) this.list.move(-1);
    else if (isDown(code)) this.list.move(1);
    else if (isConfirm(code)) this.pick(this.list.sel, ev.shiftKey ? 1 : 0);
    else if (isLeft(code) && this.entries[this.list.sel]?.adjust) { (this.entries[this.list.sel] as Entry).adjust?.(-1); this.refresh(); }
    else if (isRight(code) && this.entries[this.list.sel]?.adjust) { (this.entries[this.list.sel] as Entry).adjust?.(1); this.refresh(); }
    else return false;
    return true;
  }
}

// ------------------------------------------------------------------ entries

export function recipeEntries(kind: Recipe['kind']): Entry[] {
  const st = session.state;
  const list = RECIPES.filter((r) => r.kind === kind && st.recipes.includes(r.id));
  return list.map((r): Entry => {
    const ok = r.ingredients.every((i) => plan(st.player.slots, i) !== null);
    return {
      row: { text: itemDef(r.makes).name, icon: iconFor(st, r.makes), dim: !ok, right: ok ? '' : '...' },
      title: r.name,
      icon: iconFor(st, r.makes),
      lines: [
        r.blurb,
        ...r.ingredients.map((i): Line => {
          const n = have(st.player.slots, i);
          return { t: `${i.label ?? itemDef(i.of.split('|')[0] as string).name}: ${Math.min(n, i.n)}/${i.n}`, tint: n >= i.n ? COL.leaf : COL.berry };
        }),
        ...(itemDef(r.makes).energy ? [`Restores ${itemDef(r.makes).energy} energy. Sells for ${itemDef(r.makes).sell}g.`] : []),
      ],
      actions: [{
        label: kind === 'cook' ? 'Cook' : 'Make', kind: 'leaf', run: () => {
          if (!ok) { session.events.emit('sfx', 'nope'); return 'Something is missing.'; }
          if (!make(st, r)) { session.events.emit('sfx', 'nope'); return 'Your bag is full.'; }
          session.events.emit('sfx', kind === 'cook' ? 'cook' : 'craft');
          return `Made ${itemDef(r.makes).name}.`;
        },
      }],
    };
  });
}

export function bundleEntries(canGive: boolean): Entry[] {
  const st = session.state;
  return BUNDLES.map((b: BundleDef): Entry => {
    const prog = progressOf(st, b);
    const done = isComplete(st, b);
    const got = b.slots.filter((_, i) => slotDone(st, b, i)).length;
    return {
      row: { text: b.name, right: done ? 'Lit' : `${got}/${b.slots.length}`, icon: done ? 'item/lantern' : undefined, tint: done ? COL.leaf : undefined },
      title: b.name,
      lines: [
        b.blurb,
        ...b.slots.map((s, i): Line => {
          const names = s.label || itemDef(s.any[0] as string).name;
          const d = slotDone(st, b, i);
          return { t: `${d ? '[x]' : '[ ]'} ${names} ${Math.min(prog[i] ?? 0, s.n)}/${s.n}`, tint: d ? COL.leaf : available(st, s) ? COL.gold : COL.dim };
        }),
        `Reward: ${b.reward.gold}g${b.reward.item ? ` and ${b.reward.item.n} ${itemDef(b.reward.item.id).name}` : ''}.`,
      ],
      actions: canGive && !done ? [{
        label: 'Give what fits', kind: 'leaf', run: () => {
          let any = false;
          let finished: BundleDef['reward'] | null = null;
          b.slots.forEach((_, i) => {
            const r = donate(st, b.id, i);
            if (r.gave > 0) any = true;
            if (r.completedNow) finished = r.reward;
          });
          if (!any) { session.events.emit('sfx', 'nope'); return 'You have nothing this bundle needs.'; }
          if (finished) {
            session.events.emit('sfx', 'lantern');
            session.events.emit('lantern', b.id);
            return `${b.name} is complete. A lantern lights!`;
          }
          session.events.emit('sfx', 'give');
          return 'Thank you. Every piece counts.';
        },
      }] : [],
    };
  });
}

const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;

export function friendEntries(): Entry[] {
  const st = session.state;
  return NPCS.map((n): Entry => {
    const f = friendOf(st, n.id);
    const h = heartsOf(f.points);
    const names = (ids: readonly string[]): string => ids.map((i) => (i === 'weed' ? 'Weeds' : itemDef(i).name)).join(', ');
    return {
      row: { text: f.met ? n.name : '???', right: f.met ? `${h}/10` : '', dim: !f.met },
      title: f.met ? n.name : 'Someone new',
      lines: f.met
        ? [n.role, `Birthday: ${SEASON_NAMES[n.birthday.season]} ${n.birthday.day}`, { t: `Loves: ${names(n.loves)}`, tint: COL.berry }, { t: `Likes: ${names(n.likes)}`, tint: COL.leaf }, f.talkedDay === st.day ? 'You have talked today.' : 'Talk once a day to grow closer.']
        : ['You have not met yet. Look around the village.'],
      extra: f.met ? (b, x, y) => { hearts(b, x, y, h); return y + 12; } : undefined,
    };
  });
}

const PACES: PaceId[] = ['relaxed', 'standard', 'brisk'];
const PACE_NAMES: Record<PaceId, string> = { relaxed: 'Relaxed', standard: 'Standard', brisk: 'Brisk' };

export function optionEntries(toTitle: () => void): Entry[] {
  const st = session.state;
  const pct = (v: number): string => `${Math.round(v * 10)}/10`;
  const slider = (name: string, key: 'music' | 'sfx', hint: string): Entry => ({
    row: { text: name, right: pct(settings[key]) },
    title: name,
    lines: [hint, 'Press left or right to change it.'],
    adjust: (d) => { settings[key] = Math.max(0, Math.min(1, Math.round((settings[key] + d * 0.1) * 10) / 10)); saveSettings(); session.events.emit('settings'); },
    actions: [
      { label: '-', kind: 'wood', run: () => { settings[key] = Math.max(0, Math.round((settings[key] - 0.1) * 10) / 10); saveSettings(); session.events.emit('settings'); return null; } },
      { label: '+', kind: 'leaf', run: () => { settings[key] = Math.min(1, Math.round((settings[key] + 0.1) * 10) / 10); saveSettings(); session.events.emit('settings'); return null; } },
    ],
  });
  return [
    slider('Music', 'music', 'How loud the music is.'),
    slider('Sounds', 'sfx', 'How loud the little sounds are.'),
    {
      row: { text: 'Day length', right: PACE_NAMES[st.pace] },
      title: 'Day length',
      lines: [`A day lasts about ${PACE_REAL_MINUTES[st.pace]} minutes.`, 'Relaxed gives you more time for everything. Brisk keeps things moving.'],
      adjust: (d) => { st.pace = PACES[(PACES.indexOf(st.pace) + d + 3) % 3] as PaceId; },
      actions: [{ label: 'Change', kind: 'leaf', run: () => { st.pace = PACES[(PACES.indexOf(st.pace) + 1) % 3] as PaceId; return null; } }],
    },
    {
      row: { text: 'Screen shake', right: settings.shake ? 'On' : 'Off' },
      title: 'Screen shake',
      lines: ['A tiny shudder when a tree falls.'],
      adjust: () => { settings.shake = !settings.shake; saveSettings(); },
      actions: [{ label: 'Toggle', kind: 'leaf', run: () => { settings.shake = !settings.shake; saveSettings(); return null; } }],
    },
    {
      row: { text: 'Save game' },
      title: 'Save game',
      lines: ['The game saves each night and whenever you walk through a door. You can also save now.'],
      actions: [{ label: 'Save now', kind: 'leaf', run: () => { saveGame(st); session.events.emit('sfx', 'tick'); return 'Saved.'; } }],
    },
    {
      row: { text: 'Back to title' },
      title: 'Back to title',
      lines: ['Your progress is saved first.'],
      actions: [{ label: 'Leave', kind: 'berry', run: () => { saveGame(st); toTitle(); return null; } }],
    },
  ];
}

// ------------------------------------------------------------------ the bag

class BagView {
  private sel = 0;
  private carry = -1;
  private cells: { bg: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText }[] = [];
  private cursor: Phaser.GameObjects.Image;
  private info: Bag;
  private cols: number;
  private ox: number;
  private oy: number;
  private infoY: number;

  constructor(bag: Bag, private scene: Phaser.Scene, a: Area, private say: (m: string) => void) {
    const slots = session.state.player.slots;
    this.cols = Math.max(5, Math.min(10, Math.floor((a.w - 4) / 21)));
    const pitch = 21;
    this.ox = a.x + Math.floor((a.w - this.cols * pitch) / 2) + 1;
    this.oy = a.y + 2;
    const rows = Math.ceil(slots.length / this.cols);
    this.infoY = this.oy + rows * pitch + 6;
    for (let i = 0; i < slots.length; i++) {
      const x = this.ox + (i % this.cols) * pitch;
      const y = this.oy + Math.floor(i / this.cols) * pitch;
      const bg = bag.img(x, y, i < 10 ? 'ui/slot' : 'ui/slot', [0, 0], 1);
      const icon = bag.img(x + 10, y + 10, 'item/stone').setVisible(false);
      const count = bag.text(x + 18, y + 12, '', { origin: [1, 0], outline: true, tint: COL.cream });
      bag.zone(x, y, 20, 20, () => this.tap(i));
      this.cells.push({ bg, icon, count });
    }
    this.cursor = bag.img(0, 0, 'ui/slot-sel', [0, 0], 3);
    this.info = new Bag(scene, bag.depth);
    this.width = a.w;
    this.ax = a.x;
    this.paint();
  }

  private width: number;
  private ax: number;

  destroy(): void {
    this.info.destroy();
  }

  private tap(i: number): void {
    this.sel = i;
    this.act();
  }

  private act(): void {
    const slots = session.state.player.slots;
    if (this.carry < 0) {
      if (slots[this.sel]) this.carry = this.sel;
    } else {
      const a = this.carry;
      const b = this.sel;
      if (a !== b) {
        const tmp = slots[a] ?? null;
        slots[a] = slots[b] ?? null;
        slots[b] = tmp;
        session.events.emit('sfx', 'tick');
      }
      this.carry = -1;
    }
    this.paint();
  }

  private eat(): void {
    const st = session.state;
    const s = st.player.slots[this.sel];
    if (!s) return;
    const d = itemDef(s.id);
    if (!d.energy) { this.say("That's not something you can eat."); return; }
    if (st.player.energy >= st.player.maxEnergy - 0.5) { this.say("You're not hungry right now."); return; }
    s.n -= 1;
    if (s.n <= 0) st.player.slots[this.sel] = null;
    st.player.energy = Math.min(st.player.maxEnergy, st.player.energy + d.energy);
    session.events.emit('sfx', 'eat');
    this.say(`Yum. +${d.energy} energy.`);
    this.paint();
  }

  paint(): void {
    const st = session.state;
    const slots = st.player.slots;
    this.cells.forEach((c, i) => {
      const s = slots[i];
      if (s) { c.icon.setFrame(iconFor(st, s.id)).setVisible(true); c.count.setText(s.n > 1 ? String(s.n) : ''); }
      else { c.icon.setVisible(false); c.count.setText(''); }
      c.bg.setAlpha(i === this.carry ? 0.55 : 1);
    });
    const pitch = 21;
    this.cursor.setPosition(this.ox + (this.sel % this.cols) * pitch - 2, this.oy + Math.floor(this.sel / this.cols) * pitch - 2);
    const b = this.info;
    b.destroy();
    const s = slots[this.sel];
    const x = this.ax + 6;
    if (s) {
      const d = itemDef(s.id);
      b.text(x, this.infoY, d.name, {});
      b.text(x, this.infoY + 12, wrapText(this.scene, d.blurb, this.width - 80), { tint: COL.dim });
      if (d.energy) b.btn(this.ax + this.width - 66, this.infoY, 60, 'Eat', 'leaf', () => this.eat());
      b.text(x, this.infoY + 38, this.carry >= 0 ? 'Choose where it goes.' : 'Select a stack, then another slot to swap.', { tint: COL.dim });
    } else {
      b.text(x, this.infoY, this.carry >= 0 ? 'Choose where it goes.' : 'An empty slot.', { tint: COL.dim });
    }
  }

  key(code: string): boolean {
    const n = session.state.player.slots.length;
    if (isLeft(code)) this.sel = (this.sel + n - 1) % n;
    else if (isRight(code)) this.sel = (this.sel + 1) % n;
    else if (isUp(code)) this.sel = this.sel - this.cols >= 0 ? this.sel - this.cols : this.sel;
    else if (isDown(code)) this.sel = this.sel + this.cols < n ? this.sel + this.cols : this.sel;
    else if (isConfirm(code)) { this.act(); return true; }
    else if (code === 'KeyF') { this.eat(); return true; }
    else return false;
    this.paint();
    return true;
  }
}

// ------------------------------------------------------------------ screens

type TabId = 'bag' | 'craft' | 'bundles' | 'friends' | 'options';
const TAB_NAMES: Record<TabId, string> = { bag: 'Bag', craft: 'Craft', bundles: 'Lanterns', friends: 'Friends', options: 'Options' };

export class MenuScreen extends Screen {
  private tab: TabId = 'bag';
  private body!: Bag;
  private pane: ListPane | null = null;
  private bagView: BagView | null = null;
  private msgText: Phaser.GameObjects.BitmapText | null = null;

  constructor(host: ConstructorParameters<typeof Screen>[0], private toTitle: () => void, start: TabId = 'bag') {
    super(host);
    this.tab = start;
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const wide = l.uiW >= 290;
    const w = Math.min(l.uiW - 8, 360);
    const h = Math.min(l.uiH - 8, wide ? 232 : 340);
    const x = Math.floor((l.uiW - w) / 2);
    const y = Math.floor((l.uiH - h) / 2);
    bag.panel(x, y, w, h);
    const st = session.state;
    bag.text(x + 12, y + 10, `${SEASON_NAMES[seasonOf(st.day)]} ${dayOfSeason(st.day)}`, {});
    bag.img(x + w - 54, y + 14, 'ui/coin');
    bag.text(x + w - 46, y + 11, `${st.player.gold}g`, { tint: COL.berry });
    bag.btn(x + w - 26, y + 6, 14, 'x', 'berry', () => this.close(), 14);

    const ids = Object.keys(TAB_NAMES) as TabId[];
    const tabW = Math.floor((w - 20 - (ids.length - 1) * 3) / ids.length);
    ids.forEach((id, i) => {
      bag.btn(x + 10 + i * (tabW + 3), y + 25, tabW, TAB_NAMES[id], id === this.tab ? 'leaf' : 'wood', () => this.setTab(id), 16);
    });

    this.body = this.own(new Bag(this.scene, bag.depth));
    const area = { x: x + 10, y: y + 47, w: w - 20, h: h - 47 - 18 };
    this.msgText = bag.text(x + w / 2, y + h - 12, '', { origin: [0.5, 0], tint: COL.ink });
    const say = (m: string): void => { this.msgText?.setText(m); };
    this.pane = null;
    this.bagView = null;
    if (this.tab === 'bag') this.bagView = this.own(new BagView(this.body, this.scene, area, say));
    else if (this.tab === 'craft') this.pane = this.own(new ListPane(this.body, this.scene, area, wide, () => recipeEntries('craft')));
    else if (this.tab === 'bundles') this.pane = this.own(new ListPane(this.body, this.scene, area, wide, () => bundleEntries(false)));
    else if (this.tab === 'friends') this.pane = this.own(new ListPane(this.body, this.scene, area, wide, () => friendEntries()));
    else this.pane = this.own(new ListPane(this.body, this.scene, area, wide, () => optionEntries(() => { this.close(); this.toTitle(); })));
    if (this.pane) this.pane.say = say;
  }

  private setTab(t: TabId): void {
    this.tab = t;
    this.relayout();
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    const ids = Object.keys(TAB_NAMES) as TabId[];
    if (isBack(code) || code === 'Tab' || code === 'KeyI') { ev.preventDefault(); this.close(); return; }
    if (code === 'KeyZ' || code === 'PageUp') { this.setTab(ids[(ids.indexOf(this.tab) + ids.length - 1) % ids.length] as TabId); return; }
    if (code === 'KeyC' || code === 'PageDown') { this.setTab(ids[(ids.indexOf(this.tab) + 1) % ids.length] as TabId); return; }
    if (this.bagView?.key(code)) return;
    this.pane?.key(code, ev);
  }
}

export class RecipeScreen extends Screen {
  private pane: ListPane | null = null;
  private msgText: Phaser.GameObjects.BitmapText | null = null;

  constructor(host: ConstructorParameters<typeof Screen>[0], private kind: Recipe['kind'], private title: string) {
    super(host);
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.45);
    const wide = l.uiW >= 290;
    const w = Math.min(l.uiW - 8, 340);
    const h = Math.min(l.uiH - 8, wide ? 200 : 300);
    const x = Math.floor((l.uiW - w) / 2);
    const y = Math.floor((l.uiH - h) / 2);
    bag.panel(x, y, w, h);
    bag.text(x + 12, y + 10, this.title, {});
    bag.btn(x + w - 26, y + 6, 14, 'x', 'berry', () => this.close(), 14);
    const body = this.own(new Bag(this.scene, bag.depth));
    this.msgText = bag.text(x + w / 2, y + h - 12, '', { origin: [0.5, 0] });
    const say = (m: string): void => { this.msgText?.setText(m); };
    this.pane = this.own(new ListPane(body, this.scene, { x: x + 10, y: y + 28, w: w - 20, h: h - 28 - 18 }, wide, () => recipeEntries(this.kind)));
    this.pane.say = say;
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}

export class ShrineScreen extends Screen {
  private pane: ListPane | null = null;
  private msgText: Phaser.GameObjects.BitmapText | null = null;
  private litText: Phaser.GameObjects.BitmapText | null = null;

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const wide = l.uiW >= 290;
    const w = Math.min(l.uiW - 8, 340);
    const h = Math.min(l.uiH - 8, wide ? 220 : 320);
    const x = Math.floor((l.uiW - w) / 2);
    const y = Math.floor((l.uiH - h) / 2);
    bag.panel(x, y, w, h);
    bag.text(x + 12, y + 10, 'The Lantern Shrine', {});
    bag.img(x + w - 64, y + 14, 'item/lantern');
    this.litText = bag.text(x + w - 56, y + 11, '', { tint: COL.gold });
    this.showLit();
    bag.btn(x + w - 26, y + 6, 14, 'x', 'berry', () => this.close(), 14);
    bag.text(x + 12, y + 25, 'Give what the valley gave you, and a lantern lights.', { tint: COL.dim, wrap: w - 24 });
    const body = this.own(new Bag(this.scene, bag.depth));
    this.msgText = bag.text(x + w / 2, y + h - 12, '', { origin: [0.5, 0] });
    const say = (m: string): void => { this.msgText?.setText(m); };
    this.pane = this.own(new ListPane(body, this.scene, { x: x + 10, y: y + 40, w: w - 20, h: h - 40 - 18 }, wide, () => bundleEntries(true), () => this.showLit()));
    this.pane.say = say;
  }

  private showLit(): void {
    const lit = BUNDLES.filter((b) => isComplete(session.state, b)).length;
    this.litText?.setText(`${lit}/${BUNDLES.length}`);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}

