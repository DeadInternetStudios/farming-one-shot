import Phaser from 'phaser';
import { session } from '../game/session';
import { watchKey } from '../systems/keys';
import type { Layout } from '../display';
import { MS, reveal } from './motion';
import type { Motion } from './motion';
import { Bag, dimmer } from './widgets';

export interface Host {
  scene: Phaser.Scene;
  l: Layout;
  open(s: Screen): void;
  close(s: Screen): void;
}

/** Something on a screen that knows where the player was in it, so a rebuild after a resize can put them back. */
export interface Placed {
  readonly place: number;
  restore(place: number): void;
}

const isPlaced = <T extends { destroy(): void }>(e: T): e is T & Placed => typeof (e as Partial<Placed>).restore === 'function';

/** One pop-up interface: a shop, a conversation, the bag. Builds itself, takes keys, cleans up after itself. */
export abstract class Screen {
  protected bag: Bag;
  private extra: { destroy(): void }[] = [];
  private motion: Motion | null = null;
  private pageStart = -1;

  constructor(protected host: Host) {
    this.bag = new Bag(host.scene, 40);
  }

  protected get scene(): Phaser.Scene {
    return this.host.scene;
  }
  protected get l(): Layout {
    return this.host.l;
  }

  /** Draw everything. Called again if the window is resized. */
  abstract build(): void;

  /** Keys while this screen is on top. */
  onKey(_code: string, _ev: KeyboardEvent): void {}

  update(): void {}

  protected dim(alpha = 0.5): void {
    dimmer(this.bag, this.l, alpha);
  }

  protected own<T extends { destroy(): void }>(o: T): T {
    this.extra.push(o);
    return o;
  }

  protected close(): void {
    this.host.close(this);
  }

  teardown(): void {
    this.motion?.stop();
    this.motion = null;
    for (const e of this.extra) e.destroy();
    this.extra = [];
    this.bag.destroy();
  }

  /** Marks where the page begins, under the title and tabs: a tab switch fades in only what is made after this. */
  protected markPage(): void {
    this.pageStart = this.scene.children.list.length;
  }

  /** The screen just opened: everything it made eases in. */
  appear(made: readonly Phaser.GameObjects.GameObject[]): void {
    this.motion = reveal(this.scene, made, { rise: 5, skipWide: this.l.uiW });
  }

  /** Builds the screen again, after a resize or a tab switch. `fade` brings the page in softly; the frame around it stays put. */
  relayout(fade = false): void {
    // a turn of the phone, a resize or a setting that changes the layout rebuilds the page but not the player's place in it; a tab switch starts fresh
    const places = fade ? [] : this.extra.filter(isPlaced).map((e) => e.place);
    this.teardown();
    this.pageStart = -1;
    this.build();
    this.extra.filter(isPlaced).forEach((e, i) => {
      const was = places[i];
      if (was !== undefined) e.restore(was);
    });
    if (fade && this.pageStart >= 0) this.motion = reveal(this.scene, this.scene.children.list.slice(this.pageStart), { ms: MS.quick });
  }
}

/** The pile of open screens. The top one gets the keys. */
export class ScreenStack implements Host {
  private stack: Screen[] = [];

  constructor(readonly scene: Phaser.Scene, public l: Layout) {
    watchKey(scene, 'keydown', (ev) => {
      if (ev.repeat && !/Arrow|Key[WASD]/.test(ev.code)) return;
      this.top?.onKey(ev.code, ev);
    });
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  open(s: Screen): void {
    session.hold();
    if (this.stack.length === 0) session.events.emit('sfx', 'open');
    this.stack.push(s);
    const before = new Set(this.scene.children.list);
    try {
      s.build();
      s.appear(this.scene.children.list.filter((o) => !before.has(o)));
    } catch (e) {
      // a screen that cannot be drawn must not take the game with it: clear what it made, let go of the pause, and say so
      console.error(e);
      for (const o of this.scene.children.list.filter((c) => !before.has(c))) o.destroy();
      this.close(s);
      session.events.emit('toast', 'That would not open. Your farm is safe.');
    }
  }

  close(s: Screen): void {
    const i = this.stack.indexOf(s);
    if (i < 0) return;
    this.stack.splice(i, 1);
    if (this.stack.length === 0) session.events.emit('sfx', 'close');
    try {
      s.teardown();
    } catch (e) {
      console.error(e);
    } finally {
      this.scene.time.delayedCall(80, () => session.release());
    }
  }

  closeAll(): void {
    for (const s of [...this.stack]) this.close(s);
  }

  setLayout(l: Layout): void {
    this.l = l;
    for (const s of this.stack) s.relayout();
  }

  update(): void {
    this.top?.update();
  }
}

export const isConfirm = (code: string): boolean => code === 'Enter' || code === 'Space' || code === 'KeyE';
export const isBack = (code: string): boolean => code === 'Escape' || code === 'KeyQ';
export const isUp = (code: string): boolean => code === 'ArrowUp' || code === 'KeyW';
export const isDown = (code: string): boolean => code === 'ArrowDown' || code === 'KeyS';
export const isLeft = (code: string): boolean => code === 'ArrowLeft' || code === 'KeyA';
export const isRight = (code: string): boolean => code === 'ArrowRight' || code === 'KeyD';
