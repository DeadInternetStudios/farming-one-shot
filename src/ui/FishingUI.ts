import Phaser from 'phaser';
import { PAL } from '../gen/art';
import { itemDef } from '../data/items';
import { minutesPerSecond } from '../game/clock';
import { FishFight } from '../game/fishing';
import { mulberry32 } from '../game/rng';
import { session } from '../game/session';
import { watchKey } from '../systems/keys';
import { COL } from './kit';
import { Screen, isBack } from './Screens';
import type { Host } from './Screens';

export interface FishRequest {
  item: string;
  difficulty: number;
  /** How tall the green bar is, as a share of the track. */
  size: number;
  done: (won: boolean, perfect: boolean) => void;
}

const TRACK_H = 100;
const TRACK_W = 18;
const PANEL_W = 86;
const PANEL_H = 150;

/** Hold to lift the green bar and keep the fish inside it. Let go and it sinks. */
export class FishingScreen extends Screen {
  private fight: FishFight;
  private holding = false;
  private over = false;
  private zone!: Phaser.GameObjects.NineSlice;
  private fill!: Phaser.GameObjects.NineSlice;
  private icon!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private meterX = 0;
  private banner!: Phaser.GameObjects.BitmapText;
  private trackTop = 0;
  private clock = 0;
  private lastInside = true;

  constructor(host: Host, private req: FishRequest) {
    super(host);
    this.fight = new FishFight(mulberry32((Math.random() * 1e9) | 0), req.difficulty, req.size);
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.18);
    const x = l.uiW - PANEL_W - 10;
    const y = Math.round((l.uiH - PANEL_H) / 2);
    this.trackTop = y + 24;
    bag.panel(x, y, PANEL_W, PANEL_H, 'dark');
    bag.text(x + PANEL_W / 2, y + 8, 'On the line!', { origin: [0.5, 0] });
    const tx = x + 14;
    bag.add(this.scene.add.nineslice(tx, this.trackTop, 'atlas', 'ui/fish-track', TRACK_W, TRACK_H, 4, 4, 4, 4).setOrigin(0, 0), 1);
    this.zone = bag.add(this.scene.add.nineslice(tx, this.trackTop, 'atlas', 'ui/fish-zone', TRACK_W, 30, 4, 4, 4, 4).setOrigin(0, 0), 2);
    const cx = tx + TRACK_W / 2;
    this.shadow = bag.img(cx, this.trackTop + TRACK_H / 2 + 1, itemDef(this.req.item).icon, [0.5, 0.5], 3).setTint(PAL.ink[0]).setTintMode(Phaser.TintModes.FILL).setAlpha(0.55);
    this.icon = bag.img(cx, this.trackTop + TRACK_H / 2, itemDef(this.req.item).icon, [0.5, 0.5], 4);
    this.meterX = x + PANEL_W - 14 - 16;
    bag.add(this.scene.add.nineslice(this.meterX, this.trackTop, 'atlas', 'ui/fish-track', 14, TRACK_H, 4, 4, 4, 4).setOrigin(0, 0), 1);
    this.fill = bag.add(this.scene.add.nineslice(this.meterX, this.trackTop + TRACK_H, 'atlas', 'ui/fish-meter', 14, 8, 4, 4, 4, 4).setOrigin(0, 1), 2);
    const hint = l.touch ? 'Hold anywhere' : 'Hold E / Space';
    bag.text(x + PANEL_W / 2, y + PANEL_H - 15, hint, { origin: [0.5, 0], tint: COL.cream });
    this.banner = bag.text(x + PANEL_W / 2, y + PANEL_H / 2 - 4, '', { origin: [0.5, 0.5], outline: true, tint: COL.gold });
    this.banner.setDepth(bag.depth + 9);
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __fight: unknown }).__fight = this.fight;

    const down = (ev: KeyboardEvent): void => { if (ev.code === 'Space' || ev.code === 'KeyE' || ev.code === 'Enter') this.holding = true; };
    const up = (ev: KeyboardEvent): void => { if (ev.code === 'Space' || ev.code === 'KeyE' || ev.code === 'Enter') this.holding = false; };
    const pdown = (): void => { this.holding = true; };
    const pup = (): void => { this.holding = false; };
    const stopDown = watchKey(this.scene, 'keydown', down);
    const stopUp = watchKey(this.scene, 'keyup', up);
    this.scene.input.on('pointerdown', pdown);
    this.scene.input.on('pointerup', pup);
    this.scene.input.on('pointerupoutside', pup);
    this.own({
      destroy: () => {
        stopDown();
        stopUp();
        this.scene.input.off('pointerdown', pdown);
        this.scene.input.off('pointerup', pup);
        this.scene.input.off('pointerupoutside', pup);
      },
    });
    this.paint();
  }

  override onKey(code: string): void {
    if (isBack(code) && !this.over) this.end(false);
  }

  override update(): void {
    if (this.over) return;
    const dt = Math.min(0.05, this.scene.game.loop.delta / 1000);
    this.clock += dt;
    // the day does not stop for a fish: it takes the time it takes
    const st = session.state;
    st.minute += dt * minutesPerSecond(st.pace);
    this.fight.step(dt, this.holding);
    const inside = this.fight.inside;
    if (inside !== this.lastInside) {
      this.lastInside = inside;
      if (inside) session.events.emit('sfx', 'tick');
    }
    this.paint();
    if (this.fight.state !== 'on') this.end(this.fight.state === 'won');
  }

  private paint(): void {
    const f = this.fight;
    const h = Math.round(f.size * TRACK_H);
    this.zone.setSize(TRACK_W, h).setY(Math.round(this.trackTop + (1 - f.high) * TRACK_H));
    this.zone.setAlpha(f.inside ? 1 : 0.8);
    const fy = Math.round(this.trackTop + (1 - f.fish) * TRACK_H);
    const wiggle = Math.sin(this.clock * (8 + f.difficulty * 10)) * (4 + f.difficulty * 8);
    this.icon.setY(fy).setAngle(wiggle);
    this.shadow.setY(fy + 1).setAngle(wiggle);
    const fillH = Math.max(0, Math.round(f.progress * (TRACK_H - 4)));
    this.fill.setVisible(fillH >= 4).setSize(14, Math.max(8, fillH + 4)).setX(this.meterX);
  }

  private end(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.banner.setText(won ? (this.fight.perfect ? 'Perfect!' : 'Got it!') : 'Lost it...');
    this.scene.time.delayedCall(700, () => {
      this.close();
      this.req.done(won, won && this.fight.perfect);
    });
  }
}
