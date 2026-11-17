import Phaser from 'phaser';
import { findPath } from '../game/pathfind';
import type { Tile } from '../game/pathfind';
import { npcsOnMap } from '../game/social';
import type { GameState } from '../game/state';
import type { Dir } from '../game/types';
import type { MapDef } from '../world/mapkit';

const SPEED = 26;

const frameDir = (d: Dir): 'down' | 'up' | 'side' => (d === 'left' || d === 'right' ? 'side' : d);
const tileOf = (x: number, y: number): Tile => ({ x: Math.floor(x / 16), y: Math.floor((y - 1) / 16) });

/** One villager on one map: stands, walks a tile path, and fades in or out at their door. */
class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  facing: Dir;
  /** Where they will end up, and which way they face when they get there. */
  stopKey = '';
  private path: Tile[] = [];
  private finalDir: Dir = 'down';
  private walking = false;
  private leaving = false;
  private onArrive: (() => void) | null = null;

  constructor(private scene: Phaser.Scene, readonly id: string, at: Tile, dir: Dir, fadeIn: boolean) {
    this.x = at.x * 16 + 8;
    this.y = at.y * 16 + 14;
    this.facing = dir;
    this.shadow = scene.add.image(this.x, this.y, 'atlas', 'fx/shadow-s').setAlpha(0.55);
    this.sprite = scene.add.sprite(this.x, this.y, 'chars', `npc/${id}/walk-${frameDir(dir)}-0`).setOrigin(0.5, 30 / 40);
    this.place();
    if (fadeIn) this.fade(0, 1, () => undefined);
  }

  get tile(): Tile {
    return tileOf(this.x, this.y);
  }

  private place(): void {
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    this.sprite.setPosition(px, py).setDepth(py).setFlipX(this.facing === 'left');
    this.shadow.setPosition(px, py - 1).setDepth(py - 0.5);
  }

  private fade(from: number, to: number, done: () => void): void {
    this.sprite.setAlpha(from);
    this.shadow.setAlpha(from * 0.55);
    this.scene.tweens.add({
      targets: this.sprite, alpha: to, duration: 260,
      onUpdate: () => this.shadow.setAlpha(this.sprite.alpha * 0.55),
      onComplete: done,
    });
  }

  walk(path: Tile[], finalDir: Dir): void {
    this.path = path;
    this.finalDir = finalDir;
    if (path.length === 0) this.arrive();
  }

  /** Walk to the door and vanish. */
  leave(path: Tile[] | null, done: () => void): void {
    this.leaving = true;
    const finish = (): void => this.fade(1, 0, done);
    if (!path || path.length === 0) {
      finish();
      return;
    }
    this.path = path;
    this.onArrive = finish;
  }

  face(dir: Dir): void {
    this.facing = dir;
    if (!this.walking) this.stand();
  }

  teleport(at: Tile): void {
    this.x = at.x * 16 + 8;
    this.y = at.y * 16 + 14;
    this.path = [];
    this.arrive();
  }

  private stand(): void {
    this.walking = false;
    this.sprite.anims.stop();
    this.sprite.setFrame(`npc/${this.id}/walk-${frameDir(this.facing)}-0`);
    this.place();
  }

  private arrive(): void {
    this.facing = this.finalDir;
    this.stand();
    const cb = this.onArrive;
    this.onArrive = null;
    cb?.();
  }

  update(dt: number, blocked: (x: number, y: number) => boolean): void {
    const next = this.path[0];
    if (!next) {
      if (this.walking) this.arrive();
      return;
    }
    if (blocked(next.x, next.y)) {
      if (this.walking) {
        this.walking = false;
        this.sprite.anims.stop();
        this.sprite.setFrame(`npc/${this.id}/walk-${frameDir(this.facing)}-0`);
      }
      return;
    }
    const tx = next.x * 16 + 8;
    const ty = next.y * 16 + 14;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = SPEED * dt;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
    else if (dist > 0.01) this.facing = dy < 0 ? 'up' : 'down';
    if (dist <= step) {
      this.x = tx;
      this.y = ty;
      this.path.shift();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    const key = `npc-${this.id}-walk-${frameDir(this.facing)}`;
    if (!this.walking || this.sprite.anims.currentAnim?.key !== key) {
      this.walking = true;
      this.sprite.play(key, true);
    }
    this.place();
    if (this.path.length === 0) this.arrive();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  get isLeaving(): boolean {
    return this.leaving;
  }
}

/** Everyone from the village who is on this map right now, following the day's schedule. */
export class Npcs {
  private actors = new Map<string, Actor>();
  private gather = false;

  constructor(
    private scene: Phaser.Scene,
    private def: MapDef,
    /** True for tiles nobody can walk through: buildings and fixed props. */
    private solidAt: (x: number, y: number) => boolean,
  ) {}

  /** Call the whole valley to the green, or send them back to their day. */
  setGathered(on: boolean): void {
    this.gather = on;
  }

  /** Bring the cast in line with the clock. With `instant`, everyone simply appears where they belong. */
  sync(state: GameState, instant: boolean): void {
    const here = npcsOnMap(state, this.def.id, this.gather);
    const present = new Set(here.map((h) => h.npc.id));
    for (const { npc, stop } of here) {
      const key = `${stop.from}:${stop.x},${stop.y}`;
      const goal = { x: stop.x, y: stop.y };
      const dir: Dir = stop.dir ?? 'down';
      let a = this.actors.get(npc.id);
      if (a?.isLeaving) {
        a.destroy();
        this.actors.delete(npc.id);
        a = undefined;
      }
      if (!a) {
        const start = instant ? goal : (this.def.homes[npc.id] ?? goal);
        a = new Actor(this.scene, npc.id, start, dir, !instant);
        this.actors.set(npc.id, a);
        if (instant) {
          a.stopKey = key;
          continue;
        }
      }
      if (a.stopKey === key) continue;
      a.stopKey = key;
      if (instant) {
        a.teleport(goal);
        a.face(dir);
        continue;
      }
      const path = findPath(this.def.w, this.def.h, this.solidAt, a.tile, goal);
      if (path) a.walk(path, dir);
      else {
        a.teleport(goal);
        a.face(dir);
      }
    }
    for (const [id, a] of this.actors) {
      if (present.has(id) || a.isLeaving) continue;
      const home = this.def.homes[id];
      if (instant || !home) {
        a.destroy();
        this.actors.delete(id);
        continue;
      }
      a.stopKey = '';
      a.leave(findPath(this.def.w, this.def.h, this.solidAt, a.tile, home), () => {
        a.destroy();
        this.actors.delete(id);
      });
    }
  }

  update(dt: number, player: Tile): void {
    for (const a of [...this.actors.values()]) a.update(dt, (x, y) => (x === player.x && y === player.y) || this.at(x, y, a.id) !== null);
  }

  /** Who stands on this tile, if anyone. */
  at(x: number, y: number, except: string | null = null): string | null {
    for (const a of this.actors.values()) {
      if (a.id === except) continue;
      const t = a.tile;
      if (t.x === x && t.y === y) return a.id;
    }
    return null;
  }

  /** Where a villager is, in world pixels, for floating hearts and the like. */
  position(id: string): { x: number; y: number } | null {
    const a = this.actors.get(id);
    return a ? { x: a.x, y: a.y } : null;
  }

  face(id: string, dir: Dir): void {
    this.actors.get(id)?.face(dir);
  }

  destroy(): void {
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
  }
}
