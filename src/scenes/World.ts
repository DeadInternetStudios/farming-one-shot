import Phaser from 'phaser';
import { itemDef } from '../data/items';
import { facingTile, interactTile, isSolidTile, isWater, useSeed, useTool } from '../game/actions';
import type { Ctx, Outcome } from '../game/actions';
import { DAY_END, minutesPerSecond, seasonOf } from '../game/clock';
import { sleepThrough } from '../game/day';
import type { DaySummary } from '../game/day';
import { rngFor } from '../game/rng';
import { saveGame } from '../game/save';
import { session } from '../game/session';
import { addItem } from '../game/inventory';
import type { Dir, ToolId, Weather } from '../game/types';
import { tileKey } from '../game/types';
import { getLayout } from '../display';
import { Player } from '../entities/Player';
import { subscribe } from '../systems/bus';
import { CameraRig } from '../systems/CameraRig';
import { Controls } from '../systems/Controls';
import { Fx } from '../systems/Fx';
import { Lighting, skyFor } from '../systems/Lighting';
import { MapView } from '../world/MapView';
import { ObjectsView } from '../world/ObjectsView';
import type { MapDef } from '../world/mapkit';

const REACH = 2.1;

export class WorldScene extends Phaser.Scene {
  private view!: MapView;
  private objects!: ObjectsView;
  private player!: Player;
  private rig!: CameraRig;
  private lighting!: Lighting;
  private fx!: Fx;
  private controls!: Controls;
  private def!: MapDef;
  private cursor!: Phaser.GameObjects.Image;
  private hover: { x: number; y: number } | null = null;
  private hoverUntil = 0;
  private smokeTimer = 0;
  private sleeping = false;
  private lastSeason = seasonOf(1);

  constructor() {
    super('World');
  }

  get controlsRef(): Controls {
    return this.controls;
  }

