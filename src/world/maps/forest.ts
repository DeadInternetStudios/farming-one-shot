import { GROUND, MapBuilder, OVERLAY } from '../mapkit';
import type { MapDef } from '../mapkit';

/** Whisper Wood. 40 x 40 tiles: a dark, friendly forest with a clearing in the middle and the old mine at the top. */
export function forestMap(seed: number): MapDef {
  const m = new MapBuilder('forest', 'Whisper Wood', 40, 40, seed);
  m.fill(m.ground, GROUND.Grass);
  m.music = 'forest';

  // a pond in the east and the trail that runs through everything
  m.blob(m.ground, 31, 24, 5.2, 3.6, GROUND.Void);
  m.rect(m.overlay, 19, 28, 2, 12, OVERLAY.Path);
  m.blob(m.overlay, 20, 22, 7, 5, OVERLAY.Path, 0.2);
  m.rect(m.overlay, 19, 7, 2, 16, OVERLAY.Path);
  m.rect(m.overlay, 14, 6, 14, 2, OVERLAY.Path);

  // the mine mouth: rocky mass with an opening you can walk into
  m.prop({ sprite: 'prop/mine-entrance', x: 18, y: 2, w: 5, h: 4, light: { x: 28, y: -42, r: 34, color: 0xffbe66 } });
  m.rect(m.solid, 18, 2, 2, 4, 1);
  m.rect(m.solid, 21, 2, 2, 4, 1);
  m.rect(m.solid, 20, 2, 1, 2, 1);
  m.warp({ x: 20, y: 4, w: 1, h: 2, to: 'mine-1', tx: 4, ty: 4, dir: 'down' });

  // signposts, a lamp where the trail splits
  m.prop({ sprite: 'prop/signpost-forest', x: 22, y: 33, solid: true, interact: 'text', text: 'North: the old mine. Take a pickaxe and some patience.' });
  m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: 17, y: 22, light: { x: 0, y: -22, r: 70 } });
  m.prop({ sprite: 'prop/bench', x: 11, y: 24, w: 2, solid: true });
  m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: 24, y: 7, light: { x: 0, y: -22, r: 70 } });

  m.warp({ x: 19, y: 39, w: 2, h: 1, to: 'farm', tx: 28, ty: 1.2, dir: 'down' });
  m.spawn = { x: 20, y: 36 };

  m.keepClear(17, 6, 7, 34);
  m.keepClear(11, 17, 20, 12);
  m.keepClear(13, 5, 16, 4);
  m.forestEdge(6, [{ x: 17, y: 34, w: 7, h: 6 }], 0.95);

  const open = (x: number, y: number): boolean => x > 3 && y > 7 && x < 37 && y < 36;
  m.scatter('tree', 150, open, 3, 1);
  m.scatter('bush', 24, open, 3, 1);
  m.scatter('boulder', 4, open, 2, 3);
  m.scatter('rock', 16, open, 3, 1);
  m.scatter('stump', 10, open, 1, 2);
  m.scatter('log', 4, open, 2, 3);
  m.scatter('branch', 14, open, 3);
  m.scatter('weed', 36, open, 3);
  m.scatter('tallgrass', 110, open, 4);
  m.scatter('flower', 26, open, 12);
  m.scatter('mushroom', 8, open, 2, 1);
  m.scatter('berries', 6, open, 2, 1);
  m.scatter('clay', 4, (x, y) => open(x, y) && x > 24 && x < 37 && y > 17 && y < 31, 1, 1);
  Object.assign(m.homes, { wren: { x: 19, y: 36 } });
  return m.toDef();
}
