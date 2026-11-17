import Phaser from 'phaser';
import { PAL, ROD_TIP } from '../gen/art';
import { itemDef } from '../data/items';
import { seasonOf } from '../game/clock';
import { tierIndex, toolEnergy } from '../game/farming';
import { barSize, biteDelay, castTarget, isFishable, rollCatch } from '../game/fishing';
import type { Catch, Conditions } from '../game/fishing';
import { addItem, canAdd } from '../game/inventory';
import { session } from '../game/session';
import type { Tile } from '../game/types';
import type { Fx } from '../systems/Fx';
import type { MapDef } from '../world/mapkit';
import type { Player } from './Player';

interface Host {
  scene: Phaser.Scene;
  player: Player;
  fx: Fx;
  map: () => MapDef;
  say: (msg: string) => void;
}

type Phase = 'flying' | 'wait' | 'bite' | 'fight';

interface Line {
  phase: Phase;
  /** The water tile the bobber sits in. */
  tx: number;
  ty: number;
  /** Seconds left in this phase. */
  t: number;
  age: number;
  hooked: Catch;
  bobber: Phaser.GameObjects.Image;
  exclaim: Phaser.GameObjects.Image | null;
  ripple: number;
}

const DEPTH = 7990;
/** How long after the bite you have to set the hook. */
const BITE_WINDOW = 1.0;

