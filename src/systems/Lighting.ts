import Phaser from 'phaser';
import { daylight, goldenHour } from '../game/clock';
import { settings } from '../game/settings';
import type { Season, Weather } from '../game/types';
import type { MapKind } from '../world/mapkit';
import type { LightSpot } from '../world/ObjectsView';
import { DEPTH } from '../world/MapView';
import type { CameraRig } from './CameraRig';

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const pack = (c: [number, number, number]): number => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const NIGHT = rgb(0x39467c);
const DAYC = rgb(0xffffff);
const GOLD = rgb(0xffcf94);
const WEATHER_TINT: Record<Weather, [number, number, number]> = {
  sun: [1, 1, 1], cloud: [0.9, 0.92, 0.96], rain: [0.74, 0.8, 0.92], storm: [0.55, 0.6, 0.78], snow: [0.9, 0.95, 1],
};

export interface SkyState {
  /** Multiply colour for the whole scene. */
  ambient: number;
  /** 0 by day, 1 in the dead of night: how much lamps and windows are on. */
  lamps: number;
  day: number;
}

const ROOM_DAY = rgb(0xf6e8d2);
const ROOM_NIGHT = rgb(0x9a8aa6);

const CAVE = rgb(0x4a5688);

export function skyFor(season: Season, minute: number, weather: Weather, kind: MapKind): SkyState {
  const day = daylight(season, minute);
  if (kind === 'cave') return { ambient: pack(CAVE), lamps: 1, day: 0 };
  if (kind === 'interior') {
    const t = smooth(0.05, 0.9, day);
    return { ambient: pack(mix(ROOM_NIGHT, ROOM_DAY, t)), lamps: 0.55 + (1 - t) * 0.45, day };
  }
  const golden = goldenHour(season, minute);
  let c = mix(NIGHT, DAYC, smooth(0, 1, day));
  c = mix(c, GOLD, golden * 0.85 * smooth(0.05, 0.5, day));
  const w = WEATHER_TINT[weather];
  const wt = Math.max(0, Math.min(1, day * 1.2));
  c = [c[0] * (1 + (w[0] - 1) * wt), c[1] * (1 + (w[1] - 1) * wt), c[2] * (1 + (w[2] - 1) * wt)];
  const lamps = Math.max(0, Math.min(1, 1 - day * 1.15 + golden * 0.25 + (weather === 'storm' ? 0.35 : weather === 'rain' ? 0.15 : 0)));
  return { ambient: pack(c), lamps, day };
}

/** A multiplied light map: the ambient colour with warm pools of light added where lamps and windows are. */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private halos: Phaser.GameObjects.Image[] = [];
  private w = 0;
  private h = 0;

  constructor(private scene: Phaser.Scene, private rig: CameraRig, private spots: LightSpot[]) {
    this.setSpots(spots);
  }

  /** Swap in the lights of a new map. */
  setSpots(spots: LightSpot[]): void {
    for (const h of this.halos) h.destroy();
    this.spots = spots;
    this.halos = spots.map((s) =>
      this.scene.add.image(s.x, s.y, 'atlas', 'fx/glow-128').setTint(s.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0).setScale(s.r / 64),
    );
  }

  private ensure(): void {
    const w = Math.ceil(this.rig.viewW) + 4;
    const h = Math.ceil(this.rig.viewH) + 4;
    if (this.rt && w === this.w && h === this.h) return;
    this.rt?.destroy();
    this.w = w;
    this.h = h;
    this.rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  update(sky: SkyState, time: number, glows: Phaser.GameObjects.Image[], extra: LightSpot[] = []): void {
    const bright = sky.ambient === 0xffffff && sky.lamps < 0.02 && extra.length === 0;
    for (const g of glows) g.setAlpha(Math.min(1, sky.lamps * 1.25));
    if (bright) {
      this.rt?.setVisible(false);
      for (const h of this.halos) h.setAlpha(0);
      return;
    }
    this.ensure();
    const rt = this.rt as Phaser.GameObjects.RenderTexture;
    rt.setVisible(true);
    const ox = this.rig.vx - 2;
    const oy = this.rig.vy - 2;
    rt.setPosition(ox, oy);
    rt.fill(sky.ambient, 1);
    const all = this.spots.concat(extra);
    all.forEach((s, i) => {
      const flick = s.flicker && !settings.calm ? 1 + Math.sin(time * 0.011 + i * 1.7) * 0.035 + Math.sin(time * 0.037 + i) * 0.02 : 1;
      const r = s.r * flick;
      if (s.x + r < ox || s.x - r > ox + this.w || s.y + r < oy || s.y - r > oy + this.h) return;
      rt.stamp('atlas', 'fx/glow-128', s.x - ox, s.y - oy, { originX: 0.5, originY: 0.5, scale: r / 64, tint: s.color, alpha: Math.min(1, sky.lamps * 1.15 + 0.05), blendMode: Phaser.BlendModes.ADD });
    });
    rt.render();
    this.spots.forEach((s, i) => {
      const h = this.halos[i];
      if (!h) return;
      const flick = s.flicker && !settings.calm ? 1 + Math.sin(time * 0.011 + i * 1.7) * 0.03 : 1;
      h.setAlpha(sky.lamps * 0.2).setScale((s.r * 0.8 * flick) / 64);
    });
  }
}
