import type { MapDef } from '../world/mapkit';
import type { Rand } from './rng';
import type { Dir, Season, Weather } from './types';
import { DIR_VEC } from './types';

export interface Conditions {
  map: string;
  season: Season;
  /** Minutes since midnight. */
  minute: number;
  weather: Weather;
  /** 0 to 3: how good the rod is. */
  rodTier: number;
}

interface FishDef {
  id: string;
  weight: number;
  maps: readonly string[];
  /** How hard the fight is, 0 to 1. */
  difficulty: number;
  when?: (c: Conditions) => boolean;
}

const WET: readonly Weather[] = ['rain', 'storm'];
const DUSK = 17 * 60;

const FISH: readonly FishDef[] = [
  { id: 'fish-minnow', weight: 40, maps: ['lake', 'forest'], difficulty: 0.12 },
  { id: 'fish-perch', weight: 28, maps: ['lake', 'forest'], difficulty: 0.3 },
  { id: 'fish-carp', weight: 20, maps: ['lake', 'forest'], difficulty: 0.42, when: (c) => c.season !== 'winter' },
  { id: 'fish-trout', weight: 24, maps: ['lake'], difficulty: 0.5, when: (c) => c.season !== 'fall' },
  { id: 'fish-eel', weight: 14, maps: ['lake'], difficulty: 0.66, when: (c) => c.minute >= DUSK && (c.season === 'fall' || WET.includes(c.weather)) },
  { id: 'fish-koi', weight: 2.2, maps: ['lake'], difficulty: 0.92, when: (c) => c.minute >= 18 * 60 },
];

/** What is lurking in the water right now. Junk is never listed here; it is rolled separately. */
export function fishHere(c: Conditions): FishDef[] {
  return FISH.filter((f) => f.maps.includes(c.map) && (!f.when || f.when(c)));
}

export interface Catch {
  /** Item id, or null when the line only snags weeds. */
  item: string | null;
  difficulty: number;
}

export function rollCatch(rand: Rand, c: Conditions): Catch {
  const list = fishHere(c);
  const wet = WET.includes(c.weather) ? 1.25 : 1;
  const weights = list.map((f) => f.weight * (f.difficulty > 0.4 ? wet : 1));
  const junk = 7;
  let roll = rand() * (weights.reduce((a, b) => a + b, 0) + junk);
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i] as number;
    if (roll <= 0) return { item: (list[i] as FishDef).id, difficulty: (list[i] as FishDef).difficulty };
  }
  return { item: null, difficulty: 0 };
}

/** Seconds before something bites. Dawn, dusk and rain are the best times, and a better rod helps. */
export function biteDelay(rand: Rand, c: Conditions): number {
  const golden = (c.minute >= 6 * 60 && c.minute < 8 * 60) || (c.minute >= 17 * 60 && c.minute < 20 * 60);
  const base = 1.8 + rand() * 3.4;
  const k = (golden ? 0.72 : 1) * (WET.includes(c.weather) ? 0.85 : 1) * (1 - c.rodTier * 0.07);
  return Math.max(1.1, base * k);
}

/** Water you can cast into: open water, not the planks of a dock that happen to sit over it. */
export function isFishable(map: MapDef, x: number, y: number): boolean {
  if (map.kind !== 'outdoor' || x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  const i = y * map.w + x;
  return map.ground[i] === 0 && map.overlay[i] === 0;
}

const REACH = 5;

/** The first bit of open water along the line the farmer is facing, up to five tiles out. */
export function castTarget(map: MapDef, px: number, py: number, dir: Dir): { x: number; y: number } | null {
  const v = DIR_VEC[dir];
  const tx = Math.floor(px / 16);
  const ty = Math.floor((py - 1) / 16);
  for (let d = 1; d <= REACH; d++) {
    const x = tx + v.x * d;
    const y = ty + v.y * d;
    if (isFishable(map, x, y)) return { x, y };
    // a tree, a wall or a building stops the cast
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
    if (map.solid[y * map.w + x] && map.ground[y * map.w + x] !== 0) return null;
  }
  return null;
}

// ---------------------------------------------------------------- the fight

/** The tug of war after the hook is set. Everything runs from 0 (bottom) to 1 (top) along the track. */
export class FishFight {
  /** Where the fish is. */
  fish = 0.5;
  /** Centre of the green bar. */
  zone = 0.3;
  /** Progress towards landing it. */
  progress = 0.32;
  elapsed = 0;
  /** True while you never let the fish slip out of the green once the fight is properly on. */
  perfect = true;
  state: 'on' | 'won' | 'lost' = 'on';
  readonly size: number;
  private vel = 0;
  private target = 0.5;
  private retarget = 0.6;
  private dart = 0;

  constructor(private rand: Rand, readonly difficulty: number, size: number) {
    this.size = Math.max(0.14, Math.min(0.5, size));
    this.zone = this.size / 2 + 0.02;
  }

  /** The bottom and top edge of the green bar, so the caller can draw it. */
  get low(): number {
    return this.zone - this.size / 2;
  }
  get high(): number {
    return this.zone + this.size / 2;
  }
  get inside(): boolean {
    return this.fish >= this.low - 0.01 && this.fish <= this.high + 0.01;
  }

  step(dt: number, holding: boolean): void {
    if (this.state !== 'on') return;
    this.elapsed += dt;
    // the green bar rises while held and drops when let go, with a little weight to it
    this.vel = holding ? Math.min(0.9, this.vel + 3.4 * dt) : Math.max(-0.9, this.vel - 2.7 * dt);
    this.zone += this.vel * dt;
    const lo = this.size / 2, hi = 1 - this.size / 2;
    if (this.zone < lo) { this.zone = lo; this.vel = Math.abs(this.vel) * 0.25; }
    if (this.zone > hi) { this.zone = hi; this.vel = -Math.abs(this.vel) * 0.25; }

    // the fish picks somewhere to go; hard ones go farther, switch sooner, and sometimes bolt
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 1.6 - this.difficulty * 1.0 + this.rand() * 0.6;
      this.target = 0.05 + this.rand() * 0.9;
      this.dart = this.rand() < this.difficulty * 0.7 ? 0.35 : 0;
    }
    this.dart = Math.max(0, this.dart - dt);
    const speed = (0.17 + this.difficulty * 0.55) * (this.dart > 0 ? 2.2 : 1);
    const d = this.target - this.fish;
    this.fish += Math.sign(d) * Math.min(Math.abs(d), speed * dt);

    const grace = this.elapsed < 1.4;
    if (this.inside) {
      this.progress += (0.105 - this.difficulty * 0.03) * dt;
    } else if (!grace) {
      this.progress -= (0.12 + this.difficulty * 0.1) * dt;
      this.perfect = false;
    }
    if (this.progress >= 1) { this.progress = 1; this.state = 'won'; }
    else if (this.progress <= 0) { this.progress = 0; this.state = 'lost'; }
    else if (this.elapsed > 45) this.state = 'lost';
  }
}

/** How big the green bar is: a better rod and a bit of advice from Tam both help. */
export function barSize(rodTier: number, tamTips: boolean): number {
  return 0.3 + rodTier * 0.035 + (tamTips ? 0.06 : 0);
}
