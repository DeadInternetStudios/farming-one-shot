import Phaser from 'phaser';
import { installLayout, measure } from './display';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { UIScene } from './scenes/UI';
import { WorldScene } from './scenes/World';

const parent = document.getElementById('game');
if (!parent) throw new Error('missing #game');

const query = new URLSearchParams(location.search);
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
