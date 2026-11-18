import Phaser from 'phaser';
import { BLOB_INDEX, TILESET, TILE_ID } from '../gen/art';
import type { LocationState } from '../game/state';
import type { Season } from '../game/types';
import { parseKey, tileKey } from '../game/types';
import { GROUND, OVERLAY } from './mapkit';
import type { MapDef } from './mapkit';

const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;
const OFFS: readonly (readonly [number, number, number])[] = [
  [0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW],
];

export const DEPTH = { water: -1000, land: -900, overlay: -800, ground: -700, light: 9000, glow: 9100 } as const;

const hash2 = (x: number, y: number): number => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return (h >>> 0) % 1024;
};

/** The ground: animated water underneath, land and paths drawn as blob tiles on top. */
export class MapView {
  readonly tilemap: Phaser.Tilemaps.Tilemap;
  readonly land: Phaser.Tilemaps.TilemapLayer;
  readonly overlay: Phaser.Tilemaps.TilemapLayer;
  readonly water: Phaser.GameObjects.TileSprite | null = null;
  /** Dark timber beyond the walls of a room, so a small room on a tall screen sits on something. */
  private readonly timber: Phaser.GameObjects.TileSprite | null = null;
  private tileset: Phaser.Tilemaps.Tileset;
  private waterFrame = 0;
  private waterTimer: Phaser.Time.TimerEvent | null = null;
  /** Rooms and caves paint ready-made tiles instead of blending grass and water. */
  private readonly authored: boolean;

  constructor(private scene: Phaser.Scene, readonly def: MapDef, private loc: LocationState, season: Season) {
    this.authored = def.kind !== 'outdoor';
    if (!this.authored) {
      const water = scene.add.tileSprite(0, 0, def.w * 16, def.h * 16, 'water', 'water-0').setOrigin(0, 0).setDepth(DEPTH.water);
      this.water = water;
      this.waterTimer = scene.time.addEvent({
        delay: 260, loop: true,
        callback: () => {
          this.waterFrame = (this.waterFrame + 1) % 6;
          water.setFrame(`water-${this.waterFrame}`);
        },
      });
    }

    if (def.kind === 'interior') {
      const pad = 640;
      this.timber = scene.add.tileSprite(-pad, -pad, def.w * 16 + pad * 2, def.h * 16 + pad * 2, 'atlas', 'bg/timber').setOrigin(0, 0).setDepth(DEPTH.water - 10);
    }

    this.tilemap = scene.make.tilemap({ tileWidth: 16, tileHeight: 16, width: def.w, height: def.h });
    const key = this.authored ? `tiles-${def.kind}` : `tiles-${season}`;
    const ts = this.tilemap.addTilesetImage('tiles', key, 16, 16, TILESET.margin, TILESET.spacing);
    if (!ts) throw new Error('tileset failed to load');
    this.tileset = ts;
    const land = this.tilemap.createBlankLayer('land', ts, 0, 0, def.w, def.h);
    const overlay = this.tilemap.createBlankLayer('overlay', ts, 0, 0, def.w, def.h);
    if (!land || !overlay) throw new Error('tile layers failed to build');
    this.land = land.setDepth(DEPTH.land);
    this.overlay = overlay.setDepth(DEPTH.overlay);

    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        this.paintLand(x, y);
        this.paintOverlay(x, y);
      }
    }
  }

  setSeason(season: Season): void {
    if (this.authored) return;
    const tex = this.scene.textures.get(`tiles-${season}`);
    this.tileset.setImage(tex);
  }

  destroy(): void {
    this.waterTimer?.remove();
    this.water?.destroy();
    this.timber?.destroy();
    this.tilemap.destroy();
  }

  private mask(x: number, y: number, same: (nx: number, ny: number) => boolean, outside: boolean): number {
    let m = 0;
    for (const [dx, dy, bit] of OFFS) {
      const nx = x + dx;
      const ny = y + dy;
      const inside = nx >= 0 && ny >= 0 && nx < this.def.w && ny < this.def.h;
      if (inside ? same(nx, ny) : outside) m |= bit;
    }
    return m;
  }

  private groundAt(x: number, y: number): number {
    return this.def.ground[y * this.def.w + x] as number;
  }
  private overlayAt(x: number, y: number): number {
    return this.def.overlay[y * this.def.w + x] as number;
  }

  private paintLand(x: number, y: number): void {
    if (this.authored) {
      const id = this.def.tiles?.[y * this.def.w + x] ?? -1;
      if (id < 0) this.land.removeTileAt(x, y);
      else this.land.putTileAt(id, x, y);
      return;
    }
    const g = this.groundAt(x, y);
    if (g === GROUND.Void) {
      this.land.removeTileAt(x, y);
      return;
    }
    const m = this.mask(x, y, (nx, ny) => this.groundAt(nx, ny) !== GROUND.Void, true);
    const base = g === GROUND.Sand ? TILE_ID.sand : TILE_ID.grass;
    const full = g === GROUND.Sand ? TILE_ID.sandFull : TILE_ID.grassFull;
    const i = BLOB_INDEX[m] as number;
    const id = m === 255 ? (full[hash2(x, y) % 6] as number) : base + i;
    this.land.putTileAt(id, x, y);
  }

  private overlayTile(x: number, y: number): number {
    if (this.authored) return this.def.overlayTiles?.[y * this.def.w + x] ?? -1;
    const key = tileKey(x, y);
    const soil = this.loc.soil[key];
    if (soil) {
      const m = this.mask(x, y, (nx, ny) => !!this.loc.soil[tileKey(nx, ny)], false);
      return (soil.wet ? TILE_ID.soilWet : TILE_ID.soilDry) + (BLOB_INDEX[m] as number);
    }
    const o = this.overlayAt(x, y);
    if (o === OVERLAY.None) return -1;
    if (o === OVERLAY.Plank) {
      const m = this.mask(x, y, (nx, ny) => this.overlayAt(nx, ny) === OVERLAY.Plank, true);
      return TILE_ID.plank + (BLOB_INDEX[m] as number);
    }
    const m = this.mask(x, y, (nx, ny) => {
      const q = this.overlayAt(nx, ny);
      return q === OVERLAY.Path || q === OVERLAY.Cobble;
    }, true);
    return (o === OVERLAY.Path ? TILE_ID.path : TILE_ID.cobble) + (BLOB_INDEX[m] as number);
  }

  private paintOverlay(x: number, y: number): void {
    const id = this.overlayTile(x, y);
    if (id < 0) this.overlay.removeTileAt(x, y);
    else this.overlay.putTileAt(id, x, y);
  }

  /** Repaint soil tiles whose state changed, plus their neighbours, which may change shape. */
  refresh(keys: readonly string[]): void {
    const seen = new Set<string>();
    for (const k of keys) {
      const { x, y } = parseKey(k);
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const nx = x + i;
          const ny = y + j;
          const nk = tileKey(nx, ny);
          if (seen.has(nk) || nx < 0 || ny < 0 || nx >= this.def.w || ny >= this.def.h) continue;
          seen.add(nk);
          this.paintOverlay(nx, ny);
        }
      }
    }
  }

  repaintAll(): void {
    for (let y = 0; y < this.def.h; y++) for (let x = 0; x < this.def.w; x++) this.paintOverlay(x, y);
  }
}
