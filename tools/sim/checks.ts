// The money check: plays the farm with three kinds of farmer on the game's own rules and fails when the economy
// could dead-end, run away, stall or lose a save. `npm run check:economy` prints one line per check and exits 1 on any FAIL.
// A `defect` puts one known bug into the rules first, to show that each kind of break is caught.
import { CROP_LIST, ITEMS } from '../../src/data/items';
import { TOOL_UPGRADES, UPGRADES, storeStock } from '../../src/data/shops';
import { PACE_REAL_MINUTES, DAYS_PER_SEASON } from '../../src/game/clock';
import { spawnForage } from '../../src/game/day';
import { cropProfit } from '../../src/game/farming';
import { rngFor } from '../../src/game/rng';
import { loadGame, saveGame } from '../../src/game/save';
import { buyPrice } from '../../src/game/shop';
import { locationFromMap, newGame } from '../../src/game/state';
import { SEASONS } from '../../src/game/types';
import { buildMap } from '../../src/world/maps/registry';
import { PROFILES, playFarm } from './farmer';
import type { Run } from './farmer';

export const DEFECTS = ['none', 'nan-price', 'windfall', 'no-forage'] as const;
export type Defect = (typeof DEFECTS)[number];

export interface Result {
  ok: boolean;
  name: string;
  detail: string;
}

export interface Report {
  results: Result[];
  table: string[];
}

const SEEDS = [1, 2, 3];
const MINUTES_PER_DAY = PACE_REAL_MINUTES.standard;

/** The most a first goal may take, and the window the dearest goal must land in, in days. */
const FIRST_GOAL_BY = 6;
const LAST_GOAL_WITHIN = [8, 21] as const;
/** The longest a crop that pays may take to ripen, so that every season has a payday close by, in days. */
const QUICK_CROP_DAYS = 4;
/** How many of the cheapest seeds a farmer with nothing can pay for from one visit to the forest. */
const RESCUE_SEEDS = 20;

const mutable = ITEMS as Record<string, (typeof ITEMS)[string]>;

function putInDefect(defect: Defect): void {
  if (defect === 'nan-price') (mutable.radish as { sell: number }).sell = Number.NaN;
  if (defect === 'windfall') for (const c of CROP_LIST) (mutable[c.id] as { sell: number }).sell *= 4;
  if (defect === 'no-forage') for (const id of ['flower', 'mushroom', 'berry']) (mutable[id] as { sell: number }).sell = 0;
}

interface Goal {
  name: string;
  price: number;
}

/** What the money is for, read from the shops so the list cannot drift away from the prices. */
function goals(): Goal[] {
  const upgrades = UPGRADES.map((u) => ({ name: u.name, price: u.price }));
  const tools = Object.entries(TOOL_UPGRADES).map(([tier, t]) => ({ name: `${tier} tools`, price: t.gold }));
  return [...upgrades, ...tools].sort((a, b) => a.price - b.price);
}

const dayOf = (run: Run, price: number): number | undefined => run.days.find((r) => r.gold >= price)?.day;
const minutes = (day: number): number => Math.round(day * MINUTES_PER_DAY);

function allFinite(value: unknown, path: string, bad: string[]): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) bad.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => allFinite(v, `${path}[${i}]`, bad));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) allFinite(v, `${path}.${k}`, bad);
  }
}

