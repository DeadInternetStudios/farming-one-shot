import Phaser from 'phaser';
import { BUNDLES } from '../data/bundles';
import type { BundleDef } from '../data/bundles';
import { cropOfSeed, itemDef } from '../data/items';
import { NPCS } from '../data/npcs';
import { RECIPES } from '../data/recipes';
import type { Recipe } from '../data/recipes';
import { getLayout, slotPitch, tapH } from '../display';
import type { Layout } from '../display';
import { BACKUP_ON, backupToFile, restoreFromFile } from '../features/backup/backup';
import { POSTCARD_ON } from '../features/postcard/layout';
import { PWA_ON, canInstall, install, isInstalled } from '../features/pwa/offline';
import { PACE_REAL_MINUTES } from '../game/clock';
import type { PaceId } from '../game/clock';
import { available, donate, isComplete, progressOf, slotDone } from '../game/bundles';
import { have, make, plan } from '../game/crafting';
import { weatherFor } from '../game/day';
import { nextGoal } from '../game/goals';
import { plantAdvice } from '../game/farming';
import { saveGame } from '../game/save';
import { session } from '../game/session';
import { settings, saveSettings } from '../game/settings';
import { friendOf, heartsOf } from '../game/social';
import type { GameState } from '../game/state';
import { LINE, bodyOf, cardHeight, cardStyle, chip, drawCard, footer, frameOf, paragraph, planTabs, popup, tabStrip } from './chrome';
import type { Area, CardSpec, CardStyle, Chip, Pop } from './chrome';
import { COL, WEATHER_NAMES, iconFor, wrapText } from './kit';
import { Screen, isBack, isConfirm, isDown, isLeft, isRight, isUp } from './Screens';
import { PAL } from '../gen/art';
import { Bag, ListView, hearts } from './widgets';
import type { Row } from './widgets';

export interface Line {
  t: string;
  tint?: number;
  need?: { icon: string; have: number; n: number };
}

export interface Entry {
  row: Row;
  title: string;
  icon?: string;
  lines: (string | Line)[];
  /** What a button does. It may answer later, as the file pickers do; the answer is what gets said. A button that is `off` looks switched off but still answers. */
  actions?: { label: string; kind: 'leaf' | 'wood' | 'berry' | 'sky'; off?: boolean; run: () => string | null | Promise<string | null> }[];
  adjust?: (d: number) => void;
  extra?: (bag: Bag, x: number, y: number, w: number) => number;
}

/** How a page is split between a list and the card about its selection, and how tall the page has to be to show both. */
export interface ListPlan {
  listW: number;
  listH: number;
  card: Area;
  need: number;
}

export function planList(scene: Phaser.Scene, a: Area, wide: boolean, entries: readonly Entry[], rowH: number, style: CardStyle): ListPlan {
  const listW = wide ? Math.floor(a.w * 0.5) - 4 : a.w;
  const cardW = wide ? a.w - listW - 10 : a.w;
  const cardH = Math.max(0, ...entries.map((e) => cardHeight(scene, cardW, e, rowH, style)));
  if (wide) {
    // side by side: the page is as tall as the longer of the two
    const need = Math.min(a.h, Math.max(Math.min(entries.length, Math.floor(a.h / rowH)) * rowH, cardH));
    const listH = Math.max(1, Math.floor(need / rowH)) * rowH;
    return { listW, listH, card: { x: a.x + listW + 10, y: a.y, w: cardW, h: need }, need };
  }
  // stacked: as many rows as there are entries, if the card still fits under them
  const rows = Math.max(1, Math.min(entries.length, Math.max(2, Math.floor((a.h - 8 - cardH) / rowH))));
  const listH = rows * rowH;
  const need = Math.min(a.h, listH + 8 + cardH);
  return { listW, listH, card: { x: a.x, y: a.y + listH + 8, w: a.w, h: Math.min(a.h - listH - 8, cardH) }, need };
}

