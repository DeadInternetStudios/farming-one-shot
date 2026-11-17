import Phaser from 'phaser';
import { watchKey } from './keys';

/**
 * Keyboard, plus the on-screen stick and buttons, as one set of intents for the world to read.
 * Presses are queued from key events, so a very quick tap between two frames is never lost.
 */
export class Controls {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  /** Fed by the touch stick, -1..1 on each axis. */
  virtualMove = { x: 0, y: 0 };
  private virtualSprint = false;
  private queuedAction = false;
  private queuedSlot: number | null = null;
  private queuedCycle = 0;
  private queuedEat = false;
  private queuedMenu = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard plugin missing');
    this.keys = kb.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', shift: 'SHIFT',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture('SPACE,TAB,UP,DOWN,LEFT,RIGHT');
    watchKey(scene, 'keydown', (ev) => this.onKey(ev));
    scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.queuedCycle += dy > 0 ? 1 : -1;
    });
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.repeat) return;
    const c = ev.code;
    if (c === 'Space' || c === 'Enter' || c === 'KeyE') this.queuedAction = true;
    else if (c === 'KeyF') this.queuedEat = true;
    else if (c === 'Tab' || c === 'Escape') this.queuedMenu = true;
    else if (c === 'KeyQ') this.queuedCycle -= 1;
    else if (c === 'KeyR') this.queuedCycle += 1;
    else if (c === 'Digit0') this.queuedSlot = 9;
    else if (c.startsWith('Digit')) this.queuedSlot = Number(c.slice(5)) - 1;
  }

  private down(k: string): boolean {
    return this.keys[k]?.isDown ?? false;
  }

  get move(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.down('a') || this.down('left')) x -= 1;
    if (this.down('d') || this.down('right')) x += 1;
    if (this.down('w') || this.down('up')) y -= 1;
    if (this.down('s') || this.down('down')) y += 1;
    if (x === 0 && y === 0) return { x: this.virtualMove.x, y: this.virtualMove.y };
    return { x, y };
  }

  get sprint(): boolean {
    return this.down('shift') || this.virtualSprint;
  }

  setVirtualSprint(v: boolean): void {
    this.virtualSprint = v;
  }

  pressAction(): void {
    this.queuedAction = true;
  }
  pressEat(): void {
    this.queuedEat = true;
  }
  pressMenu(): void {
    this.queuedMenu = true;
  }
  selectSlot(i: number): void {
    this.queuedSlot = i;
  }

  /** Drop every press that arrived while the world was paused. */
  flush(): void {
    this.queuedAction = false;
    this.queuedSlot = null;
    this.queuedCycle = 0;
    this.queuedEat = false;
    this.queuedMenu = false;
  }

  /** True once per press of Space, E or Enter, or the on-screen action button. */
  action(): boolean {
    const a = this.queuedAction;
    this.queuedAction = false;
    return a;
  }

  eat(): boolean {
    const v = this.queuedEat;
    this.queuedEat = false;
    return v;
  }

  menu(): boolean {
    const v = this.queuedMenu;
    this.queuedMenu = false;
    return v;
  }

  /** Slot picked with a number key or the UI. */
  slot(): number | null {
    const q = this.queuedSlot;
    this.queuedSlot = null;
    return q;
  }

  /** Step through the hotbar: wheel, Q and R. */
  cycle(): number {
    const c = this.queuedCycle;
    this.queuedCycle = 0;
    return c;
  }
}
