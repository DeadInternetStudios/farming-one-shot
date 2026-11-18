import Phaser from 'phaser';
import { dayOfSeason, seasonOf } from '../game/clock';
import { loadGame } from '../game/save';
import { session } from '../game/session';
import { watchKey } from '../systems/keys';
import { saveSettings, settings } from '../game/settings';
import type { GameState } from '../game/state';
import { fitUiCamera, getLayout } from '../display';
import type { Layout } from '../display';
import { BLOB_INDEX, PAL, TILESET, TILE_ID } from '../gen/art';
import { audio } from '../systems/Audio';
import { COL, WARM_DARK, button, label, nine } from '../ui/kit';
import { money } from '../ui/money';
import type { Button } from '../ui/kit';

const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DUSK = 0xdcd2f0;
const HILL_W = 320;
const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;
const OFFS: readonly (readonly [number, number, number])[] = [[0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW]];

const D = { sky: 0, stars: 1, moon: 2, clouds: 3, farHills: 4, midHills: 5, nearHills: 6, ground: 8, dusk: 9, props: 20, life: 60, ui: 100 } as const;

interface Choice {
  text: string;
  kind: 'leaf' | 'wood' | 'berry' | 'sky';
  run: () => void;
}

/** The first screen: a dusk valley with a lit village, the logo, and a way in. */
export class TitleScene extends Phaser.Scene {
  private l!: Layout;
  private clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private lanterns: { parts: Phaser.GameObjects.Image[]; x: number; y: number; vy: number; phase: number; sway: number; life: number }[] = [];
  private flies: { img: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image; x: number; y: number; ax: number; ay: number; fx: number; fy: number; phase: number }[] = [];
  private spawnIn = 0;
  private buttons: Button[] = [];
  private choices: Choice[] = [];
  private pointer!: Phaser.GameObjects.Image;
  private picked = 0;
  private busy = false;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private ground = 0;
  private menuTop = 0;
  private menuStep = 0;
  private menuH = 0;
  private onResize = (next: Layout): void => {
    const same = next.devW === this.l.devW && next.devH === this.l.devH && next.dpr === this.l.dpr;
    if (!same) this.scene.restart();
  };

  constructor() {
    super('Title');
  }

  create(): void {
    this.l = getLayout();
    this.clouds = [];
    this.lanterns = [];
    this.flies = [];
    this.buttons = [];
    this.overlay = [];
    this.busy = false;
    this.picked = 0;
    const l = this.l;
    fitUiCamera(this.cameras.main, l);
    this.cameras.main.setBackgroundColor(PAL.ink[0]);
    this.cameras.main.fadeIn(500, 12, 9, 20);

    const short = l.uiH < 270;
    const rows = short ? 3 : 4;
    const ground = Math.floor(l.uiH) - rows * 16;
    this.ground = ground;
    const houseX = short ? Math.round(l.uiW * 0.3) : l.uiW >= 330 ? Math.floor(l.uiW / 2) - 150 : Math.floor(l.uiW / 2);
    this.sky(ground);
    this.hills(ground);
    this.meadow(ground, rows, houseX);
    this.yard(ground + (short ? 20 : 26), short, houseX);
    this.life(ground, short);
    this.header(short);
    this.menu(short);
    this.soundButton();

    watchKey(this, 'keydown', (ev) => this.onKey(ev));
    audio.override('title');
    this.game.events.on('layout', this.onResize, this);
    this.events.once('shutdown', () => this.game.events.off('layout', this.onResize, this));
  }

  // ------------------------------------------------------------------ the sky

