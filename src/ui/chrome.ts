import type Phaser from 'phaser';
import { tapH, type Layout } from '../display';
import { COL, label, wrapText } from './kit';
import { EASE, MS, pop } from './motion';
import { settings } from '../game/settings';
import type { Bag } from './widgets';

/**
 * The parts every pop-up shares: the frame, the title bar with its close button, the tab strip,
 * the card about the selected row and the message line at the foot. Each screen picks its size and
 * fills the body, so a shop, a chest and the menu all start, end and answer in the same places.
 */

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The bitmap font's line height. */
export const LINE = 11;
const PAD = 10;
const GAP = 3;

export interface Pop extends Area {
  /** The title text, in case the page below decides what it should say. */
  title: Phaser.GameObjects.BitmapText;
  /** Room for a list beside its card. */
  wide: boolean;
  /** Left edge of the close button. */
  closeX: number;
  /** Where the title text sits. */
  titleY: number;
  /** First free y under the title bar. */
  top: number;
  /** Where the message line starts, and how many lines it may use. */
  foot: number;
  lines: number;
  /** Makes the frame as tall as a page of `body` needs, within what the frame may be. The top stays where it is. */
  fit(body: number): void;
  /** Runs `move` whenever the frame changes height, for anything pinned to its bottom. */
  follow(move: () => void): void;
}

export interface PopupOpts {
  title: string;
  wideH: number;
  tallH: number;
  maxW?: number;
  /** How much room the page needs under the title bar and above the message line. The pop-up is that tall, or as tall as it may be. */
  body?: number;
  /** The body of the tallest page this pop-up will ever show. The frame hangs from the top it would have at that height, so its title and tabs stay put when a shorter page replaces a taller one. */
  hold?: number;
  /** False for pages with no message line. */
  speaks?: boolean;
  close: () => void;
}

/** What a pop-up's frame leaves for its page, known before anything is drawn so a page can size itself to its content. */
export interface Frame {
  w: number;
  wide: boolean;
  /** Frame height at the most. */
  maxH: number;
  /** Width of the page inside the frame. */
  inner: number;
  /** Title bar and message line together: everything in the frame that is not the page. */
  chrome: number;
  /** The tallest page this frame can hold. */
  maxBody: number;
  /** Where the title bar ends, from the top of the frame. */
  head: number;
}

export function frameOf(l: Layout, o: Pick<PopupOpts, 'wideH' | 'tallH' | 'maxW' | 'speaks'>): Frame {
  const wide = l.uiW >= 290;
  const w = Math.min(l.uiW - 8, o.maxW ?? 340);
  const maxH = Math.min(l.uiH - 8, wide ? o.wideH : o.tallH);
  const size = l.touch ? tapH(l) : 14;
  const head = (l.touch ? 5 : 6) + size + (l.touch ? 4 : 3);
  const chrome = head + (o.speaks === false ? 9 : 11 + (wide ? 1 : 2) * LINE);
  return { w, wide, maxH, inner: w - 2 * PAD, chrome, maxBody: maxH - chrome, head };
}

/** Panel, title and close button, centred on the screen. */
export function popup(bag: Bag, l: Layout, o: PopupOpts): Pop {
  const f = frameOf(l, o);
  const { wide, w } = f;
  const h = o.body === undefined ? f.maxH : Math.min(f.maxH, f.chrome + o.body);
  const x = Math.floor((l.uiW - w) / 2);
  const y = Math.floor((l.uiH - Math.max(h, o.hold === undefined ? 0 : Math.min(f.maxH, f.chrome + o.hold))) / 2);
  const panel = bag.panel(x, y, w, h);
  const size = l.touch ? tapH(l) : 14;
  const closeX = x + w - size - 11;
  const cy = y + (l.touch ? 5 : 6);
  bag.btn(closeX, cy, size, 'x', 'berry', o.close, size);
  const titleY = cy + Math.floor((size - 9) / 2) + 2;
  const title = bag.text(x + 12, titleY, o.title, {});
  const lines = wide ? 1 : 2;
  const moves: (() => void)[] = [];
  const p: Pop = {
    x, y, w, h, title, wide, closeX, titleY, top: y + f.head, foot: y + h - 7 - lines * LINE, lines,
    fit: (body) => {
      const to = Math.min(f.maxH, f.chrome + body);
      if (to === p.h) return;
      p.h = to;
      p.foot = y + to - 7 - lines * LINE;
      panel.setSize(w, to);
      for (const move of moves) move();
    },
    follow: (move) => { moves.push(move); },
  };
  return p;
}

