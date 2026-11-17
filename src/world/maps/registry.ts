import type { GameState } from '../../game/state';
import type { MapDef } from '../mapkit';
import { farmMap } from './farm';
import { forestMap } from './forest';
import { houseMap } from './house';
import { lakeMap } from './lake';
import { MINE_FLOORS, mineMap } from './mine';
import { villageMap } from './village';

const FIXED: Readonly<Record<string, (state: GameState) => MapDef>> = {
  farm: (s) => farmMap(s.seed, s),
  house: (s) => houseMap(s.seed),
  village: (s) => villageMap(s.seed, s),
  forest: (s) => forestMap(s.seed),
  lake: (s) => lakeMap(s.seed),
};

const mineFloor = (id: string): number => (/^mine-[1-9]$/.test(id) ? Number(id.slice(5)) : 0);

export const hasMap = (id: string): boolean => id in FIXED || (mineFloor(id) >= 1 && mineFloor(id) <= MINE_FLOORS);

/** Mine floors are different every day; everything else is the same every time. */
export const isDaily = (id: string): boolean => mineFloor(id) > 0;

export function buildMap(id: string, state: GameState): MapDef {
  const f = FIXED[id];
  if (f) return f(state);
  const floor = mineFloor(id);
  if (floor > 0) return mineMap(floor, state.seed, state.day);
  throw new Error('Unknown map ' + id);
}
