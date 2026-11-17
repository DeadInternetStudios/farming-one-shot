import { GROUND, MapBuilder, OVERLAY } from '../mapkit';
import type { Building, MapDef } from '../mapkit';

interface Shopfront {
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lights: { x: number; y: number; r: number }[];
  smoke?: { x: number; y: number };
}

const shop = (s: Shopfront): Building => ({ sprite: `building/${s.sprite}`, glow: `building/${s.sprite}-glow`, x: s.x, y: s.y, w: s.w, h: s.h, lights: s.lights, smoke: s.smoke });

/** Hollow Green. 48 x 34 tiles: one cobbled street with the shops along it, the shrine and a small plaza. */
export function villageMap(seed: number): MapDef {
  const m = new MapBuilder('village', 'Hollow Green', 48, 34, seed);
  m.fill(m.ground, GROUND.Grass);
  m.music = 'village';

  // the street, the plaza and the lanes to the homes in the south
  m.rect(m.overlay, 0, 11, 48, 2, OVERLAY.Cobble);
  m.blob(m.overlay, 24, 18, 9.5, 4.2, OVERLAY.Cobble, 0.12);
  m.rect(m.overlay, 23, 13, 2, 3, OVERLAY.Cobble);
  m.rect(m.overlay, 7, 22, 2, 5, OVERLAY.Path);
  m.rect(m.overlay, 7, 21, 18, 2, OVERLAY.Path);
  m.rect(m.overlay, 37, 21, 2, 6, OVERLAY.Path);
  m.rect(m.overlay, 24, 22, 14, 2, OVERLAY.Path);
  m.rect(m.overlay, 43, 11, 2, 2, OVERLAY.Cobble);

  // the shops and homes
  m.building(shop({ sprite: 'store', x: 3, y: 5, w: 6, h: 6, lights: [{ x: -26, y: -30, r: 36 }, { x: 26, y: -30, r: 36 }] }));
  m.building(shop({ sprite: 'cafe', x: 11, y: 5, w: 7, h: 6, lights: [{ x: -30, y: -30, r: 38 }, { x: 30, y: -30, r: 38 }], smoke: { x: 31, y: -92 } }));
  m.building(shop({ sprite: 'hall', x: 21, y: 4, w: 9, h: 7, lights: [{ x: -51, y: -22, r: 28 }, { x: -31, y: -22, r: 28 }, { x: 35, y: -22, r: 28 }, { x: 55, y: -22, r: 28 }, { x: 0, y: -60, r: 34 }] }));
  m.building(shop({ sprite: 'smithy', x: 33, y: 5, w: 7, h: 6, lights: [{ x: -32, y: -28, r: 34 }, { x: 24, y: -28, r: 44 }], smoke: { x: -27, y: -92 } }));
  m.building(shop({ sprite: 'home-0', x: 42, y: 6, w: 5, h: 5, lights: [{ x: -18, y: -24, r: 26 }] }));
  m.building(shop({ sprite: 'home-1', x: 5, y: 22, w: 5, h: 5, lights: [{ x: -18, y: -24, r: 26 }], smoke: { x: 20, y: -72 } }));
  m.building(shop({ sprite: 'home-2', x: 35, y: 22, w: 5, h: 5, lights: [{ x: -18, y: -24, r: 26 }] }));
  m.building(shop({ sprite: 'home-0', x: 20, y: 26, w: 5, h: 5, lights: [{ x: -18, y: -24, r: 26 }] }));

  // doors you can use
  m.hotspot({ x: 5, y: 10, w: 2, h: 1, kind: 'shop', id: 'store' });
  m.hotspot({ x: 13, y: 10, w: 3, h: 1, kind: 'shop', id: 'cafe' });
  m.hotspot({ x: 35, y: 10, w: 3, h: 1, kind: 'shop', id: 'smithy' });
  m.hotspot({ x: 24, y: 10, w: 3, h: 1, kind: 'text', text: 'The old hall. The doors are barred until the valley has its lanterns back.' });
  m.hotspot({ x: 43, y: 10, w: 3, h: 1, kind: 'text', text: "A quiet cottage. Nobody answers the knock." });
  m.hotspot({ x: 6, y: 26, w: 3, h: 1, kind: 'text', text: "Tam's cottage. A fishing net hangs by the door." });
  m.hotspot({ x: 36, y: 26, w: 3, h: 1, kind: 'text', text: "Olwen's cottage. Tea leaves drying in the window." });
  m.hotspot({ x: 21, y: 30, w: 3, h: 1, kind: 'text', text: "Wren's place. Every sill has a jar of something green." });

  // the shrine in front of the hall, the fountain, the board
  m.prop({ sprite: 'shrine/0', glow: 'shrine/0-glow', id: 'shrine', x: 21, y: 14, w: 6, h: 3, solid: true, interact: 'shrine', light: { x: 0, y: -40, r: 50, color: 0xffc95e } });
  m.prop({ sprite: 'prop/fountain-0', frames: ['prop/fountain-0', 'prop/fountain-1'], x: 23, y: 19, w: 2, h: 2, solid: true, interact: 'text', text: 'The fountain has not run this clear in years. Somebody has been busy.' });
  m.prop({ sprite: 'prop/notice', x: 29, y: 14, w: 2, h: 1, solid: true, interact: 'board' });
  m.prop({ sprite: 'prop/bench', x: 17, y: 18, w: 2, solid: true, noShadow: false });
  m.prop({ sprite: 'prop/bench', x: 29, y: 18, w: 2, solid: true });
  m.prop({ sprite: 'prop/well', x: 41, y: 16, w: 2, h: 2, solid: true, interact: 'text', text: 'Cool, deep water. A coin glints at the bottom.' });
  m.prop({ sprite: 'prop/barrel', x: 2, y: 10, solid: true });
  m.prop({ sprite: 'prop/crate', x: 9, y: 10, solid: true });
  m.prop({ sprite: 'prop/barrel', x: 18, y: 10, solid: true });
  m.prop({ sprite: 'prop/crate', x: 40, y: 10, solid: true });
  m.prop({ sprite: 'prop/hay', x: 31, y: 17, w: 2, solid: true });
  m.prop({ sprite: 'prop/signpost-farm', x: 2, y: 13, solid: true, interact: 'text', text: 'West: your farm. East: the lake.' });
  m.prop({ sprite: 'prop/signpost-lake', x: 45, y: 13, solid: true, interact: 'text', text: 'East: the lake. Tam says the fish are biting.' });
  for (const lx of [9, 20, 32, 40]) m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: lx, y: 13, light: { x: 0, y: -22, r: 70 } });
  for (const [lx, ly] of [[17, 22], [29, 22]] as const) m.prop({ sprite: 'prop/lamp', glow: 'prop/lamp-glow', x: lx, y: ly, light: { x: 0, y: -22, r: 70 } });

  // roads out
  m.warp({ x: 0, y: 11, w: 1, h: 2, to: 'farm', tx: 54, ty: 15.5, dir: 'left' });
  m.warp({ x: 47, y: 11, w: 1, h: 2, to: 'lake', tx: 2, ty: 14, dir: 'right' });
  m.spawn = { x: 3, y: 12 };
  Object.assign(m.homes, {
    mirren: { x: 6, y: 11 }, ida: { x: 14, y: 11 }, bram: { x: 36, y: 11 },
    tam: { x: 7, y: 27 }, olwen: { x: 37, y: 27 }, wren: { x: 1, y: 12 },
  });

  m.keepClear(0, 10, 48, 4);
  m.keepClear(14, 13, 20, 12);
  m.forestEdge(3, [{ x: 0, y: 10, w: 3, h: 5 }, { x: 45, y: 10, w: 3, h: 5 }], 0.92);
  const open = (x: number, y: number): boolean => x > 2 && y > 2 && x < 45 && y < 31;
  m.scatter('tree', 14, (x, y) => open(x, y) && (y > 27 || y < 4 || x < 4 || x > 43), 3, 2);
  m.scatter('bush', 10, open, 3, 1);
  m.scatter('tallgrass', 90, open, 4);
  m.scatter('flower', 40, open, 12);
  m.scatter('rock', 4, (x, y) => open(x, y) && y > 25, 3, 2);
  return m.toDef();
}
