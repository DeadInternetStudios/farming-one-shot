import Phaser from 'phaser';
import { itemDef } from '../data/items';
import { facingTile, interactTile, isSolidTile, isWater, placeMachine, useSeed, useTool } from '../game/actions';
import type { Ctx, Outcome } from '../game/actions';
import { DAY_END, minutesPerSecond, seasonOf } from '../game/clock';
import { sleepThrough } from '../game/day';
import type { DaySummary } from '../game/day';
import { NPC_BY_ID } from '../data/npcs';
import { rngFor } from '../game/rng';
import { saveGame } from '../game/save';
import { session } from '../game/session';
import { litCount } from '../game/bundles';
import { furnaceState } from '../game/furnace';
import { addItem } from '../game/inventory';
import type { Dir, ToolId, Weather } from '../game/types';
import { tileKey } from '../game/types';
import { getLayout } from '../display';
import { Angler } from '../entities/Angler';
import { Npcs } from '../entities/Npcs';
import { Player } from '../entities/Player';
import { audio } from '../systems/Audio';
import { subscribe } from '../systems/bus';
import { Ambient } from '../systems/Ambient';
import { CameraRig } from '../systems/CameraRig';
import { Controls } from '../systems/Controls';
import { Fx } from '../systems/Fx';
import { Lighting, skyFor } from '../systems/Lighting';
import { MapView } from '../world/MapView';
import { ObjectsView } from '../world/ObjectsView';
import type { LightSpot } from '../world/ObjectsView';
import type { Hotspot, MapDef, Warp } from '../world/mapkit';
import { hasMap } from '../world/maps/registry';

const REACH = 2.1;

const HINTS: Readonly<Record<string, string>> = {
  bed: 'Bed', chest: 'Chest', stove: 'Cook', counter: 'Counter', shelf: 'Bookshelf', bin: 'Shipping bin', sign: 'Sign', text: 'Look',
  shop: 'Go in', shrine: 'Lantern Shrine', board: 'Notice board',
};

