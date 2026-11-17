export interface Tile {
  x: number;
  y: number;
}

const STEPS: readonly Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/**
 * Breadth first search over a tile grid, four directions. Returns the tiles to walk through, not
 * including the start and including the goal, or null when no road exists. `solid` says which
 * tiles are blocked; the goal itself is allowed to be blocked so that "walk up to" works.
 */
export function findPath(w: number, h: number, solid: (x: number, y: number) => boolean, from: Tile, to: Tile, reachOnly = false): Tile[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const idx = (x: number, y: number): number => y * w + x;
  const prev = new Int32Array(w * h).fill(-2);
  const queue: number[] = [idx(from.x, from.y)];
  prev[queue[0] as number] = -1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const s of STEPS) {
      const nx = cx + s.x;
      const ny = cy + s.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      if (prev[ni] !== -2) continue;
      const isGoal = nx === to.x && ny === to.y;
      if (solid(nx, ny) && !(isGoal && reachOnly)) continue;
      prev[ni] = cur;
      if (isGoal) {
        const out: Tile[] = [];
        for (let at = ni; at !== -1; at = prev[at] as number) {
          if (at === idx(from.x, from.y)) break;
          out.push({ x: at % w, y: Math.floor(at / w) });
        }
        return out.reverse();
      }
      queue.push(ni);
    }
  }
  return null;
}