/** The part of a pop-up between `top` and the message line, or the bottom edge for pages that never speak. */
export const bodyOf = (p: Pop, top: number, speaks = true): Area => ({ x: p.x + PAD, y: top, w: p.w - 2 * PAD, h: (speaks ? p.foot - 4 : p.y + p.h - 9) - top });

/** A small icon and a number to the left of the close button: gold, or lanterns lit. */
export interface Chip {
  set(text: string): void;
}

export function chip(bag: Bag, p: Pop, icon: string, iconW: number, tint: number, text: string): Chip {
  const right = p.closeX - 8;
  const t = bag.text(right, p.titleY, text, { origin: [1, 0], tint });
  const pic = bag.img(0, p.titleY + 4, icon);
  const place = (): void => { pic.setX(Math.round(right - t.width - 3 - iconW / 2)); };
  place();
  // a long title (a shop's name) gives way to the chip instead of running under it
  p.title.setText(ellipsize(bag.scene, p.title.text, Math.round(right - t.width - 3 - iconW) - 8 - p.title.x));
  let shown = text;
  return {
    set: (s) => {
      t.setText(s);
      place();
      // the number someone is spending or earning nudges when it changes
      if (s !== shown) pop(bag.scene, t);
      shown = s;
    },
  };
}

/** The line at the foot of a pop-up that answers what you just did. Long answers wrap, and are cut with dots if they still do not fit. */
export function footer(bag: Bag, p: Pop, tint: number = COL.ink): (m: string, color?: number) => void {
  const t = bag.text(p.x + p.w / 2, p.foot, '', { origin: [0.5, 0], tint, align: 'center' });
  p.follow(() => { t.setY(p.foot); });
  const room = p.w - 24;
  return (m, color) => {
    const all = wrapText(bag.scene, m, room).split('\n');
    const shown = all.slice(0, p.lines);
    if (all.length > p.lines) shown[p.lines - 1] = clip(bag.scene, shown[p.lines - 1] ?? '', room);
    t.setText(shown.join('\n')).setTint(color ?? tint);
    // a new answer eases in, so a second purchase of the same thing still reads as a second answer
    if (m && !settings.calm) {
      bag.scene.tweens.killTweensOf(t);
      t.setAlpha(0);
      bag.scene.tweens.add({ targets: t, alpha: 1, duration: MS.quick, ease: EASE });
    }
  };
}

/** Shortens text until it and three dots fit. */
export function clip(scene: Phaser.Scene, s: string, maxW: number): string {
  const probe = label(scene, 0, 0, '').setVisible(false);
  let t = s;
  while (t.length > 1) {
    probe.setText(`${t.trimEnd()}...`);
    if (probe.width <= maxW) break;
    t = t.slice(0, -1);
  }
  probe.destroy();
  return `${t.trimEnd()}...`;
}

/** The text itself if it fits in `maxW`, otherwise cut with dots. */
export function ellipsize(scene: Phaser.Scene, s: string, maxW: number): string {
  const probe = label(scene, 0, 0, s).setVisible(false);
  const fits = probe.width <= maxW;
  probe.destroy();
  return fits ? s : clip(scene, s, maxW);
}

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  icon?: string;
}

/** How a row of tabs is laid out: names beside the icons, names under them, the name on the chosen tab only, or icons alone. */
export interface TabPlan {
  mode: 'beside' | 'under' | 'active' | 'icons';
  widths: number[];
  h: number;
  /** The names are on the tabs, so the page title does not have to say which page this is. */
  labelled: boolean;
}

/**
 * Chooses how to fit the tabs in `inner` pixels, from roomiest to tightest: icon and name side by side,
 * the name under a smaller icon, the name on the chosen tab alone while the rest shrink to icons that are still a fingertip wide,
 * or icons alone. Tabs never overlap, and every one is at least a fingertip tall on touch.
 */
