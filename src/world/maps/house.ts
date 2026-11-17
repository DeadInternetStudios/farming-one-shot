import { interiorRoom } from '../interiorKit';
import { MapBuilder } from '../mapkit';
import type { MapDef } from '../mapkit';

/** The farmhouse: one cosy room with everything a day starts and ends with. */
export function houseMap(seed: number): MapDef {
  const m = new MapBuilder('house', 'Your House', 16, 11, seed, true);
  interiorRoom(m, { wall: 'cream', floor: 'wood', door: { x: 7, w: 2 } });
  m.music = 'home';
  m.spawn = { x: 3, y: 4 };
  const deco = { noShadow: true } as const;

  // the back wall, left to right
  m.prop({ sprite: 'int/bed-pink', x: 1, y: 2, w: 2, h: 2, solid: true, interact: 'bed', ...deco });
  m.prop({ sprite: 'int/chest', x: 1, y: 4, solid: true, interact: 'chest', id: 'home', ...deco });
  m.prop({ sprite: 'int/window-day', nightFrame: 'int/window-night', x: 3, y: 1, w: 2, ...deco });
  m.prop({ sprite: 'int/plant-0', x: 3, y: 2, solid: true, ...deco });
  m.prop({ sprite: 'int/fireplace', glow: 'int/fireplace-glow', x: 5, y: 2, w: 2, solid: true, interact: 'text', text: 'The fire pops and crackles. It smells of pine and warm bread.', light: { x: 0, y: -14, r: 78, color: 0xff9a45 }, ...deco });
  m.prop({ sprite: 'int/counter', x: 7, y: 2, w: 2, solid: true, interact: 'counter', ...deco });
  m.prop({ sprite: 'int/picture-1', x: 7, y: 1, w: 2, lift: 14, ...deco });
  m.prop({ sprite: 'int/stove', glow: 'int/stove-glow', x: 9, y: 2, w: 2, solid: true, interact: 'stove', light: { x: 0, y: -14, r: 40, color: 0xff9a45 }, ...deco });
  m.prop({ sprite: 'int/window-day', nightFrame: 'int/window-night', x: 11, y: 1, w: 2, ...deco });
  m.prop({ sprite: 'int/plant-2', x: 12, y: 2, solid: true, ...deco });
  m.prop({ sprite: 'int/bookshelf', x: 13, y: 2, w: 2, solid: true, interact: 'shelf', ...deco });

  // the middle of the room
  m.prop({ sprite: 'int/rug-red', x: 5, y: 4, w: 2, h: 2, flat: true, ...deco });
  m.prop({ sprite: 'int/table', x: 5, y: 5, w: 2, solid: true, interact: 'text', text: 'A sturdy table. Your first harvest is going to taste wonderful on it.', ...deco });
  m.prop({ sprite: 'int/chair', x: 4, y: 5, solid: true, ...deco });
  m.prop({ sprite: 'int/chair', x: 7, y: 5, solid: true, ...deco });
  m.prop({ sprite: 'int/rug-teal', x: 11, y: 6, w: 2, h: 2, flat: true, ...deco });
  m.prop({ sprite: 'int/plant-1', x: 14, y: 4, solid: true, ...deco });
  m.prop({ sprite: 'int/picture-0', x: 1, y: 1, w: 2, lift: 8, ...deco });
  m.prop({ sprite: 'int/mat', x: 7, y: 9, w: 2, flat: true, ...deco });

  m.warp({ x: 7, y: 10, w: 2, h: 1, to: 'farm', tx: 11.5, ty: 11, dir: 'down' });
  return m.toDef();
}