const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export class WorldScene extends Phaser.Scene {
  private view!: MapView;
  private objects!: ObjectsView;
  private npcs!: Npcs;
  private angler!: Angler;
  private ambient!: Ambient;
  private lastTenth = 0;
  private lastMachineSync = 0;
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
  private travelling = false;
  private warpLock = 0;
  private lastHint = '';
  private furnacesBusy = new Set<string>();

  constructor() {
    super('World');
  }

  get controlsRef(): Controls {
    return this.controls;
  }

  create(): void {
    const st = session.state;
    this.rig = new CameraRig(this.cameras.main);
    audio.attach(this.load);
    this.buildStage(st.player.loc);
    this.player = new Player(this, st.player.x, st.player.y, st.player.dir);
    this.fx = new Fx(this, () => ({ x: this.player.x, y: this.player.y }));
    this.angler = new Angler({ scene: this, player: this.player, fx: this.fx, map: () => this.def, say: (m) => this.say(m) });
    this.lighting = new Lighting(this, this.rig, this.objects.lights);
    this.ambient = new Ambient(this, this.rig);
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
    subscribe(this, 'npc-fx', (id: string, kind: 'heart' | 'sad') => {
      const at = this.npcs.position(id);
      if (!at) return;
      if (kind === 'heart') {
        this.fx.heart(at.x, at.y - 36);
        session.events.emit('sfx', 'heart');
      } else {
        this.fx.floatText(at.x, at.y - 34, '...');
      }
    });
    subscribe(this, 'lantern', () => this.lightShrine());

    // keep the farm safe if the tab is closed or the phone is put away
    const keep = (): void => {
      if (document.hidden && session.live && !this.travelling) {
        this.syncPlayer();
        saveGame(session.state);
      }
    };
    document.addEventListener('visibilitychange', keep);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', keep));

    if (!st.flags.letter && st.player.loc === 'house') {
      st.flags.letter = true;
      session.hold();
      this.time.delayedCall(900, () => session.events.emit('letter'));
    }

    this.registerDebug();
    this.cameras.main.fadeIn(500, 26, 20, 35);
  }

  private applyLayout(): void {
    const l = getLayout();
    this.cameras.main.setSize(l.devW, l.devH).setZoom(this.zoomFor());
    this.rig.setMap(this.def.w * 16, this.def.h * 16);
    this.rig.snapTo(this.player?.x ?? 0, (this.player?.y ?? 0) - 8);
  }

  /** Rooms are small, so they are drawn as large as will fit; the open air uses the usual zoom. */
  private zoomFor(): number {
    const l = getLayout();
    if (this.def.kind !== 'interior') return l.worldZoom;
    return Math.max(l.worldZoom, Math.floor(Math.min(l.devW / (this.def.w * 16), l.devH / (this.def.h * 16))));
  }

  /** Build the ground and everything standing on it for one map, replacing the one before. */
  private buildStage(id: string): void {
    const st = session.state;
    this.def = session.map(id);
    const loc = session.location(id);
    st.player.loc = id;
    if (id !== 'house') st.flags.outside = true;
    this.angler?.cancel();
    this.view?.destroy();
    this.objects?.destroy();
    const season = seasonOf(st.day);
    this.view = new MapView(this, this.def, loc, season);
    this.objects = new ObjectsView(this, this.def, loc, season);
    this.lighting?.setSpots(this.objects.lights);
    this.cameras.main.setZoom(this.zoomFor());
    this.rig.setMap(this.def.w * 16, this.def.h * 16);
    this.npcs?.destroy();
    this.npcs = new Npcs(this, this.def, this.staticSolid);
    this.npcs.sync(st, true);
    this.lastTenth = Math.floor(st.minute / 10);
    this.objects.setLit(litCount(st));
    this.furnacesBusy = new Set();
    session.events.emit('place', this.def.name);
  }

  /** Walk through a door or down a road: fade, swap the map, fade back in. */
  private travel(w: Warp): void {
    if (this.travelling) return;
    if (!hasMap(w.to)) {
      this.say('That road is not open yet.');
      this.warpLock = 1.5;
      const back = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }[this.player.facing];
      this.player.teleport(this.player.x + back[0] * 16, this.player.y + back[1] * 16);
      return;
    }
    this.travelling = true;
    session.events.emit('sfx', this.def.kind === 'interior' || session.map(w.to).kind === 'interior' ? 'door' : 'travel');
    const cam = this.cameras.main;
    cam.fadeOut(170, 12, 9, 20);
    cam.once('camerafadeoutcomplete', () => {
      this.buildStage(w.to);
      this.player.teleport((w.tx + 0.5) * 16, (w.ty + 0.8) * 16, w.dir);
      this.syncPlayer();
      this.rig.snapTo(this.player.x, this.player.y - 8);
      saveGame(session.state);
      cam.fadeIn(220, 12, 9, 20);
      this.travelling = false;
      this.warpLock = 0.5;
    });
  }

  private syncPlayer(): void {
    const p = session.state.player;
    p.x = this.player.x;
    p.y = this.player.y;
    p.dir = this.player.facing;
  }

  private warpAt(tx: number, ty: number): Warp | undefined {
    return this.def.warps.find((w) => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h);
  }

  private hotspotAt(tx: number, ty: number): Hotspot | undefined {
    return this.def.hotspots.find((h) => tx >= h.x && tx < h.x + h.w && ty >= h.y && ty < h.y + h.h);
  }

  private get ctx(): Ctx {
    const st = session.state;
    return { state: st, map: this.def, rand: rngFor(st.seed, st.day, Math.floor(st.minute), Math.floor(performance.now() % 9973)) };
  }

  private staticSolid = (tx: number, ty: number): boolean => isSolidTile(this.def, session.location(this.def.id), tx, ty);
  private solid = (tx: number, ty: number): boolean => this.staticSolid(tx, ty) || this.npcs.at(tx, ty) !== null;

  override update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const st = session.state;
    const paused = this.sleeping || this.travelling || session.paused;
    this.warpLock = Math.max(0, this.warpLock - dt);

    if (!paused) {
      st.minute += dt * minutesPerSecond(st.pace);
      if (st.minute >= DAY_END) this.beginSleep(true);

      const mv = this.controls.move;
      this.angler.update(dt, Math.hypot(mv.x, mv.y) > 0.25);
      this.player.update(dt, mv.x, mv.y, this.controls.sprint, this.solid);
      this.syncPlayer();
      this.npcs.update(dt, { x: Math.floor(this.player.x / 16), y: Math.floor((this.player.y - 1) / 16) });
      const tenth = Math.floor(st.minute / 10);
      if (tenth !== this.lastTenth) {
        this.lastTenth = tenth;
        this.npcs.sync(st, false);
      }
      if (this.warpLock <= 0) {
        const w = this.warpAt(Math.floor(this.player.x / 16), Math.floor(this.player.y / 16));
        if (w) this.travel(w);
      }

      const slot = this.controls.slot();
      if (slot !== null) this.selectSlot(slot);
      const cyc = this.controls.cycle();
      if (cyc !== 0) this.selectSlot((st.player.selected + cyc + 10 * 100) % 10);
      if (this.controls.action()) this.act();
      if (this.controls.eat()) this.eatSelected();
      if (this.controls.menu()) session.events.emit('interact', { kind: 'menu' });
    } else {
      this.controls.flush();
      this.player.update(dt, 0, 0, false, this.solid);
    }

    this.updateCursor(time);
    this.objects.update(time);
    if (time - this.lastMachineSync > 700) {
      this.lastMachineSync = time;
      this.syncMachines();
    }
    this.rig.update(dt, this.player.x, this.player.y - 8);
    this.ambient.update(dt, { season: seasonOf(st.day), weather: st.weather, minute: st.minute, kind: this.def.kind });
    const sky = skyFor(seasonOf(st.day), st.minute, st.weather, this.def.kind);
    this.lighting.update(sky, time, this.objects.glows, this.torch());
    const dark = 1 - Math.min(1, sky.day * 1.3);
    for (const f of this.objects.nightFrames) f.setAlpha(dark);
    this.chimneySmoke(dt, sky.day);
  }

  /** In the mine you carry a little light of your own. */
  private torch(): LightSpot[] {
    if (this.def.kind !== 'cave') return [];
    return [{ x: this.player.x, y: this.player.y - 10, r: 92, color: 0xffd9a3, flicker: true }];
  }

  private say(msg: string): void {
    session.events.emit('toast', msg);
  }

  private selectSlot(i: number): void {
    if (this.angler.active) this.angler.cancel();
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
    const idle = !this.player.swinging && !this.sleeping && !this.travelling && !session.paused;
    const spot = idle ? this.hotspotAt(t.x, t.y) : undefined;
    const who = idle ? this.npcs.at(t.x, t.y) : null;
    this.cursor.setVisible(idle && (!!held || !!spot || !!who) && !this.angler.active).setPosition(t.x * 16 + 8, t.y * 16 + 8).setAlpha(0.65 + Math.sin(time * 0.008) * 0.25);
    const rod = idle && held?.id === 'rod' ? this.angler.hint() : '';
    const hint = who ? `Talk to ${NPC_BY_ID[who]?.name ?? ''}` : spot ? (HINTS[spot.kind] ?? '') : rod;
    if (hint !== this.lastHint || time % 1000 < 20) {
      this.lastHint = hint;
      session.events.emit('hint', hint);
    }
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

    const who = this.npcs.at(t.x, t.y);
    if (who) return this.talk(who);
    const spot = this.hotspotAt(t.x, t.y);
    if (spot) return this.useHotspot(spot);
    const door = this.warpAt(t.x, t.y);
    if (door) return this.travel(door);

    const key = tileKey(t.x, t.y);
    const held = st.player.slots[st.player.selected];
    const def = held ? itemDef(held.id) : null;
    const standing = session.location(this.def.id).objects[key];
    if (standing?.k === 'chest' || standing?.k === 'furnace') {
      const breaker = held && (held.id === 'axe' || held.id === 'pick');
      if (!breaker) {
        session.events.emit('interact', { kind: standing.k, loc: this.def.id, key });
        return;
      }
    }

    if (held?.id === 'rod') return this.angler.press(at);
    if (this.angler.active) this.angler.cancel();

    const hand = interactTile(ctx, t.x, t.y);
    if (hand) return this.resolve(hand, null);

    if (!held || !def) return;
    if (def.kind === 'tool') {
      const tool = held.id as ToolId;
      const out = useTool(ctx, tool, t.x, t.y, this.player.facing);
      this.resolve(out, tool);
    } else if (def.kind === 'seed') {
      this.resolve(useSeed(ctx, held.id, st.player.selected, t.x, t.y), null);
    } else if (def.kind === 'machine') {
      this.resolve(placeMachine(ctx, held.id, st.player.selected, t.x, t.y), null);
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

  private talk(id: string): void {
    this.npcs.face(id, OPPOSITE[this.player.facing]);
    session.events.emit('interact', { kind: 'talk', id });
  }

  private syncMachines(): void {
    const busy = new Set<string>();
    const l = session.location(this.def.id);
    for (const [key, t] of Object.entries(l.things)) if (t.kind === 'furnace' && furnaceState(session.state, t) === 'working') busy.add(key);
    for (const key of this.furnacesBusy) if (!busy.has(key)) session.events.emit('sfx', 'furnace-done');
    this.furnacesBusy = busy;
    this.objects.syncMachines(busy);
  }

  private lightShrine(): void {
    this.objects.setLit(litCount(session.state));
    const at = this.def.hotspots.find((h) => h.kind === 'shrine');
    if (at) {
      this.fx.sparkle(at.x * 16 + at.w * 8, at.y * 16 - 2);
      this.fx.sparkle(at.x * 16 + at.w * 8 - 14, at.y * 16 + 6);
      this.fx.sparkle(at.x * 16 + at.w * 8 + 14, at.y * 16 + 6);
    }
  }

  private useHotspot(h: Hotspot): void {
    const ev = (what: unknown): void => { session.events.emit('interact', what); };
    switch (h.kind) {
      case 'sign': session.events.emit('dialog', h.text ?? ''); return;
      case 'bin': this.useBin(h); return;
      case 'bed': session.events.emit('ask-sleep'); return;
      case 'text': this.say(h.text ?? ''); return;
      case 'shop': ev({ kind: 'shop', id: h.id }); return;
      case 'shrine': ev({ kind: 'shrine' }); return;
      case 'board': ev({ kind: 'board' }); return;
      case 'stove': ev({ kind: 'cook' }); return;
      case 'chest': ev({ kind: 'chest', loc: this.def.id, key: tileKey(h.x, h.y) }); return;
      case 'counter': this.say('Counter space. The stove next door does the cooking.'); return;
      case 'shelf': this.say('Worn books about weather, soil and seeds.'); return;
      default: this.say(h.text ?? '...');
    }
  }

  private useBin(h: Hotspot): void {
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
    this.fx.floatText(h.x * 16 + 8, h.y * 16 - 4, `${n} ${def.name}  +${def.sell * n}g`);
    session.events.emit('sfx', 'ship');
    this.say(`${def.name} x${n} will sell tonight for ${def.sell * n}g.`);
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
      const summary = sleepThrough(session.state, (id) => session.map(id), passedOut);
      session.newMorning();
      this.afterSleep(summary);
    });
  }

  /** A new morning: you wake beside your bed. */
  private afterSleep(summary: DaySummary): void {
    const st = session.state;
    this.buildStage('house');
    const spawn = this.def.spawn;
    this.player.teleport((spawn.x + 0.5) * 16, (spawn.y + 0.8) * 16, 'down');
    this.syncPlayer();
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
        soil: session.location(this.def.id).soil[tileKey(x, y)] ?? null,
        visible: this.view.overlay.visible,
        alpha: this.view.overlay.alpha,
      }),
      fps: () => ({ fps: Math.round(this.game.loop.actualFps), delta: Math.round(this.game.loop.delta), objects: this.children.length }),
      state: () => session.state,
      setMinute: (m: number) => { st.minute = m; },
      setDay: (d: number) => { st.day = d; this.buildStage(this.def.id); },
      go: (id: string, tx: number, ty: number, dir: Dir = 'down') => this.travel({ x: 0, y: 0, w: 0, h: 0, to: id, tx, ty, dir }),
      teleport: (tx: number, ty: number, dir?: Dir) => { this.player.teleport((tx + 0.5) * 16, (ty + 0.8) * 16, dir); this.rig.snapTo(this.player.x, this.player.y - 8); },
      sleep: () => this.beginSleep(false),
      act: () => this.act(),
      info: () => ({ paused: session.paused, sleeping: this.sleeping, swinging: this.player.swinging, facing: this.player.facing, target: this.targetTile(), keyboard: !!this.input.keyboard?.enabled, active: this.input.isActive() }),
      give: (id: string, n: number) => addItem(session.state.player.slots, id, n),
      weather: (w: Weather) => { session.state.weather = w; },
      ambient: () => this.ambient.count(),
      fish: (bite = false, rig?: { item: string; difficulty: number }) => this.angler.debug(bite, rig),
      water: (x: number, y: number) => isWater(this.def, x, y),
      audio: () => audio.debug(),
      sfx: (name: string) => session.events.emit('sfx', name),
    };
    (window as unknown as { __lh: unknown }).__lh = api;
  }
}
