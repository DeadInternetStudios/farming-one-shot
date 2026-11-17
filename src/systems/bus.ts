import type Phaser from 'phaser';
import { session } from '../game/session';

/** Listen on the session bus for as long as a scene lives. */
export function subscribe<A extends unknown[]>(scene: Phaser.Scene, name: string, fn: (...args: A) => void): void {
  session.events.on(name, fn);
  scene.events.once('shutdown', () => session.events.off(name, fn));
}