/** A list on one side and a card about the selected entry on the other. Shared by the menu pages. */
export class ListPane {
  private list: ListView;
  private info: Bag;
  private entries: Entry[] = [];
  private card: Area;
  /** Set when the screen is torn down, which an action can do (taking a postcard closes the menu), so nothing paints after it. */
  private closed = false;
  say: (m: string, color?: number) => void = () => undefined;

  constructor(bag: Bag, scene: Phaser.Scene, a: Area, wide: boolean, private get: () => Entry[], private onChange: () => void = () => undefined, private rowH = 17, private style: CardStyle = { compact: true, pictures: true }) {
    const plan = planList(scene, a, wide, this.get(), rowH, style);
    this.list = new ListView(bag, a.x, a.y, plan.listW, plan.listH, rowH, (i) => this.pick(i, 0), () => this.paint(), false);
    this.card = plan.card;
    this.info = new Bag(scene, bag.depth);
    this.refresh(true);
  }

  destroy(): void {
    this.closed = true;
    this.list.destroy();
    this.info.destroy();
  }

  refresh(reset = false): void {
    if (this.closed) return;
    this.entries = this.get();
    this.list.setRows(this.entries.map((e) => e.row), !reset);
    this.paint();
  }

  private pick(i: number, which: number): void {
    const a = this.entries[i]?.actions?.[which];
    if (!a) return;
    const m = a.run();
    if (this.closed) return;
    // a button that was switched off can only be answering "no", and that reads in the warm red
    const tone = a.off ? COL.berry : undefined;
    if (typeof m === 'string') this.say(m, tone);
    else if (m) void m.then((late) => { if (this.closed) return; if (late) this.say(late, tone); this.refresh(); });
    this.onChange();
    this.refresh();
  }

