import Phaser from 'phaser';
import { cropFrame } from '../game/farming';
import { decorAt, frameOf } from '../features/garden/catalog';
import type { LocationState, ObjectState } from '../game/state';
import type { Season } from '../game/types';
import { parseKey, tileKey } from '../game/types';
import { DEPTH } from './MapView';
import type { MapDef, ObjectKind } from './mapkit';

const FLOWER_KINDS = ['daisy', 'tulip', 'bell', 'sun', 'lav', 'cosmos'] as const;

export interface LightSpot {
  x: number;
  y: number;
  r: number;
  color: number;
  /** Lamp flames flicker; windows do not. */
  flicker: boolean;
}

interface Placed {
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  kind: ObjectKind;
  /** The look variant it was built with. */
  v: number;
  /** A garden piece that lights up at night: its glowing frame and the pool of light on the ground. */
  lit?: { glow?: Phaser.GameObjects.Image; spot?: LightSpot };
}

const SHADOW: Partial<Record<ObjectKind, { frame: string; alpha: number; dy: number }>> = {
  tree: { frame: 'fx/shadow-l', alpha: 0.5, dy: -2 },
  bush: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  rock: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  boulder: { frame: 'fx/shadow-l', alpha: 0.5, dy: -1 },
  stump: { frame: 'fx/shadow-s', alpha: 0.45, dy: -1 },
  log: { frame: 'fx/shadow-l', alpha: 0.45, dy: -1 },
  copper: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  iron: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  gold: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  crystal: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  chest: { frame: 'fx/shadow-m', alpha: 0.4, dy: -1 },
  furnace: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  sprinkler: { frame: 'fx/shadow-s', alpha: 0.4, dy: -1 },
  decor: { frame: 'fx/shadow-s', alpha: 0.4, dy: -1 },
  berries: { frame: 'fx/shadow-m', alpha: 0.4, dy: -1 },
};

