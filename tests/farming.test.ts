import { describe, expect, it } from 'vitest';
import { CROP_STAGES } from '../src/gen/art';
import { CROP_LIST } from '../src/data/items';
import {
  applyRain, canPlant, cropFrame, cropStage, cropStageCount, growOvernight, harvest, plant, till, untill,
  waterSoil, waterTiles, witherOutOfSeason,
} from '../src/game/farming';
import type { SoilMap } from '../src/game/farming';
import { mulberry32 } from '../src/game/rng';

const K = '3,4';
const fresh = (): SoilMap => ({});

describe('crop art and data agree', () => {
  it('every crop has the number of growth frames the game expects', () => {
    for (const c of CROP_LIST) expect(CROP_STAGES[c.id], c.id).toBe(cropStageCount(c));
  });
});

describe('planting', () => {
  it('needs tilled soil, an empty tile and the right season', () => {
    const soils = fresh();
    expect(canPlant(undefined, 'radish', 'spring', false)).toBe('no-soil');
    till(soils, K);
    expect(canPlant(soils[K], 'radish', 'summer', false)).toBe('wrong-season');
    expect(canPlant(soils[K], 'radish', 'summer', true)).toBe('ok');
    plant(soils, K, 'radish');
    expect(canPlant(soils[K], 'radish', 'spring', false)).toBe('occupied');
  });

  it('untilling only works on empty soil', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish');
    expect(untill(soils, K)).toBe(false);
    delete soils[K]!.crop;
    expect(untill(soils, K)).toBe(true);
  });
});

describe('growth', () => {
  it('grows only when watered, and ripens on the crop day count', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish'); // 3 days
    growOvernight(soils);
    expect(soils[K]!.crop!.age).toBe(0);
    for (let d = 0; d < 3; d++) {
      soils[K]!.wet = true;
      growOvernight(soils);
    }
    expect(soils[K]!.crop!.age).toBe(3);
    expect(cropFrame(soils[K]!.crop!)).toBe('crop/radish/3');
  });

  it('rain waters everything', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish');
    applyRain(soils);
    growOvernight(soils);
    expect(soils[K]!.crop!.age).toBe(1);
  });

  it('never shows the ripe frame before the crop is ripe', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'melon');
    const def = 6;
    for (let d = 0; d < def - 1; d++) {
      soils[K]!.wet = true;
      growOvernight(soils);
      expect(cropStage(soils[K]!.crop!)).toBeLessThan(cropStageCount({ days: def } as never) - 1);
    }
  });

  it('crops that grow back return to growing after a harvest', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'tomato'); // 4 days, regrow 2
    for (let d = 0; d < 4; d++) {
      soils[K]!.wet = true;
      growOvernight(soils);
    }
    const first = harvest(soils, K, mulberry32(1));
    expect(first).toEqual({ id: 'tomato', n: 1 });
    expect(soils[K]!.crop).toBeDefined();
    expect(cropFrame(soils[K]!.crop!)).toBe('crop/tomato/regrow');
    for (let d = 0; d < 2; d++) {
      soils[K]!.wet = true;
      growOvernight(soils);
    }
    expect(harvest(soils, K, mulberry32(1))).toEqual({ id: 'tomato', n: 1 });
  });

  it('single harvest crops leave the soil empty', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish');
    for (let d = 0; d < 3; d++) {
      soils[K]!.wet = true;
      growOvernight(soils);
    }
    expect(harvest(soils, K, mulberry32(1))).toEqual({ id: 'radish', n: 1 });
    expect(soils[K]!.crop).toBeUndefined();
  });

  it('cannot harvest an unripe crop', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish');
    expect(harvest(soils, K, mulberry32(1))).toBeNull();
  });
});

describe('seasons', () => {
  it('crops that cannot live in the new season wither', () => {
    const soils = fresh();
    till(soils, K);
    plant(soils, K, 'radish');
    till(soils, '5,5');
    plant(soils, '5,5', 'corn');
    expect(witherOutOfSeason(soils, 'summer')).toBe(1);
    expect(soils[K]!.crop!.dead).toBe(true);
    expect(soils['5,5']!.crop!.dead).toBe(false);
    expect(cropFrame(soils[K]!.crop!)).toBe('crop/radish/dead');
  });
});

describe('watering', () => {
  it('waters only tilled tiles and spends one water each', () => {
    const soils = fresh();
    till(soils, '1,1');
    till(soils, '2,1');
    const tiles = waterTiles({ x: 1, y: 1 }, 'right', 'copper');
    expect(tiles).toHaveLength(3);
    const r = waterSoil(soils, tiles, 10);
    expect(r.used).toBe(2);
    expect(soils['1,1']!.wet && soils['2,1']!.wet).toBe(true);
  });

  it('stops when the can runs dry', () => {
    const soils = fresh();
    for (let x = 0; x < 5; x++) till(soils, `${x},0`);
    const tiles = waterTiles({ x: 0, y: 0 }, 'right', 'gold');
    expect(waterSoil(soils, tiles, 2).used).toBe(2);
  });
});
