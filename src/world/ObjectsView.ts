import Phaser from 'phaser';
import { cropFrame } from '../game/farming';
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
}

const SHADOW: Partial<Record<ObjectKind, { frame: string; alpha: number; dy: number }>> = {
  tree: { frame: 'fx/shadow-l', alpha: 0.5, dy: -2 },
  bush: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  rock: { frame: 'fx/shadow-m', alpha: 0.45, dy: -1 },
  boulder: { frame: 'fx/shadow-l', alpha: 0.5, dy: -1 },
  stump: { frame: 'fx/shadow-s', alpha: 0.45, dy: -1 },
  log: { frame: 'fx/shadow-l', alpha: 0.45, dy: -1 },
};

/** Everything standing on the ground: trees, rocks, crops, buildings and props, sorted by their feet. */
export class ObjectsView {
  private placed = new Map<string, Placed>();
  private crops = new Map<string, Phaser.GameObjects.Image>();
  private grass: { sprite: Phaser.GameObjects.Image; phase: number }[] = [];
  readonly lights: LightSpot[] = [];
  readonly glows: Phaser.GameObjects.Image[] = [];
  readonly smokeSpots: { x: number; y: number }[] = [];
  private bin: Phaser.GameObjects.Image | null = null;
  private grassTick = 0;

  constructor(private scene: Phaser.Scene, readonly def: MapDef, private loc: LocationState, private season: Season) {
    for (const b of def.buildings) {
      const ax = (b.x + b.w / 2) * 16;
      const ay = (b.y + b.h) * 16;
      scene.add.image(ax, ay - 4, 'atlas', 'fx/shadow-l').setDisplaySize(b.w * 16 + 16, 18).setAlpha(0.5).setDepth(DEPTH.ground);
      scene.add.image(ax, ay, 'atlas', b.sprite).setOrigin(0.5, 1).setDepth(ay);
      if (b.glow) {
        const g = scene.add.image(ax, ay, 'atlas', b.glow).setOrigin(0.5, 1).setDepth(ay + 0.5).setAlpha(0);
        this.glows.push(g);
      }
      for (const l of b.lights ?? []) this.lights.push({ x: ax + l.x, y: ay + l.y, r: l.r, color: 0xffb457, flicker: false });
      if (b.smoke) this.smokeSpots.push({ x: ax + b.smoke.x, y: ay + b.smoke.y });
    }
    for (const p of def.props) {
      const ax = p.x * 16 + 8;
      const ay = (p.y + 1) * 16;
      scene.add.image(ax, ay - 2, 'atlas', 'fx/shadow-m').setAlpha(0.4).setDepth(DEPTH.ground);
      const s = scene.add.image(ax, ay, 'atlas', p.sprite).setOrigin(0.5, 1).setDepth(ay);
      if (p.interact === 'bin') this.bin = s;
      if (p.glow) {
        const g = scene.add.image(ax, ay, 'atlas', p.glow).setOrigin(0.5, 1).setDepth(ay + 0.5).setAlpha(0);
        this.glows.push(g);
      }
      if (p.light) this.lights.push({ x: ax + p.light.x, y: ay + p.light.y, r: p.light.r, color: p.light.color ?? 0xffbe66, flicker: true });
    }
    this.syncAll();
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
    }
  }

  /** Make the sprites for one tile match the state. */
  syncTile(key: string): void {
    const { x, y } = parseKey(key);
    const o = this.loc.objects[key];
    const have = this.placed.get(key);
    if (!o) {
      if (have) {
        have.sprite.destroy();
        have.shadow?.destroy();
        this.placed.delete(key);
        this.grass = this.grass.filter((g) => g.sprite.active);
      }
    } else {
      const frame = this.frameFor(o, x, y);
      if (have && have.kind === o.k) {
        have.sprite.setFrame(frame);
      } else {
        if (have) {
          have.sprite.destroy();
          have.shadow?.destroy();
        }
        const px = x * 16 + 8;
        const py = (y + 1) * 16;
        const sprite = this.scene.add.image(px, py, 'atlas', frame).setOrigin(0.5, 1).setDepth(py);
        let shadow: Phaser.GameObjects.Image | undefined;
        const sh = SHADOW[o.k];
        if (sh) shadow = this.scene.add.image(px, py + sh.dy, 'atlas', sh.frame).setAlpha(sh.alpha).setDepth(DEPTH.ground);
        if (o.k === 'tree') shadow?.setDisplaySize(30, 11);
        this.placed.set(key, { sprite, shadow, kind: o.k });
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
        this.crops.set(key, this.scene.add.image(x * 16 + 8, py, 'atlas', frame).setOrigin(0.5, 1).setDepth(py));
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
    return this.scene.add.image(s.x, s.y, 'atlas', s.frame.name).setOrigin(0.5, 1).setDepth(s.depth);
  }

  openBin(open: boolean): void {
    this.bin?.setFrame(open ? 'building/bin-open' : 'building/bin');
  }

  update(time: number): void {
    const tick = Math.floor(time / 320);
    if (tick !== this.grassTick) {
      this.grassTick = tick;
      for (const g of this.grass) {
        if (g.sprite.active) g.sprite.setFrame(`tallgrass/${this.season}/${(tick + g.phase) % 4}`);
      }
    }
  }
}

export const objectKey = tileKey;
