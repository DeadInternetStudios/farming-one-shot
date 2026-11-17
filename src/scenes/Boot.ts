import Phaser from 'phaser';
import { NPCS } from '../data/npcs';
import { SEASONS } from '../game/types';
import { loadGame } from '../game/save';
import { session } from '../game/session';
import { audio, queueFirstAudio } from '../systems/Audio';

/** Loads everything, builds the animations, then opens the title screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const base = 'assets/';
    this.load.atlas('atlas', `${base}atlas.png`, `${base}atlas.json`);
    this.load.atlas('chars', `${base}chars.png`, `${base}chars.json`);
    this.load.atlas('water', `${base}water.png`, `${base}water.json`);
    this.load.atlas('title', `${base}title.png`, `${base}title.json`);
    for (const s of SEASONS) this.load.image(`tiles-${s}`, `${base}tiles-${s}.png`);
    this.load.image('tiles-interior', `${base}tiles-interior.png`);
    this.load.image('tiles-cave', `${base}tiles-cave.png`);
    this.load.bitmapFont('hollow', `${base}font-hollow.png`, `${base}font-hollow.xml`);
    this.load.bitmapFont('hollow-o', `${base}font-hollow-o.png`, `${base}font-hollow-o.xml`);
    queueFirstAudio(this.load);
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

    audio.start(this.game);
    const q = new URLSearchParams(location.search);
    if (q.has('play')) {
      const saved = q.has('new') ? null : loadGame();
      if (saved) session.load(saved);
      else session.reset(Number(q.get('seed')) || 1);
      session.live = true;
      if (q.has('skip') && !saved) this.skipStory();
      this.scene.start('World');
      this.scene.launch('UI');
    } else {
      this.scene.start('Title');
    }
    document.getElementById('boot')?.classList.add('done');
  }

  /** For testing: begin on the farm with the letter already read, as the first build did. */
  private skipStory(): void {
    const st = session.state;
    const farm = session.map('farm');
    st.player.loc = 'farm';
    st.player.x = (farm.spawn.x + 0.5) * 16;
    st.player.y = (farm.spawn.y + 0.8) * 16;
    st.flags.letter = true;
    st.flags.outside = true;
  }
}
