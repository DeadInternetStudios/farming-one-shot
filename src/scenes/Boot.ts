import Phaser from 'phaser';
import { NPCS } from '../data/npcs';
import { SEASONS } from '../game/types';
import { loadGame } from '../game/save';
import { session } from '../game/session';

/** Loads everything, builds the animations, then hands over to the world and the interface. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const base = 'assets/';
    this.load.atlas('atlas', `${base}atlas.png`, `${base}atlas.json`);
    this.load.atlas('chars', `${base}chars.png`, `${base}chars.json`);
    this.load.atlas('water', `${base}water.png`, `${base}water.json`);
    for (const s of SEASONS) this.load.image(`tiles-${s}`, `${base}tiles-${s}.png`);
    this.load.image('tiles-interior', `${base}tiles-interior.png`);
    this.load.image('tiles-cave', `${base}tiles-cave.png`);
    this.load.bitmapFont('hollow', `${base}font-hollow.png`, `${base}font-hollow.xml`);
    this.load.bitmapFont('hollow-o', `${base}font-hollow-o.png`, `${base}font-hollow-o.xml`);
  }

  create(): void {
    for (const dir of ['down', 'up', 'side'] as const) {
      this.anims.create({
        key: `player-walk-${dir}`,
        frames: [0, 1, 2, 3].map((i) => ({ key: 'chars', frame: `player/walk-${dir}-${i}` })),
        frameRate: 8,
        repeat: -1,
      });
    }

    for (const n of NPCS) {
      for (const dir of ['down', 'up', 'side'] as const) {
        this.anims.create({
          key: `npc-${n.id}-walk-${dir}`,
          frames: [0, 1, 2, 3].map((i) => ({ key: 'chars', frame: `npc/${n.id}/walk-${dir}-${i}` })),
          frameRate: 5,
          repeat: -1,
        });
      }
    }

    const q = new URLSearchParams(location.search);
    const saved = q.has('new') ? null : loadGame();
    if (saved) session.load(saved);
    else session.reset(Number(q.get('seed')) || 1);

    this.scene.start('World');
    this.scene.launch('UI');
    document.getElementById('boot')?.classList.add('done');
  }
}
