import { CAVE_TILE_ID as C } from '../../gen/art';
import { chance, hashInts, mulberry32, randInt } from '../../game/rng';
import type { Rand } from '../../game/rng';
import { GROUND, MapBuilder } from '../mapkit';
import type { MapDef } from '../mapkit';

export const MINE_FLOORS = 5;
const W = 34;
const H = 26;
/** Every floor has its entry room in the same corner, so ladders always line up. */
export const MINE_ENTRY = { x: 4, y: 4 } as const;

const inGrid = (x: number, y: number): boolean => x > 0 && y > 1 && x < W - 1 && y < H - 1;

/** Cellular automata caves: rough noise smoothed into rooms and tunnels, then trimmed to one connected space. */
function carve(rand: Rand): Uint8Array {
  let cells = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells[y * W + x] = inGrid(x, y) && !chance(rand, 0.43) ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let walls = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!cells[(y + j) * W + x + i]) walls++;
        next[y * W + x] = inGrid(x, y) && (walls < 5 || (pass < 2 && walls === 5 && cells[y * W + x] === 1)) ? 1 : 0;
      }
    }
    cells = next;
  }
  // the entry room, always
  for (let y = 3; y <= 7; y++) for (let x = 2; x <= 8; x++) cells[y * W + x] = 1;
  // keep only what you can reach from the entry
  const seen = new Uint8Array(W * H);
  const queue = [MINE_ENTRY.y * W + MINE_ENTRY.x];
  seen[queue[0] as number] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const ni = (cy + dy) * W + cx + dx;
      if (cells[ni] && !seen[ni]) { seen[ni] = 1; queue.push(ni); }
    }
  }
  return seen;
}

/** The floor tile farthest from the entry by walking, where the way down goes. */
function farthest(floor: Uint8Array): { x: number; y: number } {
  const dist = new Int16Array(W * H).fill(-1);
  const start = MINE_ENTRY.y * W + MINE_ENTRY.x;
  dist[start] = 0;
  const queue = [start];
  let last = start;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    last = cur;
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const ni = (cy + dy) * W + cx + dx;
      if (floor[ni] && dist[ni] === -1) { dist[ni] = (dist[cur] as number) + 1; queue.push(ni); }
    }
  }
  // the last cell reached is a farthest one; step back until the cell has floor on all sides, so it is easy to reach
  const idx = queue.slice().reverse().find((i) => floor[i - 1] && floor[i + 1] && floor[i - W] && floor[i + W]) ?? last;
  const x = idx % W;
  return { x, y: (idx - x) / W };
}

