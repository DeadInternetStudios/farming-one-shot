import Phaser from 'phaser';
import { session } from '../game/session';
import { settings } from '../game/settings';
import type { Season, Weather } from '../game/types';
import type { MapKind } from '../world/mapkit';
import type { CameraRig } from './CameraRig';

type Kind = 'rain' | 'snow' | 'petal' | 'leaf' | 'firefly';

interface Mote {
  img: Phaser.GameObjects.Image;
  /** A soft glow behind a firefly. */
  halo?: Phaser.GameObjects.Image;
  kind: Kind;
  /** Position inside the view, so the weather stays put on screen while the camera moves. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface Sky {
  season: Season;
  weather: Weather;
  minute: number;
  kind: MapKind;
}

const DEPTH = 8500;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** Rain, snow, drifting petals and leaves, and fireflies at dusk. Everything lives in view space. */
export class Ambient {
  private motes: Mote[] = [];
  private splashes: { img: Phaser.GameObjects.Image; life: number }[] = [];
  private nextFlash = 6;
  private clock = 0;

  constructor(private scene: Phaser.Scene, private rig: CameraRig) {}

  update(dt: number, sky: Sky): void {
    this.clock += dt;
    const w = this.rig.viewW;
    const h = this.rig.viewH;
    const want = this.wanted(sky, w * h);
    for (const kind of ['rain', 'snow', 'petal', 'leaf', 'firefly'] as const) this.fit(kind, want[kind], w, h);
    const ox = this.rig.vx;
    const oy = this.rig.vy;
    const storm = sky.weather === 'storm';
    for (const m of this.motes) {
      m.phase += dt;
      switch (m.kind) {
        case 'rain': {
          const fall = storm ? 1.25 : 1;
          m.x += m.vx * fall * dt;
          m.y += m.vy * fall * dt;
          if (m.y > h) {
            if (Math.random() < 0.35) this.splash(ox + m.x, oy + rnd(h * 0.2, h));
            m.y = rnd(-16, -2);
            m.x = rnd(-20, w + 40);
          }
          break;
        }
        case 'snow':
          m.x += (m.vx + Math.sin(m.phase * 1.3) * 9) * dt;
          m.y += m.vy * dt;
          break;
        case 'petal':
        case 'leaf':
          m.x += (m.vx + Math.sin(m.phase * 1.7) * 8) * dt;
          m.y += (m.vy + Math.cos(m.phase * 2.1) * 5) * dt;
          if (m.kind === 'leaf') m.img.setAngle(Math.sin(m.phase * 2.4) * 40);
          break;
        case 'firefly':
          m.x += Math.cos(m.phase * 0.7 + m.vx) * 6 * dt;
          m.y += Math.sin(m.phase * 0.9 + m.vy) * 5 * dt;
          {
            const glow = 0.3 + 0.7 * Math.max(0, Math.sin(m.phase * 2.2 + m.vx * 3));
            m.img.setAlpha(glow);
            m.halo?.setAlpha(glow * 0.45);
          }
          break;
      }
      if (m.kind !== 'firefly') {
        if (m.x > w + 12) m.x = -10;
        if (m.x < -24) m.x = w + 10;
        if (m.y > h + 12) { m.y = -8; m.x = rnd(0, w); }
      } else {
        m.x = Phaser.Math.Clamp(m.x, 4, w - 4);
        m.y = Phaser.Math.Clamp(m.y, 8, h - 4);
      }
      m.img.setPosition(Math.round(ox + m.x), Math.round(oy + m.y));
      m.halo?.setPosition(Math.round(ox + m.x), Math.round(oy + m.y));
    }
    for (const s of this.splashes) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.img.setAlpha(Math.max(0, s.life / 0.24) * 0.8).setVisible(s.life > 0);
    }
    this.lightning(dt, storm && sky.kind === 'outdoor');
  }

