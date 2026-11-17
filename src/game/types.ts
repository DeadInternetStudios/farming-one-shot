export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIR_VEC: Readonly<Record<Dir, { x: number; y: number }>> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type ToolId = 'hoe' | 'can' | 'axe' | 'pick' | 'scythe' | 'rod';
export type Tier = 'basic' | 'copper' | 'silver' | 'gold';
export const TIERS: readonly Tier[] = ['basic', 'copper', 'silver', 'gold'];

export type Weather = 'sun' | 'cloud' | 'rain' | 'storm' | 'snow';

export type LocationId = 'farm' | 'village' | 'forest' | 'lake' | 'beach' | 'quarry' | 'mine' | 'house' | string;

export interface Tile {
  x: number;
  y: number;
}

export const tileKey = (x: number, y: number): string => `${x},${y}`;
export const parseKey = (k: string): Tile => {
  const [x, y] = k.split(',');
  return { x: Number(x), y: Number(y) };
};
