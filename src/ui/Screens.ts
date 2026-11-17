import Phaser from 'phaser';
import { session } from '../game/session';
import { watchKey } from '../systems/keys';
import type { Layout } from '../display';
import { Bag, dimmer } from './widgets';

export interface Host {
  scene: Phaser.Scene;
  l: Layout;
  open(s: Screen): void;
  close(s: Screen): void;
}

/** One pop-up interface: a shop, a conversation, the bag. Builds itself, takes keys, cleans up after itself. */
export abstract class Screen {
  protected bag: Bag;
  private extra: { destroy(): void }[] = [];

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
    for (const e of this.extra) e.destroy();
    this.extra = [];
    this.bag.destroy();
  }

  relayout(): void {
    this.teardown();
    this.build();
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
    s.build();
  }

  close(s: Screen): void {
    const i = this.stack.indexOf(s);
    if (i < 0) return;
    this.stack.splice(i, 1);
    if (this.stack.length === 0) session.events.emit('sfx', 'close');
    s.teardown();
    this.scene.time.delayedCall(80, () => session.release());
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
