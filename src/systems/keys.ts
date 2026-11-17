import type Phaser from 'phaser';

/**
 * Listens for key presses straight from the browser, one call per press, and stops when the scene does.
 * Phaser's own key events repeat when several presses land inside one slow frame, which made menus skip rows,
 * and they stay silent while a held arrow key auto-repeats, which stopped long lists from scrolling.
 */
export function watchKey(scene: Phaser.Scene, type: 'keydown' | 'keyup', handler: (ev: KeyboardEvent) => void): () => void {
  const listener = (ev: KeyboardEvent): void => handler(ev);
  window.addEventListener(type, listener);
  const stop = (): void => {
    window.removeEventListener(type, listener);
    scene.events.off('shutdown', stop);
    scene.events.off('destroy', stop);
  };
  scene.events.once('shutdown', stop);
  scene.events.once('destroy', stop);
  return stop;
}