/** Everything standing on the ground: trees, rocks, crops, buildings and props, sorted by their feet. */
export class ObjectsView {
  private placed = new Map<string, Placed>();
  private crops = new Map<string, Phaser.GameObjects.Image>();
  private grass: { sprite: Phaser.GameObjects.Image; phase: number }[] = [];
  readonly lights: LightSpot[] = [];
  readonly glows: Phaser.GameObjects.Image[] = [];
  readonly smokeSpots: { x: number; y: number }[] = [];
  /** Window panes and the like: frames that fade in over their day frame as night falls. */
  readonly nightFrames: Phaser.GameObjects.Image[] = [];
  private bin: Phaser.GameObjects.Image | null = null;
  private animated: { img: Phaser.GameObjects.Image; frames: string[] }[] = [];
  private shrine: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image } | null = null;
  private grassTick = 0;
  private owned: Phaser.GameObjects.Image[] = [];
  /** Set when a garden light came or went, so the light map knows to pick up the new list. */
  lightsDirty = false;

  constructor(private scene: Phaser.Scene, readonly def: MapDef, private loc: LocationState, private season: Season) {
    for (const b of def.buildings) {
      const ax = (b.x + b.w / 2) * 16;
      const ay = (b.y + b.h) * 16;
      this.img(ax, ay - 4, 'fx/shadow-l').setDisplaySize(b.w * 16 + 16, 18).setAlpha(0.5).setDepth(DEPTH.ground);
      this.img(ax, ay, b.sprite).setOrigin(0.5, 1).setDepth(ay);
      if (b.glow) {
        const g = this.img(ax, ay, b.glow).setOrigin(0.5, 1).setDepth(ay + 0.5).setAlpha(0);
        this.glows.push(g);
      }
      for (const l of b.lights ?? []) this.lights.push({ x: ax + l.x, y: ay + l.y, r: l.r, color: 0xffb457, flicker: false });
      if (b.smoke) this.smokeSpots.push({ x: ax + b.smoke.x, y: ay + b.smoke.y });
    }
    for (const p of def.props) {
      const w = p.w ?? 1;
      const h = p.h ?? 1;
      const ax = (p.x + w / 2) * 16;
      const ay = (p.y + h) * 16;
      const sy = ay - (p.lift ?? 0);
      const depth = p.flat ? DEPTH.ground + 1 : ay;
      if (!p.noShadow && !p.flat) this.img(ax, ay - 2, 'fx/shadow-m').setAlpha(0.4).setDepth(DEPTH.ground);
      const s = this.img(ax, sy, p.sprite).setOrigin(0.5, 1).setDepth(depth);
      if (p.interact === 'bin') this.bin = s;
      if (p.frames) this.animated.push({ img: s, frames: p.frames });
      if (p.nightFrame) this.nightFrames.push(this.img(ax, sy, p.nightFrame).setOrigin(0.5, 1).setDepth(depth + 0.4).setAlpha(0));
      if (p.glow) {
        const g = this.img(ax, sy, p.glow).setOrigin(0.5, 1).setDepth(depth + 0.5).setAlpha(0);
        this.glows.push(g);
        if (p.id === 'shrine') this.shrine = { img: s, glow: g };
      }
      if (p.light) this.lights.push({ x: ax + p.light.x, y: ay + p.light.y, r: p.light.r, color: p.light.color ?? 0xffbe66, flicker: true });
    }
    this.syncAll();
  }

  private img(x: number, y: number, frame: string): Phaser.GameObjects.Image {
    const i = this.scene.add.image(x, y, 'atlas', frame);
    this.owned.push(i);
    return i;
  }

  /** Show how many lanterns on the shrine are lit. */
  setLit(n: number): void {
    this.shrine?.img.setFrame(`shrine/${n}`);
    this.shrine?.glow.setFrame(`shrine/${n}-glow`);
  }

  destroy(): void {
    for (const i of this.owned) i.destroy();
    this.animated = [];
    this.shrine = null;
    this.owned = [];
    this.placed.clear();
    this.crops.clear();
    this.grass = [];
    this.glows.length = 0;
    this.lights.length = 0;
    this.nightFrames.length = 0;
  }

  setSeason(season: Season): void {
    this.season = season;
    this.syncAll();
  }

  syncAll(): void {
    const keys = new Set<string>([...Object.keys(this.loc.objects), ...Object.keys(this.loc.soil), ...this.placed.keys(), ...this.crops.keys()]);
    for (const k of keys) this.syncTile(k);
  }

  private frameFor(o: ObjectState, x: number, y: number): string {
    const s = this.season;
    switch (o.k) {
      case 'tree': return `tree/${s}/${o.v % 3}`;
      case 'stump': return `stump/${s}`;
      case 'rock': return `rock/small/${o.v % 3}`;
      case 'boulder': return `rock/big/${o.v % 2}`;
      case 'weed': return `weed/${s}/${o.v % 3}`;
      case 'tallgrass': return `tallgrass/${s}/${(o.v + x + y) % 4}`;
      case 'branch': return `branch/${o.v % 3}`;
      case 'log': return `log/${o.v % 2}`;
      case 'flower': return `flower/${FLOWER_KINDS[o.v % 6]}/${Math.floor(o.v / 6) % 2}`;
      case 'bush': return `bush/${s}/${o.v % 3}`;
      case 'mushroom': return `forage/mushroom/${o.v % 2}`;
      case 'berries': return `forage/berries/${o.v % 2}`;
      case 'clay': return 'forage/clay';
      case 'copper': return 'ore/copper';
      case 'iron': return 'ore/iron';
      case 'gold': return 'ore/gold';
      case 'crystal': return 'ore/crystal';
      case 'chest': return 'obj/chest';
      case 'furnace': return 'obj/furnace';
      case 'sprinkler': return 'obj/sprinkler';
      case 'decor': { const d = decorAt(o.v); return d ? frameOf(d, s) : 'fx/cursor'; }
    }
  }

  /** Take a placed object off the map, along with its shadow and any light it was giving. */
  private drop(key: string, have: Placed): void {
    have.sprite.destroy();
    have.shadow?.destroy();
    if (have.lit) {
      if (have.lit.glow) {
        const i = this.glows.indexOf(have.lit.glow);
        if (i >= 0) this.glows.splice(i, 1);
        have.lit.glow.destroy();
      }
      if (have.lit.spot) {
        const i = this.lights.indexOf(have.lit.spot);
        if (i >= 0) this.lights.splice(i, 1);
        this.lightsDirty = true;
      }
    }
    this.placed.delete(key);
  }

  /** A garden piece that glows: the lit frame over it and a pool of light around it. */
  private lightUp(o: ObjectState, px: number, py: number): Placed['lit'] {
    const d = o.k === 'decor' ? decorAt(o.v) : undefined;
    if (!d || (!d.glow && !d.light)) return undefined;
    const lit: NonNullable<Placed['lit']> = {};
    if (d.glow) {
      lit.glow = this.img(px, py, d.glow).setOrigin(0.5, 1).setDepth(py + 0.5).setAlpha(0);
      this.glows.push(lit.glow);
    }
    if (d.light) {
      lit.spot = { x: px, y: py - d.light.y, r: d.light.r, color: d.light.color, flicker: true };
      this.lights.push(lit.spot);
      this.lightsDirty = true;
    }
    return lit;
  }

  /** Make the sprites for one tile match the state. */
  syncTile(key: string): void {
    const { x, y } = parseKey(key);
    const o = this.loc.objects[key];
    const have = this.placed.get(key);
    if (!o) {
      if (have) {
        this.drop(key, have);
        this.grass = this.grass.filter((g) => g.sprite.active);
      }
    } else {
      const frame = this.frameFor(o, x, y);
      if (have && have.kind === o.k && have.v === o.v) {
        have.sprite.setFrame(frame);
      } else {
        if (have) this.drop(key, have);
        const px = x * 16 + 8;
        const py = (y + 1) * 16;
        const sprite = this.img(px, py, frame).setOrigin(0.5, 1).setDepth(py);
        let shadow: Phaser.GameObjects.Image | undefined;
        const sh = SHADOW[o.k];
        if (sh) shadow = this.img(px, py + sh.dy, sh.frame).setAlpha(sh.alpha).setDepth(DEPTH.ground);
        if (o.k === 'tree') shadow?.setDisplaySize(30, 11);
        this.placed.set(key, { sprite, shadow, kind: o.k, v: o.v, lit: this.lightUp(o, px, py) });
        if (o.k === 'tallgrass') this.grass.push({ sprite, phase: (x * 7 + y * 3) % 4 });
      }
    }

    const soil = this.loc.soil[key];
    const crop = soil?.crop;
    const cs = this.crops.get(key);
    if (!crop) {
      if (cs) {
        cs.destroy();
        this.crops.delete(key);
      }
    } else {
      const frame = cropFrame(crop);
      if (cs) cs.setFrame(frame);
      else {
        const py = (y + 1) * 16 - 1;
        this.crops.set(key, this.img(x * 16 + 8, py, frame).setOrigin(0.5, 1).setDepth(py));
      }
    }
  }

  spriteAt(key: string): Phaser.GameObjects.Image | undefined {
    return this.placed.get(key)?.sprite ?? this.crops.get(key);
  }

  /** A little wobble when something is hit. */
  shake(key: string): void {
    const s = this.placed.get(key)?.sprite;
    if (!s) return;
    const x = s.x;
    this.scene.tweens.add({ targets: s, x: { from: x - 1, to: x + 1 }, duration: 45, yoyo: true, repeat: 2, onComplete: () => s.setX(x) });
  }

  /** Makes a throwaway copy of a sprite so it can play a fall or a pop while the real one is gone. */
  ghostOf(key: string): Phaser.GameObjects.Image | null {
    const s = this.placed.get(key)?.sprite;
    if (!s) return null;
    return this.img(s.x, s.y, s.frame.name).setOrigin(0.5, 1).setDepth(s.depth);
  }

  /** Furnaces glow while they are working. `busy` says which furnace keys have a job running. */
  syncMachines(busy: ReadonlySet<string>): void {
    for (const [key, p] of this.placed) {
      if (p.kind === 'furnace') p.sprite.setFrame(busy.has(key) ? 'obj/furnace-lit' : 'obj/furnace');
    }
  }

  openBin(open: boolean): void {
    this.bin?.setFrame(open ? 'building/bin-open' : 'building/bin');
  }

  update(time: number): void {
    const beat = Math.floor(time / 380);
    for (const a of this.animated) a.img.setFrame(a.frames[beat % a.frames.length] as string);
    const tick = Math.floor(time / 320);
    if (tick !== this.grassTick) {
      this.grassTick = tick;
      if (this.owned.length > 600) this.owned = this.owned.filter((i) => i.active);
      for (const g of this.grass) {
        if (g.sprite.active) g.sprite.setFrame(`tallgrass/${this.season}/${(tick + g.phase) % 4}`);
      }
    }
  }
}

export const objectKey = tileKey;