export function planTabs<T extends string>(scene: Phaser.Scene, l: Layout, inner: number, specs: readonly TabSpec<T>[], active?: T): TabPlan {
  const base = l.touch ? tapH(l) : 16;
  const probe = label(scene, 0, 0, '').setVisible(false);
  const names = specs.map((s) => {
    probe.setText(s.label);
    return Math.ceil(probe.width);
  });
  probe.destroy();
  const n = specs.length;
  const iconic = specs.every((s) => s.icon);
  const spread = (need: number[], gap: number): number[] => {
    const room = inner - gap * (n - 1) - need.reduce((a, v) => a + v, 0);
    const each = Math.floor(room / n);
    return need.map((v) => v + each);
  };
  const side = names.map((w, i) => w + (specs[i]?.icon ? 15 : 0) + 10);
  const sideTotal = side.reduce((a, v) => a + v, 0) + GAP * (n - 1);
  if (sideTotal <= inner) return { mode: 'beside', widths: spread(side, GAP), h: base, labelled: true };
  if (!iconic) {
    const gaps = GAP * (n - 1);
    return { mode: 'beside', widths: side.map((v) => Math.floor((v * (inner - gaps)) / (sideTotal - gaps))), h: base, labelled: true };
  }
  const under = names.map((w) => Math.max(w, 14) + 4);
  const underTotal = under.reduce((a, v) => a + v, 0) + 2 * (n - 1);
  if (underTotal <= inner) return { mode: 'under', widths: spread(under, 2), h: Math.max(base, 27), labelled: true };
  // the chosen tab wears its name; the others keep a fingertip each. Whether this fits is judged by the longest name, so the mode does not change as you switch tabs.
  const finger = l.touch ? base : 18;
  const wear = names.map((w) => w + 15 + 8);
  const gaps2 = 2 * (n - 1);
  if (Math.max(...wear) + (n - 1) * finger + gaps2 <= inner) {
    const on = Math.max(0, specs.findIndex((t) => t.id === active));
    const each = Math.floor((inner - gaps2 - (wear[on] as number)) / (n - 1));
    return { mode: 'active', widths: specs.map((_, i) => (i === on ? (wear[on] as number) : each)), h: base, labelled: true };
  }
  return { mode: 'icons', widths: specs.map(() => Math.floor((inner - GAP * (n - 1)) / n)), h: base, labelled: false };
}

/** Draws the tabs the plan describes, starting at `y`. */
export function tabStrip<T extends string>(bag: Bag, p: Pop, y: number, plan: TabPlan, specs: readonly TabSpec<T>[], active: T, pick: (id: T) => void): { bottom: number } {
  const gap = plan.mode === 'under' || plan.mode === 'active' ? 2 : GAP;
  const used = plan.widths.reduce((a, v) => a + v, 0) + gap * (specs.length - 1);
  let tx = p.x + PAD + Math.floor((p.w - 2 * PAD - used) / 2);
  specs.forEach((s, i) => {
    const w = plan.widths[i] ?? 0;
    const kind = s.id === active ? 'leaf' : 'wood';
    if (plan.mode === 'under') {
      bag.btn(tx, y, w, '', kind, () => pick(s.id), plan.h);
      if (s.icon) bag.img(tx + w / 2, y + 9, s.icon, [0.5, 0.5], 5);
      bag.add(label(bag.scene, tx + w / 2, y + plan.h - 11, s.label, { outline: true, origin: [0.5, 0] }), 5);
    } else {
      const named = plan.mode === 'beside' || (plan.mode === 'active' && s.id === active);
      bag.btn(tx, y, w, named ? s.label : '', kind, () => pick(s.id), plan.h, s.icon);
    }
    tx += w + gap;
  });
  return { bottom: y + plan.h };
}

/** Wraps text to `w`, keeps as many lines as fit in `maxH`, ends the last one with dots if it was cut, and says where it ended. */
export function paragraph(b: Bag, x: number, y: number, w: number, maxH: number, text: string, tint: number = COL.dim): number {
  const room = Math.floor(maxH / LINE);
  if (room < 1) return y;
  let parts = wrapText(b.scene, text, w).split('\n');
  if (parts.length > room) {
    parts = parts.slice(0, room);
    parts[room - 1] = clip(b.scene, parts[room - 1] ?? '', w);
  }
  b.text(x, y, parts.join('\n'), { tint });
  return y + parts.length * LINE;
}

/** How much a card can say. Short and narrow screens trade the big picture and the item pictures for room. */
export interface CardStyle {
  /** A small picture beside the title, not a big one above the text. */
  compact: boolean;
  /** Needs are rows with the item's picture, not plain text. */
  pictures: boolean;
}

export const cardStyle = (l: Layout, wide: boolean): CardStyle => ({ compact: !wide || l.uiH < 230, pictures: l.uiH >= 230 });

export interface CardLine {
  t: string;
  tint?: number;
  /** Something to bring: its picture, how many are in the bag and how many are needed. */
  need?: { icon: string; have: number; n: number };
}

export interface CardSpec {
  title: string;
  icon?: string;
  lines: readonly (string | CardLine)[];
  /** Draws something under the text and says where it ended. */
  extra?: (b: Bag, x: number, y: number, w: number) => number;
  /** A button that is `off` looks switched off but still answers, so the screen can say why. */
  actions?: readonly { label: string; kind: 'leaf' | 'wood' | 'berry' | 'sky'; off?: boolean }[];
}

const NEED_PICTURE = 17;

