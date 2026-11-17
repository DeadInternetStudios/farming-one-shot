import type Phaser from 'phaser';
import { tapH, type Layout } from '../display';
import { COL, label, wrapText } from './kit';
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
}

export interface PopupOpts {
  title: string;
  wideH: number;
  tallH: number;
  maxW?: number;
  close: () => void;
}

/** Panel, title and close button, centred on the screen. */
export function popup(bag: Bag, l: Layout, o: PopupOpts): Pop {
  const wide = l.uiW >= 290;
  const w = Math.min(l.uiW - 8, o.maxW ?? 340);
  const h = Math.min(l.uiH - 8, wide ? o.wideH : o.tallH);
  const x = Math.floor((l.uiW - w) / 2);
  const y = Math.floor((l.uiH - h) / 2);
  bag.panel(x, y, w, h);
  const size = l.touch ? tapH(l) : 14;
  const closeX = x + w - size - 11;
  const cy = y + (l.touch ? 5 : 6);
  bag.btn(closeX, cy, size, 'x', 'berry', o.close, size);
  const titleY = cy + Math.floor((size - 9) / 2) + 2;
  const title = bag.text(x + 12, titleY, o.title, {});
  const lines = wide ? 1 : 2;
  return { x, y, w, h, title, wide, closeX, titleY, top: cy + size + (l.touch ? 4 : 3), foot: y + h - 7 - lines * LINE, lines };
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
  return { set: (s) => { t.setText(s); place(); } };
}

/** The line at the foot of a pop-up that answers what you just did. Long answers wrap, and are cut with dots if they still do not fit. */
export function footer(bag: Bag, p: Pop, tint: number = COL.ink): (m: string, color?: number) => void {
  const t = bag.text(p.x + p.w / 2, p.foot, '', { origin: [0.5, 0], tint, align: 'center' });
  const room = p.w - 24;
  return (m, color) => {
    const all = wrapText(bag.scene, m, room).split('\n');
    const shown = all.slice(0, p.lines);
    if (all.length > p.lines) shown[p.lines - 1] = clip(bag.scene, shown[p.lines - 1] ?? '', room);
    t.setText(shown.join('\n')).setTint(color ?? tint);
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

/**
 * A row of tabs that never overlap. Where every name fits next to its icon, all tabs are labelled and
 * share the width; where it does not, the strip falls back to icons alone and the screen names the page
 * in its title.
 */
export function tabStrip<T extends string>(bag: Bag, l: Layout, p: Pop, y: number, specs: readonly TabSpec<T>[], active: T, pick: (id: T) => void): { bottom: number; labelled: boolean } {
  const h = l.touch ? tapH(l) : 16;
  const inner = p.w - 2 * PAD;
  const probe = label(bag.scene, 0, 0, '').setVisible(false);
  const need = specs.map((s) => {
    probe.setText(s.label);
    return Math.ceil(probe.width) + (s.icon ? 15 : 0) + 12;
  });
  probe.destroy();
  const gaps = GAP * (specs.length - 1);
  const total = need.reduce((a, n) => a + n, 0) + gaps;
  const iconic = specs.every((s) => s.icon);
  const labelled = total <= inner || !iconic;
  let widths: number[];
  if (!iconic && total > inner) {
    widths = need.map((n) => Math.floor((n * (inner - gaps)) / (total - gaps)));
  } else if (labelled) {
    const each = Math.floor((inner - total) / specs.length);
    widths = need.map((n) => n + each);
  } else {
    widths = specs.map(() => Math.floor((inner - gaps) / specs.length));
  }
  const used = widths.reduce((a, n) => a + n, 0) + gaps;
  let tx = p.x + PAD + Math.floor((inner - used) / 2);
  specs.forEach((s, i) => {
    const w = widths[i] ?? 0;
    bag.btn(tx, y, w, labelled ? s.label : '', s.id === active ? 'leaf' : 'wood', () => pick(s.id), h, s.icon);
    tx += w + GAP;
  });
  return { bottom: y + h, labelled };
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

export interface CardLine {
  t: string;
  tint?: number;
}

export interface CardSpec {
  title: string;
  icon?: string;
  lines: readonly (string | CardLine)[];
  /** Draws something under the text and says where it ended. */
  extra?: (b: Bag, x: number, y: number, w: number) => number;
  actions?: readonly { label: string; kind: 'leaf' | 'wood' | 'berry' | 'sky' }[];
}

/** How tall `drawCard` will make this card: what a stacked layout must leave for its tallest one. */
export function cardHeight(scene: Phaser.Scene, w: number, c: CardSpec, btnH: number): number {
  const probe = label(scene, 0, 0, '', { wrap: c.icon ? w - 40 : w - 4 }).setVisible(false);
  probe.setText(c.title);
  let ty = c.icon ? Math.max(38, 7 + Math.ceil(probe.height)) : 5 + Math.ceil(probe.height);
  probe.destroy();
  for (const ln of c.lines) ty += wrapText(scene, typeof ln === 'string' ? ln : ln.t, w - 4).split('\n').length * LINE + 3;
  if (c.extra) ty += 13;
  return ty + ((c.actions?.length ?? 0) > 0 ? btnH + 4 : 0);
}

/**
 * The card about the selected row: a picture and a title, a few lines, and buttons pinned to the bottom.
 * Lines that do not fit above the buttons are cut with dots, so text never runs under them.
 */
export function drawCard(b: Bag, box: Area, c: CardSpec, btnH: number, act: (i: number) => void): void {
  const { x, y, w, h } = box;
  const acts = c.actions ?? [];
  const limit = acts.length > 0 ? y + h - btnH - 4 : y + h;
  let ty: number;
  if (c.icon) {
    b.img(x + 17, y + 17, c.icon).setScale(2);
    const t = b.text(x + 38, y + 4, c.title, { wrap: w - 40 });
    ty = Math.max(y + 38, y + 7 + Math.ceil(t.height));
  } else {
    const t = b.text(x + 2, y + 2, c.title, { wrap: w - 4 });
    ty = y + 5 + Math.ceil(t.height);
  }
  for (const ln of c.lines) {
    const line = typeof ln === 'string' ? { t: ln } : ln;
    const end = paragraph(b, x + 2, ty, w - 4, limit - ty, line.t, line.tint);
    if (end === ty) break;
    ty = end + 3;
  }
  if (c.extra && ty + 12 <= limit) c.extra(b, x + 2, ty + 1, w - 4);
  if (acts.length === 0) return;
  const bw = Math.floor((w - 4 - (acts.length - 1) * 4) / acts.length);
  acts.forEach((a, i) => b.btn(x + 2 + i * (bw + 4), y + h - btnH, bw, a.label, a.kind, () => act(i), btnH));
}
