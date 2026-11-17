import { chance, hashInts, mulberry32, pick, randInt } from '../game/rng';
import type { Rand } from '../game/rng';
import type { Dir, LocationId } from '../game/types';
import { tileKey } from '../game/types';

export const GROUND = { Void: 0, Grass: 1, Sand: 2 } as const;
export const OVERLAY = { None: 0, Path: 1, Cobble: 2, Plank: 3 } as const;

export type ObjectKind = 'tree' | 'stump' | 'rock' | 'boulder' | 'weed' | 'tallgrass' | 'branch' | 'log' | 'flower' | 'bush';

/** Kinds that stop the player. Everything else can be walked through. */
export const SOLID_OBJECTS: ReadonlySet<ObjectKind> = new Set(['tree', 'stump', 'rock', 'boulder', 'log', 'bush']);

export const OBJECT_HP: Readonly<Record<ObjectKind, number>> = {
  tree: 5, stump: 3, rock: 2, boulder: 6, weed: 1, tallgrass: 1, branch: 1, log: 6, flower: 1, bush: 1,
};

export interface MapObject {
  k: ObjectKind;
  x: number;
  y: number;
  /** Look variant, or flower kind index. */
  v: number;
}

export interface Building {
  sprite: string;
  glow?: string;
  /** Footprint in tiles. The sprite is anchored at the bottom centre of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Chimney smoke offset from the sprite anchor, in pixels. */
  smoke?: { x: number; y: number };
  /** Light spots for the night glow, in pixels from the anchor. */
  lights?: { x: number; y: number; r: number }[];
}

export interface Prop {
  sprite: string;
  glow?: string;
  /** Tile the sprite stands on, anchored bottom centre. */
  x: number;
  y: number;
  solid?: boolean;
  light?: { x: number; y: number; r: number; color?: number };
  interact?: 'bin' | 'sign';
  text?: string;
}

export interface Warp {
  x: number;
  y: number;
  w: number;
  h: number;
  to: LocationId;
  tx: number;
  ty: number;
  dir: Dir;
}

export interface MapDef {
  id: LocationId;
  name: string;
  w: number;
  h: number;
  indoors: boolean;
  ground: Uint8Array;
  overlay: Uint8Array;
  /** Static solid tiles: building footprints and fixed props. */
  solid: Uint8Array;
  buildings: Building[];
  props: Prop[];
  objects: MapObject[];
  warps: Warp[];
  spawn: { x: number; y: number };
  /** Tiles where the player may till. */
  tillable: Uint8Array;
}

export class MapBuilder {
  readonly ground: Uint8Array;
  readonly overlay: Uint8Array;
  readonly solid: Uint8Array;
  readonly keep: Uint8Array; // tiles that natural clutter must leave alone
  readonly objects: MapObject[] = [];
  readonly buildings: Building[] = [];
  readonly props: Prop[] = [];
  readonly warps: Warp[] = [];
  readonly rand: Rand;
  private taken = new Set<string>();
  spawn = { x: 1, y: 1 };

  constructor(readonly id: LocationId, readonly name: string, readonly w: number, readonly h: number, readonly seed: number, readonly indoors = false) {
    this.ground = new Uint8Array(w * h);
    this.overlay = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.keep = new Uint8Array(w * h);
    this.rand = mulberry32(hashInts(seed, 7, w, h));
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  fill(layer: Uint8Array, v: number): this {
    layer.fill(v);
    return this;
  }

  rect(layer: Uint8Array, x: number, y: number, w: number, h: number, v: number): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inb(i, j)) layer[this.idx(i, j)] = v;
    return this;
  }

  /** A wobbly ellipse, good for ponds and clearings. */
  blob(layer: Uint8Array, cx: number, cy: number, rx: number, ry: number, v: number, wobble = 0.22): this {
    const ph = this.rand() * 6.28;
    const ph2 = this.rand() * 6.28;
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        if (!this.inb(x, y)) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const a = Math.atan2(dy, dx);
        const r = 1 + wobble * (Math.sin(a * 3 + ph) * 0.6 + Math.sin(a * 5 + ph2) * 0.4);
        if (dx * dx + dy * dy <= r * r) layer[this.idx(x, y)] = v;
      }
    }
    return this;
  }

  keepClear(x: number, y: number, w: number, h: number): this {
    return this.rect(this.keep, x, y, w, h, 1);
  }

  at(layer: Uint8Array, x: number, y: number): number {
    return this.inb(x, y) ? (layer[this.idx(x, y)] as number) : 0;
  }

  free(x: number, y: number): boolean {
    return (
      this.inb(x, y) &&
      this.ground[this.idx(x, y)] === GROUND.Grass &&
      this.overlay[this.idx(x, y)] === OVERLAY.None &&
      !this.solid[this.idx(x, y)] &&
      !this.keep[this.idx(x, y)] &&
      !this.taken.has(tileKey(x, y))
    );
  }

  put(k: ObjectKind, x: number, y: number, v = 0): boolean {
    if (!this.free(x, y)) return false;
    this.taken.add(tileKey(x, y));
    this.objects.push({ k, x, y, v });
    return true;
  }

  building(b: Building): this {
    this.buildings.push(b);
    this.rect(this.solid, b.x, b.y, b.w, b.h, 1);
    this.rect(this.keep, b.x - 1, b.y, b.w + 2, b.h + 2, 1);
    return this;
  }

  prop(p: Prop): this {
    this.props.push(p);
    if (p.solid) this.rect(this.solid, p.x, p.y, 1, 1, 1);
    this.taken.add(tileKey(p.x, p.y));
    return this;
  }

  warp(w: Warp): this {
    this.warps.push(w);
    this.rect(this.keep, w.x, w.y, w.w, w.h, 1);
    return this;
  }

  /** Scatter objects in the area where `where` is true, keeping a little breathing room. */
  scatter(k: ObjectKind, count: number, where: (x: number, y: number) => boolean, variants = 1, spacing = 0): number {
    let placed = 0;
    for (let tries = 0; tries < count * 40 && placed < count; tries++) {
      const x = randInt(this.rand, 0, this.w - 1);
      const y = randInt(this.rand, 0, this.h - 1);
      if (!where(x, y) || !this.free(x, y)) continue;
      if (spacing > 0 && this.near(x, y, spacing)) continue;
      if (this.put(k, x, y, randInt(this.rand, 0, variants - 1))) placed++;
    }
    return placed;
  }

  private near(x: number, y: number, r: number): boolean {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (this.taken.has(tileKey(x + i, y + j))) return true;
    return false;
  }

  /** A band of trees around the edge, thick at the border and thinning inwards. */
  forestEdge(thickness: number, gaps: { x: number; y: number; w: number; h: number }[] = [], density = 0.8): void {
    const inGap = (x: number, y: number): boolean => gaps.some((g) => x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        if (d >= thickness || inGap(x, y)) continue;
        const p = density * (1 - Math.max(0, d - 1) / thickness) ** 0.8;
        if (chance(this.rand, p) && this.free(x, y)) this.put('tree', x, y, randInt(this.rand, 0, 2));
      }
    }
  }

  tillableFrom(pred: (x: number, y: number) => boolean): Uint8Array {
    const t = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.ground[this.idx(x, y)] === GROUND.Grass && this.overlay[this.idx(x, y)] === OVERLAY.None && pred(x, y)) t[this.idx(x, y)] = 1;
    return t;
  }

  pickOne<T>(a: readonly T[]): T {
    return pick(this.rand, a);
  }
}
