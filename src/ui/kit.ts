import Phaser from 'phaser';
import { PAL } from '../gen/art';
import { itemDef } from '../data/items';
import type { GameState } from '../game/state';
import type { ToolId } from '../game/types';

/** Text colours: cream reads on the dark HUD pills, ink reads on parchment. */
export const COL = {
  cream: PAL.cream[3],
  ink: PAL.ink[1],
  dim: PAL.wood[2],
  gold: PAL.yellow[3],
  leaf: PAL.leaf[4],
  berry: PAL.red[3],
  water: PAL.water[3],
} as const;

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

/** A rounded nine-slice button with a label and a hit zone. */
export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, kind: 'leaf' | 'wood' | 'berry' | 'sky', onClick: () => void): Button {
  const frame = (s: string): string => `ui/btn-${kind}-${s}`;
  const ns = scene.add.nineslice(x, y, 'atlas', frame('up'), w, h, 6, 6, 6, 6).setOrigin(0, 0);
  const tx = label(scene, x + w / 2, y + h / 2 + 1, text, { outline: true, origin: [0.5, 0.5] });
  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  let enabled = true;
  const set = (s: string): void => {
    ns.setTexture('atlas', enabled ? frame(s) : 'ui/btn-disabled');
    tx.setY(Math.round(y + h / 2 + 1 + (s === 'down' && enabled ? 1 : 0)));
  };
  zone.on('pointerover', () => set('hover'));
  zone.on('pointerout', () => set('up'));
  zone.on('pointerdown', () => set('down'));
  zone.on('pointerup', () => {
    set('hover');
    if (enabled) onClick();
  });
  return {
    parts: [ns, tx, zone],
    setEnabled: (v) => { enabled = v; set('up'); },
    destroy: () => { ns.destroy(); tx.destroy(); zone.destroy(); },
  };
}