  private paint(): void {
    if (this.closed) return;
    const b = this.info;
    b.destroy();
    const e = this.entries[this.list.sel];
    if (e) drawCard(b, this.card, e, this.rowH, this.style, (i) => this.pick(this.list.sel, i));
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

/** What a recipe still wants, in a sentence: "3 berries", "a crisp vegetable", "20 Wood". */
function needed(i: Recipe['ingredients'][number]): string {
  const first = i.of.split('|')[0] as string;
  if (!i.label) return `${i.n} ${itemDef(first).name}`;
  return i.label.startsWith('Any ') ? `${i.n} ${i.label.slice(4)}` : `${i.label.charAt(0).toLowerCase()}${i.label.slice(1)}`;
}

export function recipeEntries(kind: Recipe['kind']): Entry[] {
  const st = session.state;
  const list = RECIPES.filter((r) => r.kind === kind && st.recipes.includes(r.id));
  return list.map((r): Entry => {
    const missing = r.ingredients.find((i) => plan(st.player.slots, i) === null);
    const ok = !missing;
    const made = itemDef(r.makes);
    return {
      row: { text: made.name, icon: iconFor(st, r.makes), dim: !ok },
      title: r.name,
      icon: iconFor(st, r.makes),
      lines: [
        r.blurb,
        ...r.ingredients.map((i): Line => {
          const first = i.of.split('|')[0] as string;
          return { t: i.label ?? itemDef(first).name, need: { icon: iconFor(st, first), have: have(st.player.slots, i), n: i.n } };
        }),
        ...(made.energy ? [`Restores ${made.energy} energy. Sells for ${made.sell}g.`] : []),
      ],
      actions: [{
        label: kind === 'cook' ? 'Cook' : 'Make', kind: 'leaf', off: !ok, run: () => {
          if (missing) { session.events.emit('sfx', 'nope'); return `You need ${needed(missing)}.`; }
          if (!make(st, r)) { session.events.emit('sfx', 'nope'); return 'Your bag is full.'; }
          session.events.emit('sfx', kind === 'cook' ? 'cook' : 'craft');
          return `Made ${made.name}.`;
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
        ...b.slots.map((s, i): Line => ({
          t: s.label || itemDef(s.any[0] as string).name,
          need: { icon: iconFor(st, s.any[0] as string), have: Math.min(prog[i] ?? 0, s.n), n: s.n },
        })),
        `Reward: ${b.reward.gold}g${b.reward.item ? ` and ${b.reward.item.n} ${itemDef(b.reward.item.id).name}` : ''}.`,
      ],
      actions: canGive && !done ? [{
        label: 'Give what fits', kind: 'leaf', off: !b.slots.some((sl, i) => !slotDone(st, b, i) && available(st, sl)), run: () => {
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
  const names = (ids: readonly string[]): string => ids.map((i) => (i === 'weed' ? 'Weeds' : itemDef(i).name)).join(', ');
  const met = NPCS.filter((n) => friendOf(st, n.id).met);
  const out = met.map((n): Entry => {
    const f = friendOf(st, n.id);
    const h = heartsOf(f.points);
    return {
      row: { text: n.name, right: `${h}/10` },
      title: n.name,
      lines: [n.role, `Birthday: ${SEASON_NAMES[n.birthday.season]} ${n.birthday.day}`, { t: `Loves: ${names(n.loves)}`, tint: COL.berry }, { t: `Likes: ${names(n.likes)}`, tint: COL.leaf }, f.talkedDay === st.day ? 'You have talked today.' : 'Talk once a day to grow closer.'],
      extra: (b, x, y) => { hearts(b, x, y, h); return y + 12; },
    };
  });
  const unmet = NPCS.length - met.length;
  if (unmet > 0) {
    out.push({
      row: { text: met.length === 0 ? 'Say hello' : unmet === 1 ? 'One more to meet' : `${unmet} more to meet`, dim: true, empty: met.length === 0 },
      title: met.length === 0 ? 'You are new here' : 'Someone new',
      lines: [met.length === 0 ? 'Nobody knows your name yet. Walk into the village and say hello to the first person you see.' : `${unmet === 1 ? 'One neighbour is' : `${unmet} neighbours are`} still waiting to meet you. Look around the village.`],
    });
  }
  return out;
}

/** Settings that make the game easier on the eyes and hands. */
function accessEntries(): Entry[] {
  const toggle = (key: 'calm' | 'lefty'): void => { settings[key] = !settings[key]; saveSettings(); session.events.emit('settings'); };
  const out: Entry[] = [
    {
      row: { text: 'Calm motion', right: settings.calm ? 'On' : 'Off' },
      title: 'Calm motion',
      lines: ['Fewer drifting specks, steady lantern light, no lightning flashes and no screen shake.', 'It starts on when your device asks for reduced motion.'],
      adjust: () => toggle('calm'),
      actions: [{ label: 'Toggle', kind: 'leaf', run: () => { toggle('calm'); return null; } }],
    },
  ];
  if (getLayout().touch) {
    out.push({
      row: { text: 'Controls side', right: settings.lefty ? 'Left hand' : 'Right hand' },
      title: 'Controls side',
      lines: ['Right-handed: the stick on the left, the action button on the right. Left-handed: the other way round.'],
      adjust: () => toggle('lefty'),
      actions: [{ label: 'Swap sides', kind: 'leaf', run: () => { toggle('lefty'); return null; } }],
    });
  }
  return out;
}

/** A photo of the valley, made into a card. The menu closes first so it is the valley and not the menu in the picture. */
function postcardEntry(closeMenu: () => void): Entry {
  return {
    row: { text: 'Take a postcard' },
    title: 'Take a postcard',
    lines: ['Photographs where you stand. Keep the postcard or send it.', ...(getLayout().touch ? [] : ['On a keyboard you can also press P.'])],
    actions: [{ label: 'Take it', kind: 'leaf', run: () => { closeMenu(); session.events.emit('postcard'); return null; } }],
  };
}

/** Installing the game, and carrying a save from one device to another. */
function appEntries(st: GameState): Entry[] {
  const out: Entry[] = [];
  if (PWA_ON && !isInstalled() && canInstall()) {
    out.push({
      row: { text: 'Install the game' },
      title: 'Install the game',
      lines: ['Put Lantern Hollow on your home screen. It opens full screen and plays with no connection.'],
      actions: [{ label: 'Install', kind: 'leaf', run: () => install().then((ok) => (ok ? 'Installed. Look for the lantern.' : 'Maybe another time.')) }],
    });
  }
  if (BACKUP_ON) {
    out.push(
      {
        row: { text: 'Back up your farm' },
        title: 'Back up your farm',
        lines: ['Saves a file with your whole farm in it. Keep it safe, or move your game to another device.'],
        actions: [{ label: 'Save a file', kind: 'leaf', run: () => backupToFile(st) }],
      },
      {
        row: { text: 'Restore a backup' },
        title: 'Restore a backup',
        lines: ['Pick a backup file. It replaces the game on this device, and the game restarts from it.'],
        actions: [{ label: 'Choose a file', kind: 'wood', run: () => restoreFromFile() }],
      },
    );
  }
  return out;
}

const PACES: PaceId[] = ['relaxed', 'standard', 'brisk'];
const PACE_NAMES: Record<PaceId, string> = { relaxed: 'Relaxed', standard: 'Standard', brisk: 'Brisk' };

export function optionEntries(toTitle: () => void, closeMenu: () => void): Entry[] {
  const st = session.state;
  const pct = (v: number): string => `${Math.round(v * 10)}/10`;
  const slider = (name: string, key: 'music' | 'sfx', hint: string): Entry => ({
    row: { text: name, right: pct(settings[key]) },
    title: name,
    lines: [hint, getLayout().touch ? 'Tap - or + to change it.' : 'Press left or right to change it.'],
    adjust: (d) => { settings[key] = Math.max(0, Math.min(1, Math.round((settings[key] + d * 0.1) * 10) / 10)); saveSettings(); session.events.emit('settings'); },
    actions: [
      { label: '-', kind: 'wood', off: settings[key] <= 0, run: () => { settings[key] = Math.max(0, Math.round((settings[key] - 0.1) * 10) / 10); saveSettings(); session.events.emit('settings'); return null; } },
      { label: '+', kind: 'wood', off: settings[key] >= 1, run: () => { settings[key] = Math.min(1, Math.round((settings[key] + 0.1) * 10) / 10); saveSettings(); session.events.emit('settings'); return null; } },
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
    ...accessEntries(),
    ...(POSTCARD_ON ? [postcardEntry(closeMenu)] : []),
    ...appEntries(st),
    {
      row: { text: 'Save game' },
      title: 'Save game',
      lines: ['The game saves each night and whenever you walk through a door. You can also save now.'],
      actions: [{ label: 'Save now', kind: 'leaf', run: () => { saveGame(st); session.events.emit('sfx', 'tick'); return 'Saved.'; } }],
    },
    {
      row: { text: 'Back to title' },
      title: 'Back to title',
      lines: ['The game saves your progress first.'],
      actions: [{ label: 'Leave', kind: 'berry', run: () => { saveGame(st); toTitle(); return null; } }],
    },
  ];
}

// ------------------------------------------------------------------ the bag

/** What the card says about a stack, or an empty slot. */
function bagCard(s: { id: string; n: number } | null): CardSpec {
  if (!s) return { title: 'An empty slot', lines: ['Nothing here yet.'] };
  const d = itemDef(s.id);
  const crop = cropOfSeed(s.id);
  return { title: d.name, lines: [crop ? `${d.blurb} ${plantAdvice(crop.id, session.state.day)}` : d.blurb], actions: d.energy ? [{ label: 'Eat', kind: 'leaf' }] : [] };
}

const SWAP_HINT = 'Tap a stack, then another slot to swap them.';

class BagView {
  private sel = 0;
  private carry = -1;
  private cells: { bg: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText }[] = [];
  private cursor: Phaser.GameObjects.Image;
  private info: Bag;
  private cols: number;
  private ox: number;
  private oy: number;
  /** Where the card about the selected stack goes: under the grid, or beside it when the page is too short for that. */
  private box: Area;

  /** How tall the bag page is with the card under the grid: the grid, the tallest card, and the two lines about today. */
  static need(scene: Phaser.Scene, w: number, pitch: number, btnH: number, style: CardStyle): number {
    const st = session.state;
    const slots = st.player.slots;
    const goal = nextGoal(st);
    const next = wrapText(scene, goal ? `Next: ${goal.text}` : 'Nothing is pressing. Enjoy the valley.', w - 18).split('\n').slice(0, 2);
    const todayH = next.length * LINE + 5 + LINE;
    const cols = Math.max(5, Math.min(10, Math.floor((w - 4) / pitch)));
    const card = Math.max(...slots.map((s) => cardHeight(scene, w, bagCard(s), btnH, style)), cardHeight(scene, w, bagCard(null), btnH, style));
    return 2 + Math.ceil(slots.length / cols) * pitch + 4 + card + 10 + todayH;
  }

  constructor(bag: Bag, scene: Phaser.Scene, a: Area, private say: (m: string) => void, private pitch: number, private btnH: number, private style: CardStyle) {
    const slots = session.state.player.slots;
    const st = session.state;
    const goal = nextGoal(st);
    const next = wrapText(scene, goal ? `Next: ${goal.text}` : 'Nothing is pressing. Enjoy the valley.', a.w - 18).split('\n').slice(0, 2);
    const todayH = next.length * LINE + 5 + LINE;
    const below = (cols: number): number => a.h - 5 - todayH - 8 - Math.ceil(slots.length / cols) * pitch;
    const stacked = Math.max(5, Math.min(10, Math.floor((a.w - 4) / pitch)));
    // under the grid there should be room for a name and a few lines; if not, the card goes beside the grid
    const beside = below(stacked) < 4 * LINE + btnH && a.w >= 260;
    this.cols = beside ? Math.max(4, Math.min(10, Math.floor((a.w - 120) / pitch))) : stacked;
    this.ox = a.x + (beside ? 2 : Math.floor((a.w - this.cols * pitch) / 2) + 1);
    this.oy = a.y + 2;
    const gridH = Math.ceil(slots.length / this.cols) * pitch;
    let todayTop = a.y + a.h - todayH;
    if (beside) {
      this.box = { x: this.ox + this.cols * pitch + 8, y: a.y, w: a.x + a.w - (this.ox + this.cols * pitch + 8), h: todayTop - 5 - a.y };
    } else {
      // on a tall page the card is only as tall as its tallest stack needs, and the today lines follow it
      const top = this.oy + gridH + 4;
      const need = Math.max(...slots.map((s) => cardHeight(scene, a.w, bagCard(s), btnH, style)), cardHeight(scene, a.w, bagCard(null), btnH, style));
      const h = Math.min(todayTop - 5 - top, need);
      this.box = { x: a.x, y: top, w: a.w, h };
      todayTop = top + h + 10;
    }
    for (let i = 0; i < slots.length; i++) {
      const x = this.ox + (i % this.cols) * pitch;
      const y = this.oy + Math.floor(i / this.cols) * pitch;
      const bg = bag.img(x, y, 'ui/slot', [0, 0], 1);
      const icon = bag.img(x + 10, y + 10, 'item/stone').setVisible(false);
      const count = bag.text(x + 18, y + 12, '', { origin: [1, 0], outline: true, tint: COL.cream });
      bag.zone(x, y, pitch, pitch, () => this.tap(i));
      this.cells.push({ bg, icon, count });
    }
    this.cursor = bag.img(0, 0, 'ui/slot-sel', [0, 0], 3);
    this.drawToday(bag, a, todayTop, next);
    this.info = new Bag(scene, bag.depth);
    this.paint();
    say(SWAP_HINT);
  }

  /** What to do next and what the weather does tomorrow: the two things worth a glance before closing the bag. */
  private drawToday(bag: Bag, a: Area, top: number, next: string[]): void {
    const st = session.state;
    const x = a.x + 2;
    const rain = weatherFor(st.seed, st.day + 1);
    const outlook = `Tomorrow is ${WEATHER_NAMES[rain].toLowerCase()}${rain === 'rain' || rain === 'storm' ? '. No need to water.' : '.'}`;
    bag.rect(a.x + 2, top - 5, a.w - 4, 1, PAL.wood[1], 0.35, 2);
    bag.img(x + 4, top + 5, 'ui/arrow-right').setTint(COL.berry);
    bag.text(x + 15, top, next.join('\n'), { tint: COL.ink });
    const wy = top + next.length * LINE + 5;
    bag.img(x + 5, wy + 5, `ui/weather-${rain}`);
    bag.text(x + 15, wy, outlook, { tint: COL.dim });
  }

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
      if (slots[this.sel]) { this.carry = this.sel; this.say('Now tap where it goes.'); }
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
      this.say(SWAP_HINT);
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
    const pitch = this.pitch;
    this.cursor.setPosition(this.ox + (this.sel % this.cols) * pitch - 2, this.oy + Math.floor(this.sel / this.cols) * pitch - 2);
    const b = this.info;
    b.destroy();
    const s = slots[this.sel];
    drawCard(b, this.box, bagCard(s ?? null), this.btnH, this.style, () => this.eat());
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
const TAB_ICONS: Record<TabId, string> = { bag: 'ui/tab-bag', craft: 'ui/tab-craft', bundles: 'ui/tab-lantern', friends: 'ui/tab-friends', options: 'ui/tab-options' };
const TABS = (Object.keys(TAB_NAMES) as TabId[]).map((id) => ({ id, label: TAB_NAMES[id], icon: TAB_ICONS[id] }));

const MENU_FRAME = { wideH: 270, tallH: 480, maxW: 360 } as const;

export class MenuScreen extends Screen {
  private tab: TabId = 'bag';
  private body!: Bag;
  private pane: ListPane | null = null;
  private bagView: BagView | null = null;

  constructor(host: ConstructorParameters<typeof Screen>[0], private toTitle: () => void, start: TabId = 'bag') {
    super(host);
    this.tab = start;
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const f = frameOf(l, MENU_FRAME);
    const tabs = planTabs(this.scene, l, f.inner, TABS, this.tab);
    const row = tapH(l);
    const style = cardStyle(l, f.wide);
    // each page is as tall as its content; the frame hangs from the top the tallest page would give it, so the tabs never move
    const room: Area = { x: 0, y: 0, w: f.inner, h: f.maxBody - 2 - tabs.h - 5 };
    const need = (e: Entry[]): number => planList(this.scene, room, f.wide, e, row, style).need;
    const pages: Record<TabId, number> = {
      bag: BagView.need(this.scene, room.w, slotPitch(l), row, style),
      craft: need(recipeEntries('craft')),
      bundles: need(bundleEntries(false)),
      friends: need(friendEntries()),
      options: need(optionEntries(() => undefined, () => undefined)),
    };
    const chrome = 2 + tabs.h + 5;
    const p = popup(bag, l, { title: TAB_NAMES[this.tab], ...MENU_FRAME, body: chrome + Math.min(room.h, pages[this.tab]), hold: chrome + Math.min(room.h, Math.max(...Object.values(pages))), close: () => this.close() });
    const strip = tabStrip(bag, p, p.top + 2, tabs, TABS, this.tab, (id) => this.setTab(id));
    const area = bodyOf(p, strip.bottom + 5);
    const say = footer(bag, p);
    this.markPage();
    this.body = this.own(new Bag(this.scene, bag.depth));
    this.pane = null;
    this.bagView = null;
    const pane = (get: () => Entry[]): ListPane => this.own(new ListPane(this.body, this.scene, area, p.wide, get, undefined, row, style));
    if (this.tab === 'bag') this.bagView = this.own(new BagView(this.body, this.scene, area, say, slotPitch(l), row, style));
    else if (this.tab === 'craft') this.pane = pane(() => recipeEntries('craft'));
    else if (this.tab === 'bundles') this.pane = pane(() => bundleEntries(false));
    else if (this.tab === 'friends') this.pane = pane(() => friendEntries());
    else this.pane = pane(() => optionEntries(() => { this.close(); this.toTitle(); }, () => this.close()));
    if (this.pane) this.pane.say = say;
  }

  private setTab(t: TabId): void {
    this.tab = t;
    this.relayout(true);
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

const LIST_FRAME = { wideH: 250, tallH: 480 } as const;

/** A frame sized to its list: as many rows as there are entries, and the tallest card. */
export function listPage(l: Layout, bag: Bag, title: string, frame: { wideH: number; tallH: number }, above: number, entries: Entry[], close: () => void, speaks = true): { p: Pop; row: number; style: CardStyle; area: Area } {
  const f = frameOf(l, { ...frame, speaks });
  const row = tapH(l);
  const style = cardStyle(l, f.wide);
  const room: Area = { x: 0, y: 0, w: f.inner, h: f.maxBody - above - 5 };
  const need = planList(bag.scene, room, f.wide, entries, row, style).need;
  const p = popup(bag, l, { title, ...frame, speaks, body: above + 5 + need, close });
  return { p, row, style, area: bodyOf(p, p.top + above + 5, speaks) };
}

export class RecipeScreen extends Screen {
  private pane: ListPane | null = null;

  constructor(host: ConstructorParameters<typeof Screen>[0], private kind: Recipe['kind'], private title: string) {
    super(host);
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.45);
    const { p, row, style, area } = listPage(l, bag, this.title, LIST_FRAME, 0, recipeEntries(this.kind), () => this.close());
    const body = this.own(new Bag(this.scene, bag.depth));
    this.pane = this.own(new ListPane(body, this.scene, area, p.wide, () => recipeEntries(this.kind), undefined, row, style));
    this.pane.say = footer(bag, p);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}

const SHRINE_TEXT = 'Give what the valley gave you, and a lantern lights.';

export class ShrineScreen extends Screen {
  private pane: ListPane | null = null;
  private lit: Chip | null = null;

  build(): void {
    const { l, bag } = this;
    this.dim(0.5);
    const frame = { wideH: 270, tallH: 480 };
    const f = frameOf(l, frame);
    // on a short screen the card about the lantern matters more than the line of flavour above the list
    const lines = f.maxBody >= 250 ? Math.min(2, wrapText(this.scene, SHRINE_TEXT, f.w - 24).split('\n').length) : 0;
    const above = lines > 0 ? 2 + lines * LINE : 0;
    const { p, row, style, area } = listPage(l, bag, 'Lantern Shrine', frame, above, bundleEntries(true), () => this.close());
    this.lit = chip(bag, p, 'item/lantern', 14, COL.ink, '');
    this.showLit();
    if (lines > 0) paragraph(bag, p.x + 12, p.top + 2, p.w - 24, lines * LINE, SHRINE_TEXT);
    const body = this.own(new Bag(this.scene, bag.depth));
    this.pane = this.own(new ListPane(body, this.scene, area, p.wide, () => bundleEntries(true), () => this.showLit(), row, style));
    this.pane.say = footer(bag, p);
  }

  private showLit(): void {
    const lit = BUNDLES.filter((b) => isComplete(session.state, b)).length;
    this.lit?.set(`${lit}/${BUNDLES.length}`);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else this.pane?.key(code, ev);
  }
}
