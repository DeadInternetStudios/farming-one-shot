import Phaser from 'phaser';
import { COOP, PEN, catOf, coopBuilt, eggsWaiting, henList, isChick } from '../game/animals';
import { isSolidTile } from '../game/actions';
import type { GameState, LocationState, Pet } from '../game/state';
import type { MapDef } from '../world/mapkit';

type Mode = 'idle' | 'walk' | 'sleep';
interface Rect { x: number; y: number; w: number; h: number }

/** The yard in front of the farmhouse, where the cat likes to be. */
const YARD: Rect = { x: 8, y: 11, w: 10, h: 4 };

/** One animal on the farm: stands about, pecks or naps, and now and then wanders to another spot. */
class Critter {
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  private mode: Mode = 'idle';
  private timer = 0;
  private step = 0;
  private goal: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, readonly pet: Pet, private frames: { idle: string; walk: [string, string]; peck?: [string, string]; sleep?: string }, tile: { x: number; y: number }, private speed: number) {
    this.x = tile.x * 16 + 8;
    this.y = tile.y * 16 + 14;
    this.shadow = scene.add.image(this.x, this.y, 'atlas', 'fx/shadow-s').setAlpha(0.5).setScale(0.8);
    this.sprite = scene.add.image(this.x, this.y, 'atlas', frames.idle).setOrigin(0.5, 1);
    this.timer = 0.5 + Math.random() * 2;
    this.place();
  }

  get tile(): { x: number; y: number } {
    return { x: Math.floor(this.x / 16), y: Math.floor((this.y - 1) / 16) };
  }

  private place(): void {
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 0.5);
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  update(dt: number, bounds: Rect, open: (x: number, y: number) => boolean, napping: boolean): void {
    this.timer -= dt;
    this.step += dt;
    if (this.mode === 'walk' && this.goal) {
      const dx = this.goal.x - this.x;
      const dy = this.goal.y - this.y;
      const dist = Math.hypot(dx, dy);
      const move = this.speed * dt;
      if (dist <= move) {
        this.x = this.goal.x;
        this.y = this.goal.y;
        this.rest(napping);
      } else {
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
        if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
        this.sprite.setFrame(this.frames.walk[Math.floor(this.step / 0.18) % 2] as string);
      }
      this.place();
      return;
    }
    if (this.mode === 'sleep' && !napping) this.rest(false);
    if (this.mode === 'idle' && this.frames.peck) this.sprite.setFrame(this.frames.peck[Math.floor(this.step / 0.4) % 2] as string);
    if (this.timer > 0) return;
    if (napping && this.frames.sleep) {
      this.mode = 'sleep';
      this.sprite.setFrame(this.frames.sleep);
      this.timer = 6 + Math.random() * 8;
      return;
    }
    this.wander(bounds, open);
  }

  private rest(napping: boolean): void {
    this.mode = napping && this.frames.sleep ? 'sleep' : 'idle';
    this.goal = null;
    this.timer = 1.5 + Math.random() * 4;
    this.sprite.setFrame(this.mode === 'sleep' ? (this.frames.sleep as string) : this.frames.idle);
  }

  private wander(bounds: Rect, open: (x: number, y: number) => boolean): void {
    for (let tries = 0; tries < 8; tries++) {
      const tx = bounds.x + Math.floor(Math.random() * bounds.w);
      const ty = bounds.y + Math.floor(Math.random() * bounds.h);
      if (!open(tx, ty) || Math.abs(tx * 16 + 8 - this.x) > 70) continue;
      this.goal = { x: tx * 16 + 4 + Math.random() * 8, y: ty * 16 + 10 + Math.random() * 4 };
      this.mode = 'walk';
      this.step = 0;
      return;
    }
    this.timer = 1;
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

/** The hens, chicks and cat of the farm, plus the egg basket by the coop door. */
export class Critters {
  private all = new Map<string, Critter>();
  private basket: Phaser.GameObjects.Image | null = null;

  constructor(private scene: Phaser.Scene, private def: MapDef, private loc: LocationState) {}

  private open = (x: number, y: number): boolean => !isSolidTile(this.def, this.loc, x, y);

  /** Make the animals match what the player owns. Called when the farm is built. */
  sync(st: GameState): void {
    const hens = coopBuilt(st) ? henList(st) : [];
    const wanted = new Set([...hens.map((h) => h.id), ...(catOf(st) ? ['cat'] : [])]);
    for (const [id, c] of this.all) {
      if (!wanted.has(id)) {
        c.destroy();
        this.all.delete(id);
      }
    }
    hens.forEach((h, i) => {
      if (this.all.has(h.id)) return;
      const at = { x: PEN.x + 1 + ((i * 2) % (PEN.w - 2)), y: PEN.y + 1 + (i % 2) };
      const colour = i % 2 ? 'white' : 'brown';
      const chick = isChick(st, h);
      const frames = chick
        ? { idle: 'critter/chick-idle', walk: ['critter/chick-idle', 'critter/chick-walk'] as [string, string] }
        : {
          idle: `critter/hen-${colour}-idle`,
          walk: [`critter/hen-${colour}-walk0`, `critter/hen-${colour}-walk1`] as [string, string],
          peck: [`critter/hen-${colour}-peck0`, `critter/hen-${colour}-peck1`] as [string, string],
        };
      this.all.set(h.id, new Critter(this.scene, h, frames, at, chick ? 16 : 13));
    });
    const cat = catOf(st);
    if (cat && !this.all.has('cat')) {
      const frames = { idle: 'critter/cat-sit', walk: ['critter/cat-walk0', 'critter/cat-walk1'] as [string, string], sleep: 'critter/cat-sleep' };
      this.all.set('cat', new Critter(this.scene, cat, frames, { x: 12, y: 12 }, 22));
    }
    if (hens.length > 0 && !this.basket) {
      this.basket = this.scene.add.image((COOP.x + COOP.w / 2) * 16 + 20, (COOP.y + COOP.h) * 16 + 2, 'atlas', 'prop/egg-basket').setOrigin(0.5, 1).setVisible(false);
      this.basket.setDepth(this.basket.y);
    }
  }

  update(dt: number, st: GameState): void {
    const night = st.minute >= 19 * 60 + 30;
    const stormy = st.weather === 'rain' || st.weather === 'storm' || st.weather === 'snow';
    const indoors = night || stormy;
    for (const c of this.all.values()) {
      const isCat = c.pet.kind === 'cat';
      c.setVisible(isCat || !indoors);
      c.update(dt, isCat ? YARD : PEN, this.open, isCat && (night || st.weather === 'storm'));
    }
    this.basket?.setVisible(eggsWaiting(st) > 0);
  }

  /** Which animal is at or beside this tile. */
  at(tx: number, ty: number): Pet | null {
    for (const c of this.all.values()) {
      if (!c.sprite.visible) continue;
      if (Math.hypot(c.x - (tx * 16 + 8), c.y - 8 - (ty * 16 + 8)) < 11) return c.pet;
    }
    return null;
  }

  position(id: string): { x: number; y: number } | null {
    const c = this.all.get(id);
    return c ? { x: c.x, y: c.y } : null;
  }

  destroy(): void {
    for (const c of this.all.values()) c.destroy();
    this.all.clear();
    this.basket?.destroy();
    this.basket = null;
  }
}
