import Phaser from 'phaser';
import type { Dir, Tier, ToolId } from '../game/types';

/** The farmer: position in world pixels at the feet, a walk cycle and tool swings. */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  facing: Dir;
  moving = false;
  swinging = false;
  speed = 62;
  private walkKey = '';

  constructor(private scene: Phaser.Scene, x: number, y: number, dir: Dir) {
    this.x = x;
    this.y = y;
    this.facing = dir;
    this.shadow = scene.add.image(x, y, 'atlas', 'fx/shadow-s').setAlpha(0.55);
    this.sprite = scene.add.sprite(x, y, 'chars', `player/idle-${this.frameDir(dir)}-0`).setOrigin(0.5, 30 / 40);
    this.place();
  }

  private frameDir(d: Dir): 'down' | 'up' | 'side' {
    return d === 'left' || d === 'right' ? 'side' : d;
  }

  private place(): void {
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    this.sprite.setPosition(px, py).setDepth(py);
    this.shadow.setPosition(px, py - 1).setDepth(py - 0.5);
    this.sprite.setFlipX(this.facing === 'left');
  }

  teleport(x: number, y: number, dir?: Dir): void {
    this.x = x;
    this.y = y;
    if (dir) this.face(dir);
    this.place();
  }

  face(dir: Dir): void {
    this.facing = dir;
    if (!this.moving && !this.swinging) this.idle();
    this.sprite.setFlipX(dir === 'left');
  }

  idle(): void {
    this.walkKey = '';
    this.sprite.anims.stop();
    this.sprite.setFrame(`player/idle-${this.frameDir(this.facing)}-0`);
    this.sprite.setFlipX(this.facing === 'left');
  }

  /** Move with axis-separated collision against a solid-tile test. Feet box is 8 wide, 5 tall. */
  update(dt: number, mx: number, my: number, sprint: boolean, solid: (tx: number, ty: number) => boolean): void {
    if (this.swinging) {
      this.moving = false;
      this.place();
      return;
    }
    const len = Math.hypot(mx, my);
    this.moving = len > 0.05;
    if (this.moving) {
      const sp = this.speed * (sprint ? 1.5 : 1) * Math.min(1, len);
      const nx = mx / len;
      const ny = my / len;
      const dx = nx * sp * dt;
      const dy = ny * sp * dt;
      const blocked = (px: number, py: number): boolean => {
        const l = Math.floor((px - 4) / 16), r = Math.floor((px + 4) / 16);
        const t = Math.floor((py - 5) / 16), b = Math.floor((py - 0.01) / 16);
        return solid(l, t) || solid(r, t) || solid(l, b) || solid(r, b);
      };
      if (!blocked(this.x + dx, this.y)) this.x += dx;
      if (!blocked(this.x, this.y + dy)) this.y += dy;
      if (Math.abs(mx) > Math.abs(my)) this.facing = mx < 0 ? 'left' : 'right';
      else this.facing = my < 0 ? 'up' : 'down';
      const key = `player-walk-${this.frameDir(this.facing)}`;
      if (key !== this.walkKey) {
        this.walkKey = key;
        this.sprite.play(key, true);
      }
      this.sprite.anims.timeScale = sprint ? 1.45 : 1;
      this.sprite.setFlipX(this.facing === 'left');
    } else if (this.walkKey) {
      this.idle();
    }
    this.place();
  }

  /** Plays a four frame swing. `onImpact` fires on the frame where the tool lands. */
  swing(tool: ToolId, tier: Tier, onImpact: () => void, onDone: () => void): void {
    if (tool === 'rod') return onDone();
    this.swinging = true;
    this.moving = false;
    this.walkKey = '';
    this.sprite.anims.stop();
    const dir = this.frameDir(this.facing);
    const durations = tool === 'can' ? [110, 110, 220, 160] : [110, 85, 55, 150];
    let t = 0;
    const step = (i: number): void => {
      this.sprite.setFrame(`player/${tool}-${tier}-${dir}-${i}`);
      this.sprite.setFlipX(this.facing === 'left');
      if (i === 2) onImpact();
      if (i === 3) {
        this.scene.time.delayedCall(durations[3] as number, () => {
          this.swinging = false;
          this.idle();
          onDone();
        });
        return;
      }
      t += durations[i] as number;
      this.scene.time.delayedCall(durations[i] as number, () => step(i + 1));
    };
    step(0);
  }
}