function memoryStore(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

export function runChecks(defect: Defect = 'none'): Report {
  putInDefect(defect);
  const results: Result[] = [];
  const check = (ok: boolean, name: string, detail: string): void => { results.push({ ok, name, detail }); };

  const runs: Run[] = [];
  for (const seed of SEEDS) for (const p of Object.values(PROFILES)) runs.push(playFarm(p, 28, seed));
  const dayCount = runs.reduce((a, r) => a + r.days.length, 0);

  // 1. no number in the game may turn into NaN or Infinity: JSON turns them into null, and a save would lose them
  const bad: string[] = [];
  for (const [i, run] of runs.entries()) {
    allFinite(run.days, `run${i}.days`, bad);
    allFinite(run.state, `run${i}.state`, bad);
  }
  check(bad.length === 0, 'every number stays a real number', bad.length === 0 ? `${runs.length} farms, ${dayCount} days, every gold, earning and spending finite` : `${bad.length} bad numbers, first at ${bad[0]}`);

  // 2. the ledger balances on every day
  let off = 0;
  for (const run of runs) {
    let gold = 500;
    for (const r of run.days) {
      gold += r.earned - r.spent;
      if (r.gold !== gold) off += 1;
    }
  }
  check(off === 0, 'the ledger balances', off === 0 ? `gold equals earned minus spent on all ${dayCount} days` : `${off} of ${dayCount} days are off`);

  // 3. the first thing worth saving for comes inside the first minutes
  const list = goals();
  const first = list[0] as Goal;
  const firstDays = runs.map((r) => dayOf(r, first.price));
  const bestFirst = Math.min(...firstDays.map((d) => d ?? Infinity));
  const worstFirst = firstDays.some((d) => d === undefined) ? Infinity : Math.max(...(firstDays as number[]));
  const when = (d: number): string => (d === Infinity ? 'never' : `day ${d}`);
  check(worstFirst <= FIRST_GOAL_BY, 'the first goal is close', `${first.name} (${first.price}g): ${when(bestFirst)} at best, ${when(worstFirst)} at worst${worstFirst === Infinity ? '' : `, about ${minutes(worstFirst)} minutes of play at the standard pace`}; the limit is day ${FIRST_GOAL_BY}`);

  // 4. the goals arrive like a curve: dearer later, never a cliff, never a wall
  let order = true;
  const lastGoal = list[list.length - 1] as Goal;
  const lastDays = runs.map((r) => dayOf(r, lastGoal.price));
  for (const run of runs) {
    let prev = 0;
    for (const g of list) {
      const d = dayOf(run, g.price) ?? Infinity;
      if (d < prev) order = false;
      prev = d;
    }
  }
  const lastEarly = Math.min(...lastDays.map((d) => d ?? Infinity));
  const lastLate = lastDays.some((d) => d === undefined) ? Infinity : Math.max(...(lastDays as number[]));
  check(order && lastEarly >= LAST_GOAL_WITHIN[0] && lastLate <= LAST_GOAL_WITHIN[1], 'the goals come like a curve', `${lastGoal.name} (${lastGoal.price}g) lands ${lastEarly === lastLate ? when(lastLate) : `${when(lastEarly)} to ${when(lastLate)}`}; the window is day ${LAST_GOAL_WITHIN[0]} to ${LAST_GOAL_WITHIN[1]}${order ? '' : '; a dearer goal came before a cheaper one'}`);

  // 5. the first week is a start and not a windfall
  const steady = playFarm(PROFILES.steady as NonNullable<typeof PROFILES.steady>, 28, 1);
  const week = steady.days.slice(0, 7).reduce((a, r) => a + r.earned, 0);
  check(week > 1200 && week < 4500, 'the first week is a start, not a windfall', `a steady farmer earns ${week}g in seven days; the window is 1200g to 4500g`);

  // 6. every season that has a store has a crop that pays within a few days, and no farmer is ever broke with nothing growing
  const quick: string[] = [];
  let slowest = 0;
  for (const [i, season] of SEASONS.entries()) {
    if (season === 'winter') continue;
    const day = i * DAYS_PER_SEASON + 1;
    const fast = CROP_LIST.filter((c) => c.seasons.includes(season) && cropProfit(c.id, day) > 0).sort((a, b) => a.days - b.days)[0];
    slowest = Math.max(slowest, fast?.days ?? Infinity);
    quick.push(fast ? `${season}: ${fast.name} in ${fast.days} days` : `${season}: nothing that pays`);
  }
  let stuck = 0;
  for (const run of runs) for (const r of run.days) if (r.gold < 10 && r.tiles === 0) stuck += 1;
  check(slowest <= QUICK_CROP_DAYS && stuck === 0, 'there is always a payday close by', `${quick.join('; ')}; the limit is ${QUICK_CROP_DAYS} days; days broke with nothing growing: ${stuck} of ${dayCount}`);

  // 7. a farmer with no gold, no seeds and no crops can always get going again: the forest pays for seeds
  const rescue: string[] = [];
  let weakest = Infinity;
  for (const [i, season] of SEASONS.entries()) {
    const st = newGame(1);
    st.day = i * DAYS_PER_SEASON + 1;
    const seeds = storeStock(season, {}).filter((id) => id.startsWith('seed-'));
    if (seeds.length === 0) { rescue.push(`${season}: no seeds in the store, the way forward is the next spring`); continue; }
    const cheapest = Math.min(...seeds.map((id) => buyPrice(id)));
    const forest = buildMap('forest', st);
    const l = locationFromMap(forest.objects);
    st.locations.forest = l;
    spawnForage(st, forest, rngFor(st.seed, st.day, 6));
    let free = 0;
    for (const o of Object.values(l.objects)) {
      const id = o.k === 'berries' ? 'berry' : o.k === 'mushroom' ? 'mushroom' : o.k === 'flower' ? 'flower' : '';
      if (id) free += (ITEMS[id]?.sell ?? 0) * (o.k === 'berries' ? 2 : 1);
    }
    const seedsWorth = Math.floor(free / cheapest);
    weakest = Math.min(weakest, seedsWorth);
    rescue.push(`${season}: ${free}g picked = ${seedsWorth} seeds at ${cheapest}g`);
  }
  check(weakest >= RESCUE_SEEDS, 'a broke farmer can start over', `${rescue.join('; ')}; the least is ${weakest === Infinity ? 'none' : weakest} seeds, the limit is ${RESCUE_SEEDS}`);

  // 8. a save gives back the farm that went in, and a damaged one gives back nothing rather than half a farm
  const store = memoryStore();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
  const farm = (runs[runs.length - 1] as Run).state;
  const saved = saveGame(farm);
  const back = loadGame();
  const same = saved && back !== null && JSON.stringify(back) === JSON.stringify(JSON.parse(JSON.stringify(farm)));
  const raw = store.getItem('lantern-hollow:save:v1') ?? '';
  store.setItem('lantern-hollow:save:v1', raw.slice(0, Math.floor(raw.length / 2)));
  const cut = loadGame();
  store.setItem('lantern-hollow:save:v1', '{"version":');
  const junk = loadGame();
  check(Boolean(same) && cut === null && junk === null, 'a save keeps the farm and a damaged one is refused', `${raw.length} bytes saved and read back ${same ? 'exactly' : 'differently'}; half a save reads as ${cut === null ? 'nothing' : 'a farm'}, broken text as ${junk === null ? 'nothing' : 'a farm'}`);

  // the table of what the money buys, by day, for the three farmers
  const names = Object.keys(PROFILES);
  const firstSeed = names.map((n) => playFarm(PROFILES[n] as NonNullable<(typeof PROFILES)[string]>, 28, 1));
  const table: string[] = [];
  table.push(`${'goal'.padEnd(16)}${'price'.padStart(6)}${names.map((n) => `  ${n}`.padEnd(20)).join('')}`);
  for (const g of list) {
    const cells = firstSeed.map((run) => {
      const d = dayOf(run, g.price);
      return (d === undefined ? '  never' : `  day ${String(d).padStart(2)}, ${String(minutes(d)).padStart(3)} min`).padEnd(20);
    });
    table.push(`${g.name.padEnd(16)}${String(g.price).padStart(5)}g${cells.join('')}`);
  }
  return { results, table };
}
