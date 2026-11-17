import { GROUND, MapBuilder, OVERLAY } from '../mapkit';
import type { MapDef } from '../mapkit';

/** Lantern Hollow Farm. 56 x 40 tiles. The house sits top left, the pond bottom right. */
export function farmMap(seed: number): MapDef {
  const m = new MapBuilder('farm', 'Lantern Hollow Farm', 56, 40, seed);
  m.fill(m.ground, GROUND.Grass);

  // pond
  m.blob(m.ground, 44, 31, 8.5, 5.5, GROUND.Void);
  m.blob(m.ground, 36.5, 29, 2.6, 1.8, GROUND.Void, 0.3);

  // roads: door step, the east road to the village and the north road to the wood
  m.rect(m.overlay, 11, 11, 2, 5, OVERLAY.Path);
  m.rect(m.overlay, 11, 15, 45, 2, OVERLAY.Path);
  m.rect(m.overlay, 27, 0, 2, 16, OVERLAY.Path);

  // the house
  m.building({
    sprite: 'building/farmhouse', glow: 'building/farmhouse-glow', x: 9, y: 6, w: 6, h: 5,
    smoke: { x: 23, y: -86 },
    lights: [{ x: -26, y: -25, r: 46 }, { x: 26, y: -25, r: 46 }, { x: 12, y: -27, r: 38 }],
  });
  m.prop({ sprite: 'building/bin', x: 16, y: 10, solid: true, interact: 'bin' });
  m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: 14, y: 12, light: { x: 0, y: -22, r: 74 } });
  m.prop({ sprite: 'prop/sign', x: 26, y: 14, solid: true, interact: 'sign', text: 'East: Hollow Green village.\nNorth: Whisper Wood.' });

  // doors and roads out
  m.warp({ x: 11, y: 10, w: 2, h: 1, to: 'house', tx: 7.5, ty: 9, dir: 'up' });
  m.warp({ x: 55, y: 15, w: 1, h: 2, to: 'village', tx: 1, ty: 15, dir: 'right' });
  m.warp({ x: 27, y: 0, w: 2, h: 1, to: 'forest', tx: 20, ty: 38, dir: 'up' });
  m.spawn = { x: 12, y: 12 };

  // keep the first field and the yard tidy so the first day has room to breathe
  m.keepClear(6, 4, 12, 15);
  m.keepClear(15, 17, 16, 12);
  m.keepClear(30, 13, 25, 5);
  m.keepClear(23, 0, 8, 17);

  // a thick wood round the edge, open where the roads leave
  m.forestEdge(5, [
    { x: 50, y: 12, w: 6, h: 8 },
    { x: 24, y: 0, w: 8, h: 5 },
  ], 0.9);

  const farFromYard = (x: number, y: number): boolean => x > 3 && y > 3 && x < 52 && y < 36;
  m.scatter('tree', 16, farFromYard, 3, 2);
  m.scatter('bush', 12, farFromYard, 3, 1);
  m.scatter('boulder', 3, (x, y) => farFromYard(x, y) && (y > 29 || x > 34), 2, 3);
  m.scatter('rock', 18, farFromYard, 3, 1);
  m.scatter('stump', 6, farFromYard, 1, 2);
  m.scatter('log', 2, (x, y) => farFromYard(x, y) && y > 26, 2, 3);
  m.scatter('branch', 12, farFromYard, 3);
  m.scatter('weed', 70, farFromYard, 3);
  m.scatter('tallgrass', 100, farFromYard, 4);
  m.scatter('flower', 34, farFromYard, 12);

  return m.toDef(m.tillableFrom((x, y) => x > 1 && y > 1 && x < 54 && y < 38));
}
