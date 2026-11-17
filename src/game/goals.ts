import { BUNDLES } from '../data/bundles';
import { allLit, isComplete } from './bundles';
import { dayOfSeason, seasonOf } from './clock';
import { FESTIVALS, FESTIVAL_NAMES, festivalToday } from '../data/festivals';
import { enteredToday } from './festival';
import { cropDef, isRipe } from './farming';
import { FINALE_AT, finaleDone } from './finale';
import { countItem } from './inventory';
import type { GameState } from './state';

/** One short line that tells the player what is worth doing next. */
export interface Goal {
  id: string;
  text: string;
}

const farmPlots = (st: GameState) => Object.values(st.locations.farm?.soil ?? {});
const metCount = (st: GameState): number => Object.values(st.social).filter((f) => f.met).length;
const hasMet = (st: GameState, id: string): boolean => st.social[id]?.met === true;

/**
 * What to do next, in order of importance. The first few steps teach the day: dig, plant, water, sleep, harvest, ship.
 * After that the goals widen out into the village, the woods, the lake, the mine and the lanterns.
 */
export function nextGoal(st: GameState): Goal | null {
  const plots = farmPlots(st);
  const planted = plots.some((p) => p.crop && !p.crop.dead);
  const dry = plots.some((p) => p.crop && !p.crop.dead && !p.wet);
  const ripe = plots.some((p) => p.crop && isRipe(p.crop));
  const first = st.stats.harvested === 0;
  const season = seasonOf(st.day);
  const gift = (id: string, text: string): Goal => ({ id, text });

  // the festival comes first when it is today, and a nudge the day before
  const today = festivalToday(st.day);
  if (today === 'lantern') {
    if (!finaleDone(st)) return gift('festival-today', st.minute < FINALE_AT - 120 ? 'The Lantern Festival is tonight' : 'Be at the shrine when the lanterns rise');
  } else if (today) {
    const fair = FESTIVALS[today];
    if (st.minute < fair.to && !enteredToday(st)) return gift('festival-today', st.minute < fair.from ? `${fair.name} opens at 10 in the village` : `${fair.name} is on in the village`);
  }
  const tomorrow = festivalToday(st.day + 1);
  if (tomorrow && st.minute >= 17 * 60) return gift('festival-eve', `${FESTIVAL_NAMES[tomorrow]} is tomorrow`);
  if (st.day > 28 && !finaleDone(st)) return gift('finale-late', 'Olwen is waiting at the shrine after dark');

  // on the last day of a season, whatever cannot live through the next one is about to wither
  const nextSeason = seasonOf(st.day + 1);
  if (dayOfSeason(st.day) === 7 && plots.some((p) => p.crop && !p.crop.dead && !cropDef(p.crop.id).seasons.includes(nextSeason))) {
    return gift('season-end', `${season.charAt(0).toUpperCase()}${season.slice(1)} ends tonight. Harvest what you can`);
  }

  if (!st.flags.outside) return gift('door', 'Step outside');
  if (first) {
    if (plots.length === 0) return gift('dig', 'Dig a patch of soil with the hoe');
    if (!planted && !ripe) return gift('plant', 'Plant your seeds in the soil');
    if (dry) return gift('water', 'Water your seeds with the can');
    if (st.day === 1) return st.minute < 17 * 60 ? gift('clear', 'Clear weeds, rocks and trees') : gift('sleep', 'Sleep in your bed to grow the crops');
  }
  if (ripe) return gift('harvest', 'Harvest the ripe crops');
  if (st.stats.harvested > 0 && st.stats.shipped === 0) return gift('ship', 'Ship a crop in the bin near home');
  if (dry) return gift('water', 'Water your crops');
  if (!hasMet(st, 'mirren')) return gift('village', 'Walk east to the village');
  if (metCount(st) < 4) return gift('meet', `Say hello to the villagers (${metCount(st)} of 6)`);
  if (!st.flags.shrineSeen) return gift('shrine', 'Look at the shrine in the village');
  if (!hasMet(st, 'tam') && countItem(st.player.slots, 'rod') === 0 && st.stats.caught === 0) return gift('tam', 'Find Old Tam at the lake');
  if (st.deepest === 0 && st.day >= 3) return gift('wood', 'Explore the woods north of the farm');
  if (!planted && st.day > 1) return gift('replant', `Plant ${season === 'winter' ? 'something for spring' : 'a new crop'}`);

  const open = BUNDLES.filter((b) => !isComplete(st, b));
  const seasonal = open.find((b) => b.id === season) ?? open[0];
  if (seasonal && !allLit(st)) return gift('lantern', `Fill the ${seasonal.name}`);
  if (allLit(st)) return gift('finale', st.day < 28 ? 'All lanterns lit! Festival: Winter 7' : 'All lanterns lit. Enjoy the valley');
  return null;
}