/** One floor of the mine. The same seed and day always give the same floor, and a new day gives a fresh one. */
export function mineMap(floorNo: number, seed: number, day: number): MapDef {
  const rand = mulberry32(hashInts(seed, day, floorNo, 4242));
  const m = new MapBuilder(`mine-${floorNo}`, `The Mine, floor ${floorNo}`, W, H, hashInts(seed, day, floorNo), true);
  m.kind = 'cave';
  m.music = 'mine';
  const floor = carve(rand);
  const isFloor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && floor[y * W + x] === 1;

  m.tiles = new Int16Array(W * H).fill(-1);
  m.overlayTiles = new Int16Array(W * H).fill(-1);
  const hole = floorNo < MINE_FLOORS ? farthest(floor) : null;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = (x * 7 + y * 13 + floorNo) % 4;
      if (isFloor(x, y)) {
        m.ground[i] = GROUND.Grass;
        const mask = (isFloor(x, y - 1) ? 0 : 1) | (isFloor(x - 1, y) ? 0 : 2) | (isFloor(x + 1, y) ? 0 : 4);
        m.tiles[i] = (C.floor[v] as readonly number[])[mask] as number;
      } else {
        m.ground[i] = GROUND.Void;
        m.tiles[i] = isFloor(x, y + 1) ? (C.face[v % 3] as number) : (C.mass[v % 3] as number);
      }
    }
  }

  // the ladder up, in the entry room's top wall row
  const up = { x: MINE_ENTRY.x, y: MINE_ENTRY.y - 1 };
  m.tiles[up.y * W + up.x] = C.up;
  m.ground[up.y * W + up.x] = GROUND.Grass;
  const upTarget = floorNo === 1
    ? { to: 'forest', tx: 20, ty: 6 }
    : (() => {
      const above = mineHole(floorNo - 1, seed, day);
      return { to: `mine-${floorNo - 1}`, tx: above?.x ?? MINE_ENTRY.x, ty: (above?.y ?? MINE_ENTRY.y) + 1 };
    })();
  m.warp({ x: up.x, y: up.y, w: 1, h: 1, ...upTarget, dir: 'down' });
  m.spawn = { x: MINE_ENTRY.x, y: MINE_ENTRY.y };

  if (hole) {
    m.tiles[hole.y * W + hole.x] = C.hole;
    m.warp({ x: hole.x, y: hole.y, w: 1, h: 1, to: `mine-${floorNo + 1}`, tx: MINE_ENTRY.x, ty: MINE_ENTRY.y, dir: 'down' });
    m.keepClear(hole.x - 1, hole.y - 1, 3, 3);
  }
  m.keepClear(2, 3, 7, 5);

  // ore by depth: coppery near the top, iron in the middle, gold and crystals at the bottom
  const rocks = 16 - floorNo;
  m.scatter('rock', rocks, () => true, 3, 1);
  if (floorNo >= 2) m.scatter('boulder', 2 + Math.floor(floorNo / 2), (x, y) => [-1, 0, 1].every((j) => [-1, 0, 1].every((i) => isFloor(x + i, y + j))), 2, 2);
  m.scatter('copper', Math.max(2, 9 - floorNo * 2), () => true, 1, 1);
  if (floorNo >= 2) m.scatter('iron', 3 + floorNo, () => true, 1, 1);
  if (floorNo >= 4) m.scatter('gold', floorNo - 1, () => true, 1, 1);
  if (floorNo >= 2) {
    m.scatter('crystal', 2 + Math.floor(floorNo / 2), () => true, 1, 2);
    for (const o of m.objects) if (o.k === 'crystal') o.v = floorNo - 1;
  }
  // a few rare finds sit out in the open on the deepest floors
  m.scatter('mushroom', floorNo >= 3 ? 3 : 0, () => true, 2, 1);

  // glowing things on the walls
  let decor = 0;
  for (let tries = 0; tries < 400 && decor < 5 + floorNo; tries++) {
    const x = randInt(rand, 2, W - 3);
    const y = randInt(rand, 3, H - 3);
    if (!isFloor(x, y) || isFloor(x, y - 1) || !m.free(x, y)) continue;
    const kind = chance(rand, 0.35) ? 'mushroom' : chance(rand, 0.5) ? 'purple' : 'blue';
    if (kind === 'mushroom') m.prop({ sprite: 'cave/mushroom', x, y, noShadow: true, light: { x: 0, y: -8, r: 34, color: 0x7be3d6 } });
    else m.prop({ sprite: `cave/crystal-${kind}`, glow: `cave/crystal-${kind}-glow`, x, y, noShadow: true, light: { x: 0, y: -10, r: 44, color: kind === 'purple' ? 0xb99bff : 0x7bd4ff } });
    decor += 1;
  }
  return m.toDef();
}

/** Where the way down is on a given floor, found by building the floor. Cheap enough to do on demand. */
const holes = new Map<string, { x: number; y: number } | null>();
export function mineHole(floorNo: number, seed: number, day: number): { x: number; y: number } | null {
  const key = `${seed}:${day}:${floorNo}`;
  if (holes.has(key)) return holes.get(key) ?? null;
  const rand = mulberry32(hashInts(seed, day, floorNo, 4242));
  const floor = carve(rand);
  const h = floorNo < MINE_FLOORS ? farthest(floor) : null;
  if (holes.size > 64) holes.clear();
  holes.set(key, h);
  return h;
}