/** The rod: casting, waiting, the bite and landing the catch. One line at a time. */
export class Angler {
  private line: Line | null = null;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private host: Host) {
    this.gfx = host.scene.add.graphics().setDepth(DEPTH - 1);
  }

  get active(): boolean {
    return this.line !== null;
  }

  /** The action button, with the rod in hand. */
  press(at?: Tile): void {
    const st = session.state;
    const l = this.line;
    if (l) {
      if (l.phase === 'bite') return this.hook();
      if (l.phase === 'wait' && l.age > 0.5) this.reel('You reel it in. Too early!');
      return;
    }
    const map = this.host.map();
    const p = this.host.player;
    const target = at && isFishable(map, at.x, at.y) ? at : castTarget(map, p.x, p.y, p.facing);
    if (!target) {
      this.host.say('Face the water to fish. A dock is the best spot.');
      session.events.emit('sfx', 'nope');
      return;
    }
    const cost = toolEnergy('rod', st.player.tools.rod);
    if (st.player.energy < cost) {
      this.host.say("You're too tired to fish. Time for bed.");
      return;
    }
    st.player.energy -= cost;
    const c = this.conditions();
    const hooked = rollCatch(Math.random, c);
    const bobber = this.host.scene.add.image(0, 0, 'atlas', 'fx/bobber/0').setOrigin(0.5, 0.8).setDepth(DEPTH).setVisible(false);
    this.line = { phase: 'flying', tx: target.x, ty: target.y, t: biteDelay(Math.random, c), age: 0, hooked, bobber, exclaim: null, ripple: 1 };
    session.events.emit('sfx', 'cast');
    p.cast(() => this.launch());
  }

  update(dt: number, moving: boolean): void {
    const l = this.line;
    if (!l) return;
    l.age += dt;
    if (moving && l.phase !== 'flying' && l.phase !== 'fight') {
      this.reel(null);
      return;
    }
    if (l.phase === 'wait') {
      l.t -= dt;
      l.ripple -= dt;
      const bx = l.tx * 16 + 8;
      const by = l.ty * 16 + 9;
      l.bobber.setPosition(bx, by + Math.round(Math.sin(l.age * 3.1) * 0.9)).setFrame(Math.floor(l.age * 1.6) % 2 === 0 ? 'fx/bobber/0' : 'fx/bobber/1');
      if (l.ripple <= 0) {
        l.ripple = 1.1 + Math.random() * 1.6;
        this.host.fx.ripple(bx, by + 2);
      }
      if (l.t <= 0) this.bite(l);
    } else if (l.phase === 'bite') {
      l.t -= dt;
      const bx = l.tx * 16 + 8;
      const by = l.ty * 16 + 9;
      l.bobber.setPosition(bx + Math.round(Math.sin(l.age * 38) * 1), by + 3).setFrame('fx/bobber/1');
      if (l.exclaim) l.exclaim.setPosition(Math.round(this.host.player.x), Math.round(this.host.player.y - 38 - Math.abs(Math.sin(l.age * 14)) * 2));
      if (l.t <= 0) this.reel('It got away...');
    }
    this.drawLine();
  }

  /** Pull the line in quietly, for when the farmer walks off or swaps tools. */
  cancel(): void {
    this.dispose();
  }

  /** What the action button would do with the rod right now. */
  hint(): string {
    const l = this.line;
    if (l) return l.phase === 'bite' ? 'Hook it!' : l.phase === 'wait' ? 'Reel in' : '';
    const p = this.host.player;
    return castTarget(this.host.map(), p.x, p.y, p.facing) ? 'Cast' : '';
  }

  /** For tests: where the line is at, make the fish bite now, or swap what is on the hook. */
  debug(bite = false, rig?: { item: string; difficulty: number }): { phase: Phase | 'none'; item: string | null } {
    const l = this.line;
    if (l && bite && l.phase === 'wait') l.t = 0;
    if (l && rig) l.hooked = { item: rig.item, difficulty: rig.difficulty };
    return { phase: l ? l.phase : 'none', item: l ? l.hooked.item : null };
  }

  destroy(): void {
    this.dispose();
    this.gfx.destroy();
  }

  // ------------------------------------------------------------- phases

  private conditions(): Conditions {
    const st = session.state;
    return { map: this.host.map().id, season: seasonOf(st.day), minute: st.minute, weather: st.weather, rodTier: tierIndex(st.player.tools.rod) };
  }

  private tip(): { x: number; y: number } {
    const p = this.host.player;
    const side = p.facing === 'left' || p.facing === 'right';
    const t = ROD_TIP[side ? 'side' : p.facing === 'up' ? 'up' : 'down'];
    return { x: Math.round(p.x + (p.facing === 'left' ? -t.x : t.x)), y: Math.round(p.y + t.y) };
  }

  /** The bobber flies from the tip of the rod to the water. */
  private launch(): void {
    const l = this.line;
    if (!l) return;
    const from = this.tip();
    const toX = l.tx * 16 + 8;
    const toY = l.ty * 16 + 9;
    l.bobber.setVisible(true).setPosition(from.x, from.y);
    const arc = 10 + Math.hypot(toX - from.x, toY - from.y) * 0.18;
    const prog = { u: 0 };
    this.host.scene.tweens.add({
      targets: prog, u: 1, duration: 340, ease: 'sine.inOut',
      onUpdate: () => {
        l.bobber.setPosition(from.x + (toX - from.x) * prog.u, from.y + (toY - from.y) * prog.u - Math.sin(prog.u * Math.PI) * arc);
        this.drawLine();
      },
      onComplete: () => {
        if (this.line !== l) return;
        l.phase = 'wait';
        l.age = 0;
        this.host.fx.splash(toX, toY);
        session.events.emit('sfx', 'splash');
      },
    });
  }

  private bite(l: Line): void {
    l.phase = 'bite';
    l.t = BITE_WINDOW;
    l.age = 0;
    l.exclaim = this.host.scene.add.image(this.host.player.x, this.host.player.y - 38, 'atlas', 'fx/exclaim').setDepth(DEPTH + 1);
    session.events.emit('sfx', 'bite');
    this.host.fx.splash(l.tx * 16 + 8, l.ty * 16 + 9);
  }

  private hook(): void {
    const l = this.line;
    if (!l || l.phase !== 'bite') return;
    l.exclaim?.destroy();
    l.exclaim = null;
    if (l.hooked.item === null) {
      this.finish(true, false);
      return;
    }
    l.phase = 'fight';
    session.events.emit('sfx', 'hook');
    const st = session.state;
    session.events.emit('interact', {
      kind: 'fish', item: l.hooked.item, difficulty: l.hooked.difficulty,
      size: barSize(tierIndex(st.player.tools.rod), st.flags['tam-5'] === true),
      done: (won: boolean, perfect: boolean) => this.finish(won, perfect),
    });
  }

  /** Pull the line in with nothing on it. */
  private reel(msg: string | null): void {
    if (msg) this.host.say(msg);
    this.dispose();
  }

  private finish(won: boolean, perfect: boolean): void {
    const l = this.line;
    if (!l) return;
    const st = session.state;
    const at = { x: l.tx * 16 + 8, y: l.ty * 16 + 9 };
    const item = l.hooked.item;
    this.dispose();
    if (!won) {
      this.host.say('It slipped the hook and swam away.');
      session.events.emit('sfx', 'nope');
      return;
    }
    const got = item ?? 'fiber';
    if (!canAdd(st.player.slots, got, 1)) {
      this.host.say('Your bag is full. The catch slips back into the water.');
      session.events.emit('sfx', 'nope');
      return;
    }
    addItem(st.player.slots, got, 1);
    this.host.fx.pop(at.x, at.y - 4, got, 1);
    this.host.fx.splash(at.x, at.y);
    session.events.emit('selected');
    if (item === null) {
      this.host.say('Just a tangle of weeds.');
      session.events.emit('sfx', 'pickup');
      return;
    }
    st.stats.caught += 1;
    const first = !st.seen.includes(got);
    if (first) st.seen.push(got);
    const name = itemDef(got).name;
    this.host.say(first ? `New catch: ${name}!` : `You caught a ${name}!`);
    session.events.emit('sfx', first ? 'fanfare' : 'catch');
    if (perfect) {
      st.player.energy = Math.min(st.player.maxEnergy, st.player.energy + toolEnergy('rod', st.player.tools.rod));
      this.host.fx.floatText(this.host.player.x, this.host.player.y - 40, 'Perfect!');
      this.host.fx.sparkle(this.host.player.x, this.host.player.y - 26);
    }
  }

  private dispose(): void {
    const l = this.line;
    this.line = null;
    this.gfx.clear();
    if (!l) return;
    l.bobber.destroy();
    l.exclaim?.destroy();
    this.host.player.rodAway();
  }

  /** The line, drooping a little between the rod and the bobber. */
  private drawLine(): void {
    const l = this.line;
    this.gfx.clear();
    if (!l || !l.bobber.visible) return;
    const a = this.tip();
    const bx = l.bobber.x;
    const by = l.bobber.y - 6;
    const sag = l.phase === 'flying' ? 1 : 3 + Math.hypot(bx - a.x, by - a.y) * 0.07;
    this.gfx.lineStyle(1, PAL.cream[2], 0.9);
    this.gfx.beginPath();
    this.gfx.moveTo(a.x, a.y);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      this.gfx.lineTo(Math.round(a.x + (bx - a.x) * u), Math.round(a.y + (by - a.y) * u + Math.sin(u * Math.PI) * sag));
    }
    this.gfx.strokePath();
  }
}
