import type Phaser from 'phaser';
import { session } from './game/session';
import { controlsLines } from './ui/controlsText';
import { POSTCARD_ON } from './features/postcard/layout';
import { isTouchDevice } from './display';

/**
 * A canvas is one picture to a screen reader. This gives it a name, a plain list of the controls, and a live region that speaks
 * the goal, the messages and the place names as the game shows them, so what is on the glass is also in words.
 */
export function installA11y(game: Phaser.Game): void {
  if (game.canvas) name(game.canvas);
  else game.events.once('ready', () => name(game.canvas));
  speak();
}

function name(canvas: HTMLCanvasElement): void {
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Lantern Hollow, a cozy pixel-art farming game. The goal and what happens are read out in the live region below the game.');
}

function speak(): void {
  const list = document.getElementById('how');
  if (list) {
    list.replaceChildren(
      ...controlsLines(isTouchDevice(), POSTCARD_ON).map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      }),
    );
  }

  const live = document.getElementById('live');
  if (!live) return;
  let last = '';
  let lastAt = 0;
  const say = (text: unknown): void => {
    if (typeof text !== 'string' || text === '') return;
    const now = performance.now();
    // the same line twice in a row would be read twice: toasts repeat while you chop
    if (text === last && now - lastAt < 4000) return;
    last = text;
    lastAt = now;
    live.textContent = text;
  };
  session.events.on('toast', say);
  session.events.on('goal', (text: string) => say(text ? `Next: ${text}` : ''));
  session.events.on('place', say);
  session.events.on('dialog', say);
}
