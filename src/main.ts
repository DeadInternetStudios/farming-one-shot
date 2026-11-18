import Phaser from 'phaser';
import { installA11y } from './a11y';
import { installLayout, measure } from './display';
import { startOffline } from './features/pwa/offline';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { UIScene } from './scenes/UI';
import { WorldScene } from './scenes/World';

const found = document.getElementById('game');
if (!found) throw new Error('missing #game');
const parent: HTMLElement = found;

const query = new URLSearchParams(location.search);

/** The game draws with WebGL and has nothing to fall back on, so a browser without it gets a plain sentence instead of a lamp that glows forever. */
function webglWorks(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function cannotDraw(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('stuck');
  const why = document.createElement('div');
  why.className = 'why';
  why.textContent = 'This browser cannot draw the game. Lantern Hollow needs WebGL, and it is switched off or missing here. Try an up-to-date Chrome, Firefox, Safari or Edge, or turn on hardware acceleration in the browser settings.';
  boot.appendChild(why);
}

function start(): void {
  const layout = measure(parent);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: layout.devW,
    height: layout.devH,
    backgroundColor: '#1a1423',
    pixelArt: true,
    antialias: false,
    // Raw frame times keep the clock honest even when the page is not focused or the frame rate dips.
    fps: { smoothStep: false },
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / layout.dpr },
    input: { activePointers: 3 },
    audio: { noAudio: query.has('mute') },
    disableContextMenu: true,
    scene: [BootScene, TitleScene, WorldScene, UIScene],
  });
  installLayout(game, parent);
  installA11y(game);
  startOffline();
}

if (!webglWorks()) cannotDraw();
else {
  try {
    start();
  } catch (e) {
    console.error(e);
    cannotDraw();
  }
}
