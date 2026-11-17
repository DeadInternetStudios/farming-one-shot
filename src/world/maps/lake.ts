import { GROUND, MapBuilder, OVERLAY } from '../mapkit';
import type { MapDef } from '../mapkit';

/** Mirror Lake. 44 x 32 tiles: a wide still lake with a long dock and Old Tam's hut on the shore. */
export function lakeMap(seed: number): MapDef {
  const m = new MapBuilder('lake', 'Mirror Lake', 44, 32, seed);
  m.fill(m.ground, GROUND.Grass);
  m.music = 'lake';

  // a sandy shore around deep water
  m.blob(m.ground, 29, 16, 15.5, 10.5, GROUND.Sand, 0.18);
  m.blob(m.ground, 29, 16, 13, 8.5, GROUND.Void, 0.16);

  // the road in from the village, the shore path and the dock
  m.rect(m.overlay, 0, 13, 13, 2, OVERLAY.Path);
  m.rect(m.overlay, 12, 13, 14, 2, OVERLAY.Plank);

  // Tam's hut
  m.building({
    sprite: 'building/shack', glow: 'building/shack-glow', x: 6, y: 8, w: 5, h: 4,
    lights: [{ x: -26, y: -26, r: 32 }, { x: 8, y: -22, r: 32 }],
  });
  m.hotspot({ x: 8, y: 11, w: 2, h: 1, kind: 'text', text: "Old Tam's hut. A sign on the door says: Gone fishing. Back before dark. Probably." });
  m.prop({ sprite: 'prop/rowboat', x: 26, y: 15, w: 3, h: 1, flat: false, noShadow: true });
  m.prop({ sprite: 'prop/bench', x: 11, y: 15, w: 2, solid: true });
  m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: 12, y: 12, light: { x: 0, y: -22, r: 72 } });
  m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: 21, y: 12, light: { x: 0, y: -22, r: 72 } });
  m.prop({ sprite: 'prop/barrel', x: 5, y: 12, solid: true });
  m.prop({ sprite: 'prop/crate', x: 4, y: 12, solid: true });
  m.prop({ sprite: 'prop/signpost-lake', x: 3, y: 15, solid: true, interact: 'text', text: 'Mirror Lake. Hold the rod, face the water, and wait. Tam says the best bites come at dusk.' });

  m.warp({ x: 0, y: 13, w: 1, h: 2, to: 'village', tx: 46, ty: 11.5, dir: 'left' });
  m.spawn = { x: 2, y: 13 };
  Object.assign(m.homes, { tam: { x: 8, y: 12 } });

  m.keepClear(0, 11, 14, 6);
  m.keepClear(11, 11, 16, 6);
  m.forestEdge(4, [{ x: 0, y: 11, w: 4, h: 6 }], 0.9);
  const land = (x: number, y: number): boolean => x > 2 && y > 2 && x < 41 && y < 29;
  m.scatter('tree', 22, (x, y) => land(x, y) && (y < 6 || y > 25 || x < 6 || x > 38), 3, 2);
  m.scatter('bush', 14, land, 3, 1);
  m.scatter('rock', 10, land, 3, 1);
  m.scatter('stump', 4, land, 1, 2);
  m.scatter('branch', 8, land, 3);
  m.scatter('tallgrass', 70, land, 4);
  m.scatter('flower', 26, land, 12);
  m.scatter('weed', 16, land, 3);
  return m.toDef();
}
