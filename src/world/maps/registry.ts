import type { MapDef } from '../mapkit';
import { farmMap } from './farm';
import { houseMap } from './house';
import { villageMap } from './village';

const BUILDERS: Readonly<Record<string, (seed: number) => MapDef>> = {
  farm: farmMap,
  house: houseMap,
  village: villageMap,
};

export const hasMap = (id: string): boolean => id in BUILDERS;

export function buildMap(id: string, seed: number): MapDef {
  const b = BUILDERS[id];
  if (!b) throw new Error('Unknown map ' + id);
  return b(seed);
}
