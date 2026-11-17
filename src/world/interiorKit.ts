import { INTERIOR_TILE_ID as T } from '../gen/art';
import type { MapBuilder } from './mapkit';
import { GROUND } from './mapkit';

export type WallTheme = keyof typeof T.wall;
export type FloorKind = 'wood' | 'check' | 'stone';

const floorIds = (k: FloorKind): readonly number[] => (k === 'wood' ? T.floorWood : k === 'check' ? T.floorCheck : T.floorStone);

/**
 * Lays out an enclosed room: two rows of wall along the top, timber caps on the other three sides,
 * a floor between, soft shadows along the walls, and a door gap in the bottom wall.
 * The floor spans x 1..w-2 and y 2..h-2.
 */
export function interiorRoom(m: MapBuilder, o: { wall: WallTheme; floor: FloorKind; door?: { x: number; w: number } }): void {
  const { w, h } = m;
  m.kind = 'interior';
  m.tiles = new Int16Array(w * h).fill(-1);
  m.overlayTiles = new Int16Array(w * h).fill(-1);
  m.fill(m.ground, GROUND.Grass);
  const wt = T.wall[o.wall];
  const floors = floorIds(o.floor);
  const set = (x: number, y: number, id: number): void => { m.tiles![y * w + x] = id; };
  const sh = (x: number, y: number, id: number): void => { m.overlayTiles![y * w + x] = id; };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = x === 0, right = x === w - 1;
      let id: number;
      let solid = true;
      if (y === 0) id = left ? wt.r0L : right ? wt.r0R : wt.r0;
      else if (y === 1) id = left ? wt.r1L : right ? wt.r1R : wt.r1;
      else if (y === h - 1) id = left ? T.capBL : right ? T.capBR : T.capB;
      else if (left) id = T.capL;
      else if (right) id = T.capR;
      else { id = floors[(x * 7 + y * 13) % floors.length] as number; solid = false; }
      set(x, y, id);
      if (solid) m.solid[y * w + x] = 1;
    }
  }
  if (o.door) {
    for (let i = 0; i < o.door.w; i++) {
      set(o.door.x + i, h - 1, floors[(o.door.x + i) % floors.length] as number);
      m.solid[(h - 1) * w + o.door.x + i] = 0;
    }
  }
  for (let x = 1; x < w - 1; x++) sh(x, 2, x === 1 ? T.shadow.TL : x === w - 2 ? T.shadow.TR : T.shadow.T);
  for (let y = 3; y < h - 1; y++) { sh(1, y, T.shadow.L); sh(w - 2, y, T.shadow.R); }
}
