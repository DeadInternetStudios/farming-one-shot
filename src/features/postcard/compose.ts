import { PAL } from '../../gen/art';
import { LINE_HEIGHT, MARGIN, fitLine, planCard } from './layout';
import type { Crop } from './layout';

const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

interface Glyph {
  x: number;
  y: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
}

/** Writes in the game's own pixel font on a plain 2D canvas, where Phaser's text objects cannot go. */
export class Pen {
  constructor(private chars: Readonly<Record<number, Glyph>>, private sheet: CanvasImageSource, private lineHeight: number) {}

  /** Width in art pixels. */
  width(s: string): number {
    let w = 0;
    for (let i = 0; i < s.length; i++) w += this.chars[s.charCodeAt(i)]?.xAdvance ?? 0;
    return w;
  }

  draw(g: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, color: string): void {
    const w = this.width(s);
    if (w === 0) return;
    const row = document.createElement('canvas');
    row.width = w;
    row.height = this.lineHeight;
    const r = row.getContext('2d');
    if (!r) return;
    let cx = 0;
    for (let i = 0; i < s.length; i++) {
      const c = this.chars[s.charCodeAt(i)];
      if (!c) continue;
      if (c.width > 0) r.drawImage(this.sheet, c.x, c.y, c.width, c.height, cx + c.xOffset, c.yOffset, c.width, c.height);
      cx += c.xAdvance;
    }
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = color;
    r.fillRect(0, 0, w, this.lineHeight);
    g.drawImage(row, 0, 0, w, this.lineHeight, x, y, w * scale, this.lineHeight * scale);
  }
}

export interface Lantern {
  image: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CardContent {
  shot: CanvasImageSource;
  crop: Crop;
  pen: Pen;
  /** The little lantern on the stamp. */
  lantern: Lantern | null;
  /** "Spring 5", "9:40 pm", "rainy": cut down to fit. */
  dateParts: readonly string[];
}

const GREETING = 'Greetings from';
const NAME = 'Lantern Hollow';
const WISH = 'Wish you were here.';

/** The card: the photo taped on paper, a caption, and a stamp. Pixel art stays pixel art: every size is a whole multiple. */
export function composePostcard(c: CardContent): HTMLCanvasElement {
  const plan = planCard(c.crop.cw, c.crop.ch);
  const { k } = plan;
  const cv = document.createElement('canvas');
  cv.width = plan.w * k;
  cv.height = plan.h * k;
  const g = cv.getContext('2d');
  if (!g) throw new Error('no 2d canvas');
  g.imageSmoothingEnabled = false;

  const fill = (color: number, x: number, y: number, w: number, h: number, alpha = 1): void => {
    g.globalAlpha = alpha;
    g.fillStyle = css(color);
    g.fillRect(x * k, y * k, w * k, h * k);
    g.globalAlpha = 1;
  };
  const text = (s: string, x: number, y: number, scale: number, color: number): void => c.pen.draw(g, s, x * k, y * k, scale * k, css(color));

  // paper
  fill(PAL.wood[1], 0, 0, plan.w, plan.h);
  fill(PAL.cream[2], 1, 1, plan.w - 2, plan.h - 2);

  // the photo, with a soft shadow and a dark edge
  const { px, py } = plan;
  const { cw, ch } = c.crop;
  fill(PAL.wood[2], px + 1, py + 2, cw + 2, ch + 2, 0.35);
  fill(PAL.ink[0], px - 1, py - 1, cw + 2, ch + 2);
  g.drawImage(c.shot, c.crop.sx, c.crop.sy, c.crop.sw, c.crop.sh, px * k, py * k, cw * k, ch * k);
  const mid = [(px + cw / 2) * k, (py + ch / 2) * k] as const;
  const vignette = g.createRadialGradient(mid[0], mid[1], Math.min(cw, ch) * k * 0.3, mid[0], mid[1], Math.max(cw, ch) * k * 0.62);
  vignette.addColorStop(0, 'rgba(24, 12, 0, 0)');
  vignette.addColorStop(1, 'rgba(24, 12, 0, 0.3)');
  g.fillStyle = vignette;
  g.fillRect(px * k, py * k, cw * k, ch * k);

  // a strip of tape holding it on
  const tapeX = Math.round((plan.w - 24) / 2);
  fill(PAL.yellow[2], tapeX, py - 5, 24, 8, 0.85);
  fill(PAL.yellow[4], tapeX, py - 5, 24, 1, 0.8);
  fill(PAL.yellow[0], tapeX, py + 2, 24, 1, 0.3);

  // the words
  const big = plan.bigTitle ? 2 : 1;
  let y = plan.textY;
  text(GREETING, MARGIN, y, 1, PAL.wood[3]);
  y += LINE_HEIGHT;
  text(NAME, MARGIN, y, big, PAL.ink[1]);
  y += LINE_HEIGHT * big;
  text(fitLine(c.dateParts, (s) => c.pen.width(s), plan.textW), MARGIN, y, 1, PAL.wood[2]);
  y += LINE_HEIGHT;
  text(WISH, MARGIN, y, 1, PAL.red[2]);

  // the stamp: perforated paper, a night sky, a lantern
  const s = plan.stamp;
  fill(PAL.wood[2], s.x + 1, s.y + 1, s.w, s.h, 0.3);
  fill(PAL.cream[3], s.x, s.y, s.w, s.h);
  for (let i = 0; i < 6; i++) {
    fill(PAL.cream[2], s.x + 1 + i * 4, s.y, 2, 1);
    fill(PAL.cream[2], s.x + 1 + i * 4, s.y + s.h - 1, 2, 1);
  }
  for (let j = 0; j < 7; j++) {
    fill(PAL.cream[2], s.x, s.y + 1 + j * 4, 1, 2);
    fill(PAL.cream[2], s.x + s.w - 1, s.y + 1 + j * 4, 1, 2);
  }
  fill(PAL.ink[1], s.x + 3, s.y + 3, s.w - 6, s.h - 6);
  fill(PAL.blue[0], s.x + 4, s.y + 4, s.w - 8, s.h - 8);
  fill(PAL.glow[4], s.x + 6, s.y + 7, 1, 1);
  fill(PAL.glow[4], s.x + 17, s.y + 10, 1, 1);
  fill(PAL.glow[4], s.x + 8, s.y + 24, 1, 1);
  if (c.lantern) {
    const l = c.lantern;
    g.drawImage(l.image, l.x, l.y, l.w, l.h, (s.x + Math.floor((s.w - l.w) / 2)) * k, (s.y + Math.floor((s.h - l.h) / 2)) * k, l.w * k, l.h * k);
  }
  return cv;
}
