import Phaser from 'phaser';
import type { DaySummary } from '../game/day';
import type { FinaleReport } from '../game/finale';
import { session } from '../game/session';
import { settings } from '../game/settings';
import { fitUiCamera, getLayout } from '../display';
import { PostcardScreen } from '../features/postcard/PostcardScreen';
import { takePostcard } from '../features/postcard/capture';
import { POSTCARD_ON } from '../features/postcard/layout';
import type { Layout } from '../display';
import { subscribe } from '../systems/bus';
import { Hud } from '../ui/Hud';
import { Modals } from '../ui/Modals';
import { interact } from '../ui/Interactions';
import type { Interact } from '../ui/Interactions';
import { ScreenStack } from '../ui/Screens';
import { Touch } from '../ui/Touch';

/** The interface layer: a second camera at a whole-number zoom, drawn over the world. */
export class UIScene extends Phaser.Scene {
  private hud!: Hud;
  private modals!: Modals;
  private touch: Touch | null = null;
  private stack!: ScreenStack;
  private shooting = false;

  constructor() {
    super('UI');
  }

  create(): void {
    const l = getLayout();
    fitUiCamera(this.cameras.main, l);
    this.hud = new Hud(this, l);
    this.modals = new Modals(this, l);
    this.stack = new ScreenStack(this, l);
    if (l.touch) this.touch = new Touch(this, l);

    subscribe(this, 'toast', (msg: string) => this.hud.toast(msg));
    subscribe(this, 'picked', (item: string, n: number) => this.hud.picked(item, n));
    subscribe(this, 'selected', () => this.hud.showTip());
    subscribe(this, 'hint', (text: string) => this.hud.hint(text));
    subscribe(this, 'place', (name: string) => this.hud.place(name));
    subscribe(this, 'ask-sleep', () => this.modals.askSleep(() => session.events.emit('confirm-sleep')));
    subscribe(this, 'day-summary', (s: DaySummary, done: () => void) => this.modals.daySummary(s, done));
    subscribe(this, 'dialog', (text: string) => this.modals.dialog(text));
    subscribe(this, 'letter', () => this.modals.letter(() => { session.release(); session.events.emit('sfx', 'tick'); }));
    subscribe(this, 'finale', (report: FinaleReport, done: () => void) => this.modals.finale(report, done));
    subscribe(this, 'settings', () => this.rebuildTouch());
    subscribe(this, 'cinema', (on: boolean) => this.tweens.add({ targets: this.cameras.main, alpha: on ? 0 : 1, duration: 600 }));
    subscribe(this, 'interact', (what: Interact) => interact(this.stack, what, () => window.location.reload()));
    if (POSTCARD_ON) subscribe(this, 'postcard', () => void this.postcard());

    this.game.events.on('layout', this.onLayout, this);
    this.events.once('shutdown', () => this.game.events.off('layout', this.onLayout, this));
  }

  private onLayout(l: Layout): void {
    fitUiCamera(this.cameras.main, l);
    this.hud.rebuild(l);
    this.modals.setLayout(l);
    this.stack.setLayout(l);
    this.rebuildTouch(l);
  }

  /** Hide the interface for a moment, take the picture, and lay the card on the table. */
  private async postcard(): Promise<void> {
    if (this.shooting || this.stack.isOpen) return;
    this.shooting = true;
    const taken = await takePostcard(this).finally(() => { this.shooting = false; });
    if (!taken) {
      this.hud.toast('The camera would not focus. Try again.');
      return;
    }
    session.state.flags.postcard = true;
    session.events.emit('sfx', 'shutter');
    if (!settings.calm) this.cameras.main.flash(180, 255, 244, 214);
    this.stack.open(new PostcardScreen(this.stack, taken));
  }

  private rebuildTouch(l: Layout = getLayout()): void {
    this.touch?.destroy();
    this.touch = l.touch ? new Touch(this, l) : null;
  }

  override update(): void {
    this.hud.update();
    this.stack.update();
  }
}