  create(): void {
    const st = session.state;
    this.def = session.map(st.player.loc);
    const loc = st.locations[this.def.id];
    if (!loc) throw new Error('missing location state');
    this.lastSeason = seasonOf(st.day);

    this.view = new MapView(this, this.def, loc, this.lastSeason);
    this.objects = new ObjectsView(this, this.def, loc, this.lastSeason);
    this.player = new Player(this, st.player.x, st.player.y, st.player.dir);
    this.rig = new CameraRig(this.cameras.main);
    this.fx = new Fx(this, () => ({ x: this.player.x, y: this.player.y }));
    this.lighting = new Lighting(this, this.rig, this.objects.lights);
    this.controls = new Controls(this);
    this.cursor = this.add.image(0, 0, 'atlas', 'fx/cursor').setDepth(7000).setAlpha(0.9);

    this.applyLayout();
    this.rig.snapTo(this.player.x, this.player.y);
    this.game.events.on('layout', this.applyLayout, this);
    this.events.once('shutdown', () => this.game.events.off('layout', this.applyLayout, this));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p, true));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointer(p, false));

    subscribe(this, 'use-slot', (i: number) => this.controls.selectSlot(i));
    subscribe(this, 'virtual-move', (x: number, y: number) => { this.controls.virtualMove = { x, y }; });
    subscribe(this, 'virtual-action', () => this.controls.pressAction());
    subscribe(this, 'confirm-sleep', () => this.beginSleep(false));

    this.registerDebug();
    this.cameras.main.fadeIn(500, 26, 20, 35);
  }

  private applyLayout(): void {
    const l = getLayout();
    this.cameras.main.setSize(l.devW, l.devH).setZoom(l.worldZoom);
    this.rig.setMap(this.def.w * 16, this.def.h * 16);
    this.rig.snapTo(this.player?.x ?? 0, this.player?.y ?? 0);
  }

  private get ctx(): Ctx {
    const st = session.state;
    return { state: st, map: this.def, rand: rngFor(st.seed, st.day, Math.floor(st.minute), Math.floor(performance.now() % 9973)) };
  }

  private solid = (tx: number, ty: number): boolean => {
    const loc = session.state.locations[this.def.id];
    return !loc || isSolidTile(this.def, loc, tx, ty);
  };

  override update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const st = session.state;
    const paused = this.sleeping || session.paused;

    if (!paused) {
      st.minute += dt * minutesPerSecond(st.pace);
      if (st.minute >= DAY_END) this.beginSleep(true);

      const mv = this.controls.move;
      this.player.update(dt, mv.x, mv.y, this.controls.sprint, this.solid);
      st.player.x = this.player.x;
      st.player.y = this.player.y;
      st.player.dir = this.player.facing;

      const slot = this.controls.slot();
      if (slot !== null) this.selectSlot(slot);
      const cyc = this.controls.cycle();
      if (cyc !== 0) this.selectSlot((st.player.selected + cyc + 10 * 100) % 10);
      if (this.controls.action()) this.act();
      if (this.controls.eat()) this.eatSelected();
      if (this.controls.menu()) session.events.emit('open-menu');
    } else {
      this.controls.flush();
      this.player.update(dt, 0, 0, false, this.solid);
    }

    this.updateCursor(time);
    this.objects.update(time);
    this.rig.update(dt, this.player.x, this.player.y - 8);
    const sky = skyFor(seasonOf(st.day), st.minute, st.weather, this.def.indoors);
    this.lighting.update(sky, time, this.objects.glows);
    this.chimneySmoke(dt, sky.day);
  }

  private say(msg: string): void {
    session.events.emit('toast', msg);
  }

  private selectSlot(i: number): void {
    session.state.player.selected = i;
    session.events.emit('selected');
  }

  // ------------------------------------------------------------- targeting

  private targetTile(): { x: number; y: number } {
    if (this.hover && this.time.now < this.hoverUntil) return this.hover;
    return facingTile(this.player.x, this.player.y, this.player.facing);
  }

  private updateCursor(time: number): void {
    const t = this.targetTile();
    const p = session.state.player;
    const held = p.slots[p.selected];
    const show = !this.player.swinging && !this.sleeping && !session.paused && !!held;
    this.cursor.setVisible(show).setPosition(t.x * 16 + 8, t.y * 16 + 8).setAlpha(0.65 + Math.sin(time * 0.008) * 0.25);
  }

  private onPointer(p: Phaser.Input.Pointer, press: boolean): void {
    if (this.sleeping || session.paused) return;
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const tx = Math.floor(world.x / 16);
    const ty = Math.floor(world.y / 16);
    const px = Math.floor(this.player.x / 16);
    const py = Math.floor(this.player.y / 16);
    const near = Math.hypot(tx - px, ty - py) <= REACH;
    if (!press) {
      this.hover = near ? { x: tx, y: ty } : null;
      this.hoverUntil = this.time.now + 1500;
      return;
    }
    if (!near) return;
    if (tx === px && ty === py) return;
    const dx = tx - px;
    const dy = ty - py;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.player.face(dir);
    this.hover = { x: tx, y: ty };
    this.hoverUntil = this.time.now + 600;
    this.act({ x: tx, y: ty });
  }

  // ------------------------------------------------------------- acting

  private act(at?: { x: number; y: number }): void {
    if (this.player.swinging) return;
    const st = session.state;
    const t = at ?? facingTile(this.player.x, this.player.y, this.player.facing);
    const ctx = this.ctx;

    // doors, the bin and signs
    for (const prop of this.def.props) {
      if (prop.x === t.x && prop.y === t.y && prop.interact) {
        if (prop.interact === 'sign') { session.events.emit('dialog', prop.text ?? ''); return; }
        if (prop.interact === 'bin') return this.useBin();
      }
    }
    for (const w of this.def.warps) {
      if (t.x >= w.x && t.x < w.x + w.w && t.y >= w.y && t.y < w.y + w.h) return this.useWarp(w.to);
    }

    const hand = interactTile(ctx, t.x, t.y);
    if (hand) return this.resolve(hand, null);

    const held = st.player.slots[st.player.selected];
    if (!held) return;
    const def = itemDef(held.id);
    if (def.kind === 'tool') {
      const tool = held.id as ToolId;
      const out = useTool(ctx, tool, t.x, t.y, this.player.facing);
      this.resolve(out, tool);
    } else if (def.kind === 'seed') {
      this.resolve(useSeed(ctx, held.id, st.player.selected, t.x, t.y), null);
    } else {
      this.say(`${def.name}. Press F to eat it, or ship it from the bin.`);
    }
  }

  private resolve(out: Outcome, tool: ToolId | null): void {
    const st = session.state;
    const apply = (): void => {
      for (const e of out.fx) {
        this.fx.handle(e);
        if (e.t === 'shake') this.objects.shake(tileKey(e.x, e.y));
      }
      const wasTree = out.changed.some((k) => this.objects.spriteAt(k)?.frame.name.startsWith('tree/'));
      if (wasTree) this.treeFall(out.changed);
      this.refresh(out.changed);
      if (out.sfx) session.events.emit('sfx', out.sfx);
    };
    if (!out.ok) {
      if (out.msg) this.say(out.msg);
      apply();
      return;
    }
    if (st.player.energy <= 0.5 && out.energy > 0) this.say("You're worn out. Bed time is near.");
    if (out.swing && tool) {
      this.player.swing(tool, st.player.tools[tool], apply, () => undefined);
    } else {
      apply();
    }
  }

  private treeFall(keys: string[]): void {
    for (const k of keys) {
      const ghost = this.objects.ghostOf(k);
      if (!ghost || !ghost.frame.name.startsWith('tree/')) continue;
      ghost.setOrigin(0.5, 1);
      const dir = this.player.x < ghost.x ? 1 : -1;
      this.tweens.add({
        targets: ghost, angle: dir * 90, duration: 520, ease: 'quad.in',
        onComplete: () => {
          this.fx.dust(ghost.x + dir * 14, ghost.y - 2);
          this.cameras.main.shake(90, 0.0015);
          this.tweens.add({ targets: ghost, alpha: 0, duration: 400, delay: 200, onComplete: () => ghost.destroy() });
        },
      });
    }
  }

  private refresh(keys: string[]): void {
    for (const k of keys) this.objects.syncTile(k);
    this.view.refresh(keys);
  }

  private useBin(): void {
    const st = session.state;
    const held = st.player.slots[st.player.selected];
    if (!held) return this.say('The shipping bin. Hold something to ship it. It sells overnight.');
    const def = itemDef(held.id);
    if (def.kind === 'tool' || def.sell <= 0) return this.say("That can't be shipped.");
    const n = held.n;
    st.shipping.push({ id: held.id, n });
    st.player.slots[st.player.selected] = null;
    this.objects.openBin(true);
    this.time.delayedCall(450, () => this.objects.openBin(false));
    const bx = this.def.props.find((p) => p.interact === 'bin');
    if (bx) this.fx.floatText(bx.x * 16 + 8, bx.y * 16 - 4, `${n} ${def.name}  +${def.sell * n}g`);
    session.events.emit('sfx', 'ship');
    this.say(`${def.name} x${n} will sell tonight for ${def.sell * n}g.`);
  }

  private useWarp(to: string): void {
    if (to === 'house') {
      session.events.emit('ask-sleep');
      return;
    }
    this.say('That road is not open yet.');
  }

  private eatSelected(): void {
    const st = session.state;
    const held = st.player.slots[st.player.selected];
    if (!held) return;
    const def = itemDef(held.id);
    if (!def.energy) return this.say("That's not something you can eat.");
    if (st.player.energy >= st.player.maxEnergy - 0.5) return this.say("You're not hungry right now.");
    held.n -= 1;
    if (held.n <= 0) st.player.slots[st.player.selected] = null;
    st.player.energy = Math.min(st.player.maxEnergy, st.player.energy + def.energy);
    this.fx.floatText(this.player.x, this.player.y - 28, `+${def.energy} energy`);
    session.events.emit('sfx', 'eat');
  }

  private chimneySmoke(dt: number, daylight: number): void {
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0) return;
    this.smokeTimer = 0.8 + Math.random() * 0.6;
    const winter = seasonOf(session.state.day) === 'winter';
    if (!winter && daylight > 0.8 && Math.random() < 0.55) return;
    for (const spot of this.objects.smokeSpots) {
      const img = this.add.image(spot.x, spot.y, 'atlas', 'fx/smoke/0').setDepth(5000).setAlpha(0.85);
      this.tweens.add({
        targets: img, y: spot.y - 30, x: spot.x + 5 + Math.random() * 7, alpha: 0, duration: 2800, ease: 'sine.out',
        onUpdate: (tw) => img.setFrame(`fx/smoke/${Math.min(3, Math.floor(tw.progress * 4))}`),
        onComplete: () => img.destroy(),
      });
    }
  }

  // ------------------------------------------------------------- the night

  private beginSleep(passedOut: boolean): void {
    if (this.sleeping) return;
    this.sleeping = true;
    session.events.emit('sleeping', true);
    const cam = this.cameras.main;
    cam.fadeOut(900, 12, 9, 20);
    cam.once('camerafadeoutcomplete', () => {
      const summary = sleepThrough(session.state, this.def, passedOut);
      this.afterSleep(summary);
    });
  }

  private afterSleep(summary: DaySummary): void {
    const st = session.state;
    const loc = st.locations[this.def.id];
    if (!loc) return;
    this.objects.syncAll();
    this.view.repaintAll();
    const season = seasonOf(st.day);
    if (season !== this.lastSeason) {
      this.lastSeason = season;
      this.view.setSeason(season);
      this.objects.setSeason(season);
    }
    const spawn = this.def.spawn;
    this.player.teleport((spawn.x + 0.5) * 16, (spawn.y + 0.8) * 16, 'down');
    st.player.x = this.player.x;
    st.player.y = this.player.y;
    this.rig.snapTo(this.player.x, this.player.y - 8);
    saveGame(st);
    session.events.emit('day-summary', summary, () => {
      this.cameras.main.fadeIn(900, 12, 9, 20);
      this.sleeping = false;
      session.events.emit('sleeping', false);
    });
  }

  // ------------------------------------------------------------- hooks for testing

  private registerDebug(): void {
    if (!new URLSearchParams(location.search).has('debug')) return;
    const st = session.state;
    const toasts: string[] = [];
    subscribe(this, 'toast', (m: string) => toasts.push(m));
    const api = {
      toasts: () => toasts.splice(0),
      repaint: () => this.view.repaintAll(),
      refreshTile: (x: number, y: number) => this.view.refresh([tileKey(x, y)]),
      tile: (x: number, y: number) => ({
        overlay: this.view.overlay.getTileAt(x, y)?.index ?? null,
        land: this.view.land.getTileAt(x, y)?.index ?? null,
        soil: session.state.locations.farm.soil[tileKey(x, y)] ?? null,
        visible: this.view.overlay.visible,
        alpha: this.view.overlay.alpha,
      }),
      fps: () => ({ fps: Math.round(this.game.loop.actualFps), delta: Math.round(this.game.loop.delta), objects: this.children.length }),
      state: () => session.state,
      setMinute: (m: number) => { st.minute = m; },
      setDay: (d: number) => { st.day = d; this.afterSleep({ day: d, earned: 0, sold: [], night: { grew: 0, ripe: 0, thirsty: 0 }, withered: 0, newSeason: null, passedOut: false, lostGold: 0, weather: st.weather }); this.cameras.main.setAlpha(1); },
      teleport: (tx: number, ty: number, dir?: Dir) => { this.player.teleport((tx + 0.5) * 16, (ty + 0.8) * 16, dir); this.rig.snapTo(this.player.x, this.player.y - 8); },
      sleep: () => this.beginSleep(false),
      act: () => this.act(),
      info: () => ({ paused: session.paused, sleeping: this.sleeping, swinging: this.player.swinging, facing: this.player.facing, target: this.targetTile(), keyboard: !!this.input.keyboard?.enabled, active: this.input.isActive() }),
      give: (id: string, n: number) => addItem(session.state.player.slots, id, n),
      weather: (w: Weather) => { session.state.weather = w; },
      water: (x: number, y: number) => isWater(this.def, x, y),
    };
    (window as unknown as { __lh: unknown }).__lh = api;
  }
}
