import { BUNDLES } from '../data/bundles';
import { NPCS } from '../data/npcs';
import { litCount } from './bundles';
import { DAYS_PER_YEAR } from './clock';
import { friendOf } from './social';
import type { GameState } from './state';

/** The Lantern Festival ends the first year. The lanterns rise at eight, wherever you are by ten. */
export const FINALE_AT = 20 * 60;
export const FINALE_LATE = 22 * 60;

export const finaleDone = (st: GameState): boolean => typeof st.flags.finaleDay === 'number';

/** Whether the shrine should light up now. It waits for night, and for the player to be on the green. */
export function finaleDue(st: GameState, place: string): boolean {
  if (finaleDone(st) || st.day < DAYS_PER_YEAR || st.minute < FINALE_AT) return false;
  return place === 'village' || (st.day === DAYS_PER_YEAR && st.minute >= FINALE_LATE);
}

export interface FinaleReport {
  lit: number;
  title: string;
  lines: string[];
  rows: [string, string][];
}

function words(lit: number): { title: string; lines: string[] } {
  const total = BUNDLES.length;
  if (lit >= total) {
    return {
      title: 'Every lantern is lit',
      lines: ['From the hall to the hills, Lantern Hollow glows.', 'Olwen says it has not looked like this since before she was a girl.', 'The valley has you to thank.'],
    };
  }
  if (lit >= 4) {
    return {
      title: 'The valley is nearly bright',
      lines: [`${lit} lanterns shine tonight.`, `${total - lit} more are waiting for you, and there is a whole second year to light them.`],
    };
  }
  if (lit >= 1) {
    return {
      title: 'A good beginning',
      lines: [`${lit === 1 ? 'One lantern shines' : `${lit} lanterns shine`} tonight.`, 'Olwen says the old keepers began just this way: one flame, then another.'],
    };
  }
  return {
    title: 'The shrine is waiting',
    lines: ['Not one lantern yet. Olwen kept the festival anyway, and the valley is glad you came.', 'The lanterns will be here when you are ready.'],
  };
}

/** Everything the closing card says about the year. */
export function finaleReport(st: GameState): FinaleReport {
  const lit = litCount(st);
  const friends = NPCS.filter((n) => friendOf(st, n.id).met);
  const best = [...friends].sort((a, b) => friendOf(st, b.id).points - friendOf(st, a.id).points)[0];
  const rows: [string, string][] = [
    ['Days on the farm', String(st.day)],
    ['Gold earned', `${st.stats.earned}g`],
    ['Crops harvested', String(st.stats.harvested)],
    ['Fish caught', String(st.stats.caught)],
    ['Stones broken', String(st.stats.mined)],
    ['Friends made', `${friends.length} of ${NPCS.length}`],
  ];
  if (best) rows.push(['Best friend', best.name]);
  return { lit, ...words(lit), rows };
}

/** Remember that the festival happened, so it never plays twice. */
export function finishFinale(st: GameState): void {
  st.flags.finaleDay = st.day;
  st.flags.finaleLit = litCount(st);
}