  /** For tests: how many of each kind are alive. */
  count(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of this.motes) out[m.kind] = (out[m.kind] ?? 0) + 1;
    return out;
  }

  destroy(): void {
    for (const m of this.motes) { m.img.destroy(); m.halo?.destroy(); }
    for (const s of this.splashes) s.img.destroy();
    this.motes = [];
    this.splashes = [];
  }

  private wanted(sky: Sky, area: number): Record<Kind, number> {
    const none = { rain: 0, snow: 0, petal: 0, leaf: 0, firefly: 0 };
    if (sky.kind !== 'outdoor') return none;
    const night = sky.minute >= 19 * 60 + 30 || sky.minute < 5 * 60;
    const dry = sky.weather === 'sun' || sky.weather === 'cloud';
    // calm mode keeps the weather readable with a lot less moving at once
    const k = settings.calm ? 0.35 : 1;
    return {
      rain: Math.round((sky.weather === 'rain' ? Math.min(260, area / 430) : sky.weather === 'storm' ? Math.min(380, area / 260) : 0) * (settings.calm ? 0.55 : 1)),
      snow: Math.round((sky.weather === 'snow' ? Math.min(220, area / 520) : 0) * k),
      petal: sky.season === 'spring' && dry && !night ? Math.round((area / 6000) * k) : 0,
      leaf: sky.season === 'fall' && sky.weather !== 'storm' && !night ? Math.round((area / 4200) * k) : 0,
      firefly: night && dry && sky.season !== 'winter' ? Math.round((area / 5200) * k) : 0,
    };
  }

  /** Grow or shrink the crowd of one kind a few at a time. */
  private fit(kind: Kind, n: number, w: number, h: number): void {
    let have = 0;
    for (const m of this.motes) if (m.kind === kind) have += 1;
    for (let i = 0; i < 8 && have < n; i++, have++) this.motes.push(this.make(kind, w, h));
    for (let i = 0; i < 14 && have > n; i++, have--) {
      const at = this.motes.findIndex((m) => m.kind === kind);
      if (at < 0) break;
      this.motes[at]?.img.destroy();
      this.motes[at]?.halo?.destroy();
      this.motes.splice(at, 1);
    }
  }

  private make(kind: Kind, w: number, h: number): Mote {
    const x = rnd(0, w);
    const y = kind === 'firefly' ? rnd(h * 0.3, h) : rnd(-8, h);
    const frame = {
      rain: 'fx/rain', snow: 'fx/snow', petal: 'fx/petal', leaf: `fx/leaf-autumn/${Math.floor(rnd(0, 3))}`, firefly: `fx/firefly/${Math.floor(rnd(0, 2))}`,
    }[kind];
    const img = this.scene.add.image(0, 0, 'atlas', frame).setDepth(DEPTH);
    let halo: Phaser.GameObjects.Image | undefined;
    if (kind === 'rain') img.setTint(0xdcecff).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD).setScale(1, 1.2);
    if (kind === 'firefly') {
      img.setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH + 700).setTint(0xf4ff9a);
      halo = this.scene.add.image(0, 0, 'atlas', 'fx/glow-48').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH + 699).setTint(0xc6ff6a).setScale(0.36);
    }
    if (kind === 'snow') img.setTint(0xb4cdf0).setScale(rnd(1, 1.7));
    if (kind === 'petal' || kind === 'leaf') img.setScale(1.25);
    const m: Mote = { img, halo, kind, x, y, vx: 0, vy: 0, phase: rnd(0, 20) };
    if (kind === 'rain') { m.vx = -38; m.vy = rnd(230, 290); }
    else if (kind === 'snow') { m.vx = rnd(-6, 6); m.vy = rnd(22, 38); }
    else if (kind === 'petal') { m.vx = rnd(10, 18); m.vy = rnd(8, 14); }
    else if (kind === 'leaf') { m.vx = rnd(14, 26); m.vy = rnd(12, 20); }
    else { m.vx = rnd(0, 6); m.vy = rnd(0, 6); }
    return m;
  }

  private splash(x: number, y: number): void {
    let s = this.splashes.find((p) => p.life <= 0);
    if (!s) {
      if (this.splashes.length >= 36) return;
      s = { img: this.scene.add.image(0, 0, 'atlas', 'fx/raindrop').setDepth(DEPTH - 1), life: 0 };
      this.splashes.push(s);
    }
    s.life = 0.24;
    s.img.setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(0.8);
  }

  private lightning(dt: number, storm: boolean): void {
    if (!storm) { this.nextFlash = 5 + Math.random() * 6; return; }
    this.nextFlash -= dt;
    if (this.nextFlash > 0) return;
    this.nextFlash = 7 + Math.random() * 11;
    if (!settings.calm) this.scene.cameras.main.flash(170, 230, 236, 255, true);
    this.scene.time.delayedCall(450 + Math.random() * 900, () => session.events.emit('sfx', 'thunder'));
  }
}