function headHeight(scene: Phaser.Scene, w: number, c: CardSpec, style: CardStyle): number {
  const probe = label(scene, 0, 0, '', { wrap: c.icon ? w - (style.compact ? 22 : 40) : w - 4 }).setVisible(false);
  probe.setText(c.title);
  const t = Math.ceil(probe.height);
  probe.destroy();
  if (!c.icon) return 5 + t;
  return style.compact ? Math.max(19, 4 + t) : Math.max(38, 7 + t);
}

const asLine = (ln: string | CardLine): CardLine => (typeof ln === 'string' ? { t: ln } : ln);

function lineHeight(scene: Phaser.Scene, w: number, ln: string | CardLine, style: CardStyle): number {
  const line = asLine(ln);
  if (line.need) return (style.pictures ? NEED_PICTURE : LINE) + 2;
  return wrapText(scene, line.t, w - 4).split('\n').length * LINE + 3;
}

/** How tall `drawCard` will make this card: what a stacked layout must leave for its tallest one. */
export function cardHeight(scene: Phaser.Scene, w: number, c: CardSpec, btnH: number, style: CardStyle): number {
  let ty = headHeight(scene, w, c, style);
  for (const ln of c.lines) ty += lineHeight(scene, w, ln, style);
  if (c.extra) ty += 13;
  return ty + ((c.actions?.length ?? 0) > 0 ? btnH + 4 : 0);
}

/** One thing to bring, as a row: what it is, a tick when it is all there, and how many of how many. */
function needRow(b: Bag, x: number, y: number, w: number, need: NonNullable<CardLine['need']>, name: string, pictures: boolean): void {
  const done = need.have >= need.n;
  const count = b.text(x + w - 1, y + (pictures ? 4 : 1), `${Math.min(need.have, need.n)}/${need.n}`, { origin: [1, 0], tint: done ? COL.leaf : need.have === 0 ? COL.berry : COL.ink });
  const left = pictures ? 20 : 15;
  if (pictures) b.img(x + 9, y + 8, need.icon);
  else if (done) b.img(x + 6, y + 6, 'ui/check');
  // a short card has no room for the whole picture, so the same one is drawn smaller
  else b.img(x + 6, y + 6, need.icon).setScale(0.75);
  const room = w - left - count.width - 8;
  b.text(x + left, y + (pictures ? 4 : 1), ellipsize(b.scene, name, room), { tint: done ? COL.leaf : COL.ink });
  if (done && pictures) b.img(x + w - count.width - 7, y + 8, 'ui/check');
}

/**
 * The card about the selected row: a picture and a title, a few lines, and buttons right under them.
 * Lines that do not fit above the buttons are cut with dots, so text never runs under them.
 * Says how tall the card came out, so a frame can be as tall as what it holds.
 */
export function drawCard(b: Bag, box: Area, c: CardSpec, btnH: number, style: CardStyle, act: (i: number) => void): number {
  const { x, y, w, h } = box;
  const acts = c.actions ?? [];
  const limit = acts.length > 0 ? y + h - btnH - 4 : y + h;
  let ty: number;
  if (c.icon && style.compact) {
    b.img(x + 9, y + 9, c.icon);
    const t = b.text(x + 22, y + 5, c.title, { wrap: w - 22 });
    ty = y + Math.max(19, 4 + Math.ceil(t.height));
  } else if (c.icon) {
    b.img(x + 17, y + 17, c.icon).setScale(2);
    const t = b.text(x + 38, y + 4, c.title, { wrap: w - 40 });
    ty = Math.max(y + 38, y + 7 + Math.ceil(t.height));
  } else {
    const t = b.text(x + 2, y + 2, c.title, { wrap: w - 4 });
    ty = y + 5 + Math.ceil(t.height);
  }
  for (const ln of c.lines) {
    const line = asLine(ln);
    if (line.need) {
      const rowH = style.pictures ? NEED_PICTURE : LINE;
      if (ty + rowH > limit) break;
      needRow(b, x + 2, ty, w - 4, line.need, line.t, style.pictures);
      ty += rowH + 2;
      continue;
    }
    const end = paragraph(b, x + 2, ty, w - 4, limit - ty, line.t, line.tint);
    if (end === ty) break;
    ty = end + 3;
  }
  if (c.extra && ty + 12 <= limit) ty = c.extra(b, x + 2, ty + 1, w - 4);
  if (acts.length === 0) return ty - y;
  const by = Math.min(ty + 3, y + h - btnH);
  const bw = Math.floor((w - 4 - (acts.length - 1) * 4) / acts.length);
  acts.forEach((a, i) => b.btn(x + 2 + i * (bw + 4), by, bw, a.label, a.kind, () => act(i), btnH, undefined, a.off));
  return by + btnH - y;
}
