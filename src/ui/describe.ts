import { dayOfSeason, seasonOf } from '../game/clock';
import type { GameState } from '../game/state';
import { money } from './money';

const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;

/** A farm in a few words, so that a choice between two of them says which is which: "Day 3 of Summer, 2468g". */
export const describeFarm = (st: GameState): string => `Day ${dayOfSeason(st.day)} of ${SEASON_NAMES[seasonOf(st.day)]}, ${money(st.player.gold)}g`;