  private sky(ground: number): void {
    const { uiW, uiH } = this.l;
    const w = Math.ceil(uiW) + 2;
    const h = Math.ceil(uiH) + 2;
    const key = 'title-sky';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const data = ctx.createImageData(w, h);
    const stops: readonly (readonly [number, number])[] = [
      [0, PAL.ink[0]], [0.16, PAL.ink[1]], [0.34, PAL.purple[0]], [0.5, PAL.purple[1]], [0.64, PAL.pink[0]], [0.78, PAL.red[2]], [0.9, PAL.orange[2]], [1, PAL.glow[1]],
    ];
    const reach = ground - 40;
    for (let y = 0; y < h; y++) {
      const t = Math.min(1, y / reach);
      let i = 0;
      while (i < stops.length - 2 && t > (stops[i + 1] as readonly [number, number])[0]) i++;
      const a = stops[i] as readonly [number, number];
      const b = stops[i + 1] as readonly [number, number];
      const u = (t - a[0]) / (b[0] - a[0]);
      for (let x = 0; x < w; x++) {
        const c = (BAYER[(y & 3) * 4 + (x & 3)] as number) / 16 + 1 / 32 < u ? b[1] : a[1];
        const o = (y * w + x) * 4;
        data.data[o] = (c >> 16) & 255;
        data.data[o + 1] = (c >> 8) & 255;
        data.data[o + 2] = c & 255;
        data.data[o + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    tex.refresh();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(D.sky);

    const rnd = new Phaser.Math.RandomDataGenerator(['stars']);
    for (let n = 0; n < Math.floor(uiW / 5); n++) {
      const x = rnd.between(2, Math.floor(uiW) - 2);
      const y = rnd.between(2, Math.floor(ground * 0.5));
      const big = rnd.frac() < 0.14;
      const s = this.add.image(x, y, 'title', big ? 'star/1' : 'star/0').setDepth(D.stars).setAlpha(0.35 + rnd.frac() * 0.5);
      this.tweens.add({ targets: s, alpha: 0.12, duration: rnd.between(900, 2600), delay: rnd.between(0, 2000), yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }

    const mx = Math.round(uiW * 0.8);
    const my = this.l.uiH < 270 ? 17 : Math.round(Math.min(ground * 0.3, 70));
    const halo = this.add.image(mx, my, 'atlas', 'fx/glow-128').setTint(0xf8f0dd).setAlpha(0.35).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.moon);
    this.tweens.add({ targets: halo, alpha: 0.5, duration: 3200, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.add.image(mx, my, 'title', 'moon').setDepth(D.moon + 0.1);

    const lanes = [0.5, 0.6, 0.7];
    lanes.forEach((f, i) => {
      const img = this.add.image(Math.round(uiW * (0.15 + i * 0.35)), Math.round(ground * f), 'title', `cloud/${i}`).setDepth(D.clouds).setAlpha(0.9);
      this.clouds.push({ img, speed: 1.6 + i * 1.1 });
    });
  }

  // ------------------------------------------------------------------ the far valley

  private strip(frame: string, top: number, depth: number, fill: number): void {
    const { uiW, uiH } = this.l;
    const h = (this.textures.getFrame('title', frame) as Phaser.Textures.Frame).height;
    for (let x = 0; x < uiW + 1; x += HILL_W) this.add.image(x, top, 'title', frame).setOrigin(0, 0).setDepth(depth);
    this.add.rectangle(0, top + h - 1, uiW + 2, uiH - (top + h) + 2, fill).setOrigin(0, 0).setDepth(depth - 0.1);
  }

  private hills(ground: number): void {
    this.strip('hills/far', ground - 122, D.farHills, PAL.purple[3]);
    this.strip('hills/mid', ground - 106, D.midHills, PAL.teal[2]);
    this.strip('hills/near', ground - 88, D.nearHills, PAL.leaf[1]);
  }

  // ------------------------------------------------------------------ the meadow

  private meadow(ground: number, rows: number, houseX: number): void {
    const { uiW } = this.l;
    const cols = Math.ceil(uiW / 16) + 1;
    const map = this.make.tilemap({ tileWidth: 16, tileHeight: 16, width: cols, height: rows });
    const ts = map.addTilesetImage('tiles', 'tiles-spring', 16, 16, TILESET.margin, TILESET.spacing);
    if (!ts) return;
    const layer = map.createBlankLayer('meadow', ts, 0, ground, cols, rows);
    if (!layer) return;
    layer.setDepth(D.ground);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) layer.putTileAt(TILE_ID.grassFull[(x * 7 + y * 13) % 6] as number, x, y);
    // a worn path from the door down to the edge of the screen
    const door = Math.floor((houseX - 8) / 16);
    this.paint(layer, TILE_ID.path, cols, rows, (x, y) => y >= 1 && x === door);
    // the dusk wash over the grass, and a dark fade where it meets the hills
    this.add.rectangle(0, ground, uiW + 2, rows * 16 + 2, 0xb9a9dc, 0.6).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(D.dusk);
    const fade = this.add.graphics().setDepth(D.dusk + 0.1);
    fade.fillGradientStyle(PAL.leaf[0], PAL.leaf[0], PAL.leaf[0], PAL.leaf[0], 0.9, 0.9, 0, 0);
    fade.fillRect(0, ground, uiW + 2, 14);
  }

  private paint(layer: Phaser.Tilemaps.TilemapLayer, base: number, cols: number, rows: number, on: (x: number, y: number) => boolean): void {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!on(x, y)) continue;
        let m = 0;
        for (const [dx, dy, bit] of OFFS) {
          const nx = x + dx;
          const ny = y + dy;
          const inside = nx >= 0 && nx < cols && ny >= 0 && ny < rows;
          if (inside ? on(nx, ny) : ny >= rows) m |= bit;
        }
        layer.putTileAt(base + (BLOB_INDEX[m] as number), x, y);
      }
    }
  }

  // ------------------------------------------------------------------ the yard

  private prop(x: number, feet: number, frame: string, extra: { atlas?: string; glow?: string; shadow?: boolean } = {}): Phaser.GameObjects.Image {
    if (extra.shadow !== false) this.add.image(x, feet - 2, 'atlas', 'fx/shadow-m').setAlpha(0.45).setDepth(D.props + feet / 1000 - 0.001);
    const img = this.add.image(x, feet, extra.atlas ?? 'atlas', frame).setOrigin(0.5, 1).setDepth(D.props + feet / 1000).setTint(DUSK);
    if (extra.glow) this.add.image(x, feet, 'atlas', extra.glow).setOrigin(0.5, 1).setDepth(D.props + feet / 1000 + 0.0005).setAlpha(0.95);
    return img;
  }

  private yard(feet: number, short: boolean, houseX: number): void {
    const { uiW } = this.l;
    const cx = Math.floor(uiW / 2);
    const wide = uiW >= 330;
    // the house, with its windows lit and a thread of chimney smoke
    this.prop(houseX, feet, 'building/farmhouse', { glow: 'building/farmhouse-glow', shadow: false });
    this.time.addEvent({
      delay: 900, loop: true, callback: () => {
        const img = this.add.image(houseX + 23, feet - 86, 'atlas', 'fx/smoke/0').setDepth(D.life).setAlpha(0.8);
        this.tweens.add({
          targets: img, y: img.y - 32, x: img.x + 5 + Math.random() * 8, alpha: 0, duration: 3000, ease: 'sine.out',
          onUpdate: (tw: Phaser.Tweens.Tween) => img.setFrame(`fx/smoke/${Math.min(3, Math.floor(tw.progress * 4))}`),
          onComplete: () => img.destroy(),
        });
      },
    });
    this.prop(houseX + 58, feet - 2, 'prop/lamp', { glow: 'prop/lamp-glow' });
    const cat = this.prop(houseX - 40, feet + 4, 'critter/cat-sit', { shadow: false });
    this.tweens.add({ targets: cat, scaleY: 0.97, duration: 1800, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    if (short) {
      this.prop(Math.round(uiW * 0.04), feet + 2, 'tree/spring/0', { shadow: true });
      return;
    }

    if (wide) {
      this.prop(cx - 270, feet + 2, 'tree/spring/0');
      this.prop(cx - 226, feet + 14, 'prop/hay');
      this.prop(cx - 66, feet + 6, 'prop/scarecrow');
      // the shrine, all of its lanterns lit, where the road to the village begins
      this.prop(cx + 160, feet - 4, 'shrine/7', { glow: 'shrine/7-glow', shadow: false });
      this.prop(cx + 242, feet - 2, 'prop/lamp', { glow: 'prop/lamp-glow' });
      this.prop(cx + 280, feet + 2, 'tree/summer/0');
      this.prop(cx + 80, feet + 14, 'prop/bench');
      for (let i = 0; i < 4; i++) this.prop(cx - 118 + i * 16, feet + 18, `fence/${i === 0 ? 2 : i === 3 ? 8 : 10}`, { shadow: false });
    } else {
      this.prop(Math.round(uiW * 0.9), feet + 4, 'tree/spring/0');
      this.prop(Math.round(uiW * 0.1), feet - 2, 'prop/lamp', { glow: 'prop/lamp-glow' });
      this.prop(Math.round(uiW * 0.8), feet + 16, 'prop/hay');
    }
    // two hens pecking by the fence
    this.hen(houseX - 72, feet + 16, 'brown');
    this.hen(houseX - 92, feet + 20, 'white');
    // a row of crops, already tall
    const rowX = wide ? cx - 70 : Math.round(uiW * 0.2);
    for (let i = 0; i < (wide ? 5 : 3); i++) {
      const crop = this.add.image(rowX + i * 16, feet + 26, 'atlas', i % 2 ? 'crop/pumpkin/5' : 'crop/radish/3').setOrigin(0.5, 1).setDepth(D.props + (feet + 26) / 1000).setTint(DUSK);
      this.tweens.add({ targets: crop, angle: 2, duration: 1600 + i * 130, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
  }

  private hen(x: number, y: number, kind: 'brown' | 'white'): void {
    const img = this.add.image(x, y, 'atlas', `critter/hen-${kind}-idle`).setOrigin(0.5, 1).setDepth(D.props + y / 1000).setTint(DUSK);
    let n = 0;
    this.time.addEvent({
      delay: 380 + Math.random() * 200, loop: true, callback: () => {
        n += 1;
        img.setFrame(`critter/hen-${kind}-${n % 6 < 4 ? `peck${n % 2}` : 'idle'}`);
      },
    });
  }

  // ------------------------------------------------------------------ things that drift

  private life(ground: number, short: boolean): void {
    const { uiW } = this.l;
    const rnd = new Phaser.Math.RandomDataGenerator(['title-life']);
    for (let n = 0; n < (short ? 8 : 14); n++) {
      const img = this.add.image(0, 0, 'atlas', `fx/firefly/${n % 2}`).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.life + 2);
      const halo = this.add.image(0, 0, 'atlas', 'fx/glow-48').setTint(0xc6ff6a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(D.life + 1);
      this.flies.push({
        img, halo, x: rnd.between(8, Math.floor(uiW) - 8), y: ground + rnd.between(2, short ? 38 : 56),
        ax: rnd.between(6, 18), ay: rnd.between(3, 8), fx: 0.3 + rnd.frac() * 0.5, fy: 0.4 + rnd.frac() * 0.6, phase: rnd.frac() * 6.28,
      });
    }
    for (let n = 0; n < (short ? 5 : 8); n++) this.spawnLantern(ground, true);
  }

  private spawnLantern(ground: number, scatter: boolean): void {
    const { uiW } = this.l;
    const kind = Phaser.Utils.Array.GetRandom(['red', 'gold', 'gold', 'pink']);
    const big = Math.random() < 0.35;
    const x = 12 + Math.random() * (uiW - 24);
    const y = scatter ? 20 + Math.random() * (ground + 40) : ground + 40;
    const glow = this.add.image(x, y, 'atlas', 'fx/glow-48').setTint(kind === 'pink' ? 0xffb0c8 : 0xffc060).setBlendMode(Phaser.BlendModes.ADD).setScale(big ? 0.8 : 0.55).setAlpha(0).setDepth(D.life);
    const body = this.add.image(x, y, 'title', `lantern/${kind}`).setAlpha(0).setDepth(D.life + 0.1).setScale(big ? 1 : 0.75);
    this.lanterns.push({ parts: [glow, body], x, y, vy: (big ? 11 : 7) + Math.random() * 4, phase: Math.random() * 6.28, sway: 3 + Math.random() * 4, life: 0 });
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const t = time / 1000;
    const w = this.l.uiW;
    for (const c of this.clouds) {
      c.img.x -= c.speed * dt;
      if (c.img.x < -c.img.width) c.img.x = w + 8;
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = 2.2 + Math.random() * 2;
      this.spawnLantern(this.ground, false);
    }
    for (let i = this.lanterns.length - 1; i >= 0; i--) {
      const q = this.lanterns[i] as (typeof this.lanterns)[number];
      q.life += dt;
      q.y -= q.vy * dt;
      const x = q.x + Math.sin(t * 0.7 + q.phase) * q.sway;
      const fadeIn = Math.min(1, q.life / 1.5);
      const fadeOut = Math.min(1, (q.y + 20) / 60);
      const a = Math.max(0, Math.min(fadeIn, fadeOut));
      const [glow, body] = q.parts as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
      body.setPosition(Math.round(x), Math.round(q.y)).setAlpha(a);
      glow.setPosition(Math.round(x), Math.round(q.y)).setAlpha(a * (0.5 + Math.sin(t * 3 + q.phase) * 0.08));
      if (q.y < -24) {
        for (const p of q.parts) p.destroy();
        this.lanterns.splice(i, 1);
      }
    }
    for (const f of this.flies) {
      const x = f.x + Math.sin(t * f.fx + f.phase) * f.ax;
      const y = f.y + Math.sin(t * f.fy + f.phase * 1.7) * f.ay;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + f.phase * 3);
      f.img.setPosition(Math.round(x), Math.round(y)).setAlpha(0.25 + pulse * 0.75);
      f.halo.setPosition(Math.round(x), Math.round(y)).setAlpha(0.15 + pulse * 0.4);
    }
  }

  // ------------------------------------------------------------------ the logo and the way in

  /** Where the logo starts when it is centred. On a narrow screen it would run under the sound button, so it starts below it. */
  private logoTop(): number {
    const { uiW, uiH, touch } = this.l;
    const button = touch ? 22 : 18;
    const under = uiW < 2 * (88 + button + 6);
    return Math.max(10, Math.round(uiH * 0.045), under ? 6 + button + 4 : 0);
  }

  private header(short: boolean): void {
    const { uiW } = this.l;
    const x = short ? Math.round(uiW * 0.28) : Math.floor(uiW / 2);
    const top = short ? 6 : this.logoTop();
    const glow = this.add.image(x, top + 38, 'atlas', 'fx/glow-128').setTint(0xffb457).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4, 1.1).setAlpha(0.28).setDepth(D.ui - 2);
    this.tweens.add({ targets: glow, alpha: 0.42, duration: 2600, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    const logo = this.add.image(x, top, 'title', 'logo').setOrigin(0.5, 0).setDepth(D.ui - 1);
    this.tweens.add({ targets: logo, y: top + 2, duration: 2400, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    if (!short) label(this, x, top + 80, 'A cozy farming tale', { tint: PAL.cream[1], origin: [0.5, 0], outline: true }).setDepth(D.ui);
  }

  private menu(short: boolean): void {
    const l = this.l;
    const saved = loadGame();
    const bw = Math.max(104, Math.min(124, Math.floor(l.uiW * 0.4)));
    const bh = l.touch ? 22 : 18;
    const gap = l.touch ? 7 : 6;
    const x = short ? Math.round(l.uiW * 0.74) : Math.floor(l.uiW / 2);
    const top = short ? Math.max(20, Math.round(l.uiH * 0.3)) : this.logoTop() + 104;
    if (short) label(this, x, top - 15, 'A cozy farming tale', { tint: PAL.cream[1], origin: [0.5, 0], outline: true }).setDepth(D.ui + 2);
    this.choices = [];
    if (saved) this.choices.push({ text: 'Continue', kind: 'leaf', run: () => this.start(false) });
    this.choices.push({ text: 'New Game', kind: saved ? 'wood' : 'leaf', run: () => (saved ? this.confirmNew() : this.start(true)) });
    this.choices.forEach((c, i) => {
      const y = top + i * (bh + gap);
      const b = button(this, x - Math.floor(bw / 2), y, bw, bh, c.text, c.kind, () => { this.picked = i; this.choose(); });
      for (const p of b.parts) (p as Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }).setDepth(D.ui + 2);
      const zone = b.parts[2] as Phaser.GameObjects.Zone;
      zone.on('pointerover', () => this.select(i));
      this.buttons.push(b);
    });
    this.pointer = this.add.image(x - Math.floor(bw / 2) - 6, top + Math.floor(bh / 2), 'atlas', 'ui/arrow-right').setOrigin(1, 0.5).setDepth(D.ui + 3).setTint(0xffe39a);
    this.tweens.add({ targets: this.pointer, x: this.pointer.x - 2, duration: 450, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.select(0, false);
    if (saved) {
      const info = label(this, x, top + this.choices.length * (bh + gap) + 1, this.describe(saved), { tint: PAL.cream[0], origin: [0.5, 0], outline: true });
      info.setDepth(D.ui + 2);
    }
    if (!l.touch) {
      const below = top + this.choices.length * (bh + gap) + (saved ? 14 : 2);
      label(this, x, below, saved ? 'Up and Down to choose, Enter to start' : 'Press Enter to start', { tint: PAL.cream[0], origin: [0.5, 0], outline: true }).setAlpha(0.75).setDepth(D.ui + 2);
    }
    this.menuTop = top;
    this.menuStep = bh + gap;
    this.menuH = bh;
  }

  private describe(st: GameState): string {
    return `Day ${dayOfSeason(st.day)} of ${SEASON_NAMES[seasonOf(st.day)]}, ${money(st.player.gold)}g`;
  }

  private select(i: number, sound = true): void {
    if (i === this.picked && sound) return;
    this.picked = i;
    if (sound) audio.sfx('tick');
    this.pointer.setY(this.menuTop + i * this.menuStep + Math.floor(this.menuH / 2));
  }

  private choose(): void {
    if (this.busy) return;
    this.choices[this.picked]?.run();
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.busy) return;
    if (this.overlay.length > 0) {
      if (ev.code === 'Escape') this.closeConfirm();
      return;
    }
    const n = this.choices.length;
    if (ev.code === 'ArrowDown' || ev.code === 'KeyS') this.select((this.picked + 1) % n);
    else if (ev.code === 'ArrowUp' || ev.code === 'KeyW') this.select((this.picked + n - 1) % n);
    else if (ev.code === 'Enter' || ev.code === 'Space' || ev.code === 'KeyE') this.choose();
  }

  private confirmNew(): void {
    const l = this.l;
    const w = Math.min(176, Math.floor(l.uiW) - 12);
    const h = 78;
    const x = Math.floor((l.uiW - w) / 2);
    const y = Math.floor((l.uiH - h) / 2);
    const bh = l.touch ? 22 : 18;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(0, 0, l.uiW + 2, l.uiH + 2, PAL.ink[0], 0.62).setOrigin(0, 0).setDepth(D.ui + 10).setInteractive();
    parts.push(dim, nine(this, 'parchment', x, y, w, h).setDepth(D.ui + 11));
    parts.push(label(this, x + w / 2, y + 12, 'Start a new farm?', { tint: COL.ink, origin: [0.5, 0] }).setDepth(D.ui + 12));
    parts.push(label(this, x + w / 2, y + 26, 'This replaces your saved farm.', { tint: COL.dim, origin: [0.5, 0], wrap: w - 20, align: 'center' }).setDepth(D.ui + 12));
    const half = Math.floor((w - 28) / 2);
    const yes = button(this, x + 10, y + h - bh - 9, half, bh, 'Start over', 'berry', () => { this.closeConfirm(); this.start(true); });
    const no = button(this, x + w - 10 - half, y + h - bh - 9, half, bh, 'Keep it', 'leaf', () => this.closeConfirm());
    for (const b of [yes, no]) for (const p of b.parts) (p as Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }).setDepth(D.ui + 13);
    parts.push(...yes.parts, ...no.parts);
    this.overlay = parts;
    audio.sfx('open');
  }

  private closeConfirm(): void {
    for (const p of this.overlay) p.destroy();
    this.overlay = [];
    audio.sfx('close');
  }

  private soundButton(): void {
    const l = this.l;
    const size = l.touch ? 22 : 18;
    const x = Math.floor(l.uiW) - size - 6;
    const y = 6;
    let saved = { music: settings.music, sfx: settings.sfx };
    const on = (): boolean => settings.music > 0 || settings.sfx > 0;
    nine(this, 'dark', x, y, size, size).setDepth(D.ui + 2);
    const note = this.add.image(x + size / 2, y + size / 2, 'atlas', 'fx/note/0').setDepth(D.ui + 3);
    const slash = this.add.rectangle(x + 3, y + size / 2, size - 6, 2, PAL.red[3]).setOrigin(0, 0.5).setRotation(-0.6).setDepth(D.ui + 4);
    const sync = (): void => { note.setAlpha(on() ? 1 : 0.4); slash.setVisible(!on()); };
    sync();
    const zone = this.add.zone(x, y, size, size).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(D.ui + 5);
    zone.on('pointerup', () => {
      if (on()) {
        saved = { music: settings.music, sfx: settings.sfx };
        settings.music = 0;
        settings.sfx = 0;
      } else {
        settings.music = saved.music || 0.6;
        settings.sfx = saved.sfx || 0.8;
        audio.sfx('tick');
      }
      saveSettings();
      sync();
    });
  }

  // ------------------------------------------------------------------ leaving

  private start(fresh: boolean): void {
    if (this.busy) return;
    this.busy = true;
    const saved = fresh ? null : loadGame();
    if (saved) session.load(saved);
    else session.reset(1);
    session.live = true;
    audio.sfx('lantern');
    const cam = this.cameras.main;
    // the lantern is lit: its glow swells over the whole picture, and the dark that follows is a warm one, so the house opens out of the light
    if (!settings.calm) {
      const bloom = this.add.image(this.l.uiW / 2, this.l.uiH * 0.62, 'atlas', 'fx/glow-128').setTint(0xffd070).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.5).setDepth(D.ui + 20);
      this.tweens.add({ targets: bloom, alpha: 0.9, scale: 8, duration: 560, ease: 'Cubic.easeOut' });
    }
    this.time.delayedCall(settings.calm ? 0 : 380, () => cam.fadeOut(settings.calm ? 520 : 460, ...WARM_DARK));
    cam.once('camerafadeoutcomplete', () => {
      audio.override(null);
      this.scene.start('World');
      this.scene.launch('UI');
    });
  }
}
