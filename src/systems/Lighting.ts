import Phaser from 'phaser';
import { settings } from '../game/settings';
import type { LightSpot } from '../world/ObjectsView';
import { DEPTH } from '../world/MapView';
import type { CameraRig } from './CameraRig';
import { lampOn, pack, rgb } from './sky';
import type { SkyState } from './sky';

/**
 * Multiplying can only darken, so a green field goes dark green however blue the night is. Adding this much blue back, scaled by how
 * dark it is, is what turns the shadows blue and leaves the lamplight warm against them.
 */
const NIGHT_LIFT = rgb(0x0c1640);


/** A multiplied light map: the ambient colour with warm pools of light added where lamps and windows are. */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private halos: Phaser.GameObjects.Image[] = [];
  private lift: Phaser.GameObjects.Rectangle | null = null;
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
    this.lift?.destroy();
    this.w = w;
    this.h = h;
    this.rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lift = this.scene.add.rectangle(0, 0, w, h, 0x000000).setOrigin(0, 0).setDepth(DEPTH.light + 50).setBlendMode(Phaser.BlendModes.ADD);
  }

  update(sky: SkyState, time: number, glows: Phaser.GameObjects.Image[], extra: LightSpot[] = []): void {
    const bright = sky.ambient === 0xffffff && sky.glow === 0 && sky.lamps < 0.02 && extra.length === 0;
    for (const g of glows) g.setAlpha(lampOn(sky.lamps, g.x, g.y));
    if (bright) {
      this.rt?.setVisible(false);
      this.lift?.setVisible(false);
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
    const lift = this.lift as Phaser.GameObjects.Rectangle;
    const k = sky.lift;
    const glow = rgb(sky.glow);
    const added = [NIGHT_LIFT[0] * k + glow[0], NIGHT_LIFT[1] * k + glow[1], NIGHT_LIFT[2] * k + glow[2]] as [number, number, number];
    lift.setVisible(added[0] + added[1] + added[2] > 2).setPosition(ox, oy).setFillStyle(pack(added), 1);
    const all = this.spots.concat(extra);
    all.forEach((s, i) => {
      const flick = s.flicker && !settings.calm ? 1 + Math.sin(time * 0.011 + i * 1.7) * 0.035 + Math.sin(time * 0.037 + i) * 0.02 : 1;
      const r = s.r * flick;
      if (s.x + r < ox || s.x - r > ox + this.w || s.y + r < oy || s.y - r > oy + this.h) return;
      const on = lampOn(sky.lamps, s.x, s.y);
      if (on <= 0.01) return;
      rt.stamp('atlas', 'fx/glow-128', s.x - ox, s.y - oy, { originX: 0.5, originY: 0.5, scale: r / 64, tint: s.color, alpha: Math.min(1, on * 1.15), blendMode: Phaser.BlendModes.ADD });
    });
    rt.render();
    this.spots.forEach((s, i) => {
      const h = this.halos[i];
      if (!h) return;
      const flick = s.flicker && !settings.calm ? 1 + Math.sin(time * 0.011 + i * 1.7) * 0.03 : 1;
      h.setAlpha(lampOn(sky.lamps, s.x, s.y) * 0.2).setScale((s.r * 0.8 * flick) / 64);
    });
  }
}
