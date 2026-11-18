import Phaser from 'phaser';
import { PAL } from '../gen/art';
import { itemDef } from '../data/items';
import type { GameState } from '../game/state';
import type { ToolId } from '../game/types';
import { shake } from './motion';

/** Text colours: cream reads on the dark HUD pills, ink reads on parchment. */
export const COL = {
  cream: PAL.cream[3],
  ink: PAL.ink[1],
  dim: PAL.wood[2],
  gold: PAL.yellow[3],
  leaf: PAL.leaf[4],
  berry: PAL.red[3],
  water: PAL.water[3],
  /** A label on a button that cannot be used right now: parchment-brown, quieter than the text around it. */
  off: 0x8b7a62,
} as const;

/** The dark the opening passes through: a lit lantern's, not the night's, so the title opens into the house's light. */
export const WARM_DARK = [58, 36, 16] as const;

export const WEATHER_NAMES = { sun: 'Sunny', cloud: 'Cloudy', rain: 'Rainy', storm: 'Stormy', snow: 'Snowy' } as const;

export function iconFor(state: GameState, id: string): string {
  const d = itemDef(id);
  return d.kind === 'tool' ? `${d.icon}-${state.player.tools[id as ToolId]}` : d.icon;
}

export function nine(scene: Phaser.Scene, kind: 'parchment' | 'dark', x: number, y: number, w: number, h: number): Phaser.GameObjects.NineSlice {
  const frame = kind === 'dark' ? 'ui/panel-dark' : 'ui/panel';
  const b = kind === 'dark' ? 6 : 8;
  return scene.add.nineslice(x, y, 'atlas', frame, w, h, b, b, b, b).setOrigin(0, 0);
}

export interface TextOpts {
  tint?: number;
  outline?: boolean;
  origin?: [number, number];
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

export function label(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), o.outline ? 'hollow-o' : 'hollow', s);
  t.setTint(o.tint ?? COL.cream);
  if (o.origin) t.setOrigin(o.origin[0], o.origin[1]);
  if (o.wrap) t.setMaxWidth(o.wrap);
  if (o.align) t.setCenterAlign();
  return t;
}

export interface Button {
  parts: Phaser.GameObjects.GameObject[];
  setEnabled(v: boolean): void;
  destroy(): void;
}

/**
 * A rounded nine-slice button with a label and a hit zone. With an icon and no text the icon sits in the middle; with both they are centred as a pair.
 * A button that is `off` looks switched off (it cannot do what it says) but still answers a press, so the screen can say why.
 */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, kind: 'leaf' | 'wood' | 'berry' | 'sky', onClick: () => void, icon?: string, off = false): Button {
  const frame = (s: string): string => `ui/btn-${kind}-${s}`;
  const ns = scene.add.nineslice(x, y, 'atlas', frame('up'), w, h, 6, 6, 6, 6).setOrigin(0, 0);
  const tx = label(scene, x + w / 2, y + h / 2 + 1, text, { outline: true, origin: [0.5, 0.5] });
  const pic = icon ? scene.add.image(0, 0, 'atlas', icon) : null;
  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  if (pic && text) {
    const gap = 3;
    const start = x + (w - (pic.width + gap + tx.width)) / 2;
    pic.setPosition(Math.round(start + pic.width / 2), 0);
    tx.setOrigin(0, 0.5).setX(Math.round(start + pic.width + gap));
  } else if (pic) {
    pic.setX(Math.round(x + w / 2));
  }
  const tx0 = tx.x;
  const pic0 = pic?.x ?? 0;
  let enabled = true;
  const dead = (): boolean => !enabled || off;
  const set = (s: string): void => {
    const push = s === 'down' && !dead() ? 1 : 0;
    ns.setTexture('atlas', dead() ? 'ui/btn-disabled' : frame(s));
    // a switched-off label drops its dark outline: it sits on a pale plate, not a coloured one
    tx.setFont(dead() ? 'hollow' : 'hollow-o').setTint(dead() ? COL.off : COL.cream);
    pic?.setAlpha(dead() ? 0.6 : 1);
    tx.setY(Math.round(y + h / 2 + 1 + push));
    pic?.setY(Math.round(y + h / 2 + push));
  };
  set('up');
  // a press has to start on the button too, so letting go of a list drag over a button does not press it
  let armed = false;
  zone.on('pointerover', () => set('hover'));
  zone.on('pointerout', () => { armed = false; set('up'); });
  zone.on('pointerdown', () => { armed = true; set('down'); });
  zone.on('pointerup', () => {
    set('hover');
    if (armed && enabled) {
      onClick();
      if (off) shake(scene, (dx) => { ns.setX(x + dx); tx.setX(tx0 + dx); pic?.setX(pic0 + dx); });
    }
    armed = false;
  });
  const parts: Phaser.GameObjects.GameObject[] = [ns, tx, zone];
  if (pic) parts.push(pic);
  return {
    parts,
    setEnabled: (v) => { enabled = v; set('up'); },
    destroy: () => { for (const p of parts) p.destroy(); },
  };
}

/** Breaks text into lines that fit, so the typewriter never makes words jump. */
export function wrapText(scene: Phaser.Scene, s: string, maxW: number): string {
  const probe = label(scene, 0, 0, '').setVisible(false);
  const lines: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      probe.setText(next);
      if (probe.width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  probe.destroy();
  return lines.join('\n');
}
