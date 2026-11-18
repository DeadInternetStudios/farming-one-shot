import { DAYS_PER_YEAR } from '../game/clock';
import { CROPS } from './items';
import type { ItemDef } from './items';
import type { Stop } from './npcs';

export type FestivalId = 'blossom' | 'sunfair' | 'harvest' | 'lantern';
export type Place = 'first' | 'second' | 'third' | 'entrant';

export interface Contest {
  title: string;
  /** What Mirren says when you step up to the stall. */
  invite: string;
  /** The heading above the list of things you can enter. */
  ask: string;
  accepts(item: ItemDef): boolean;
  /** The sell value an entry needs for first, second and third place. */
  marks: readonly [number, number, number];
  /** Something extra for a good entry. */
  bonus?: { from: Place; flag?: string; item?: { id: string; n: number }; text: string };
}

export interface FestivalDef {
  id: FestivalId;
  name: string;
  /** Opening and closing time, in minutes since midnight. */
  from: number;
  to: number;
  /** What Mirren says when there is nothing to enter. */
  stall: string;
  contest?: Contest;
  /** What each villager says to you while the fair is on. */
  talk: Readonly<Record<string, string>>;
}

const H = 60;

export const FESTIVALS: Readonly<Record<FestivalId, FestivalDef>> = {
  blossom: {
    id: 'blossom', name: 'Blossom Fair', from: 10 * H, to: 20 * H,
    stall: 'The judges have gone to lunch. Come back later.',
    contest: {
      title: 'The Spring Show',
      invite: 'The Spring Show! Enter your best flower or spring crop and the judges will do their worst. They are my cousins, so be kind.',
      ask: 'Enter a flower or a spring crop',
      accepts: (i) => i.id === 'flower' || (i.kind === 'crop' && (CROPS[i.id]?.seasons.includes('spring') ?? false)),
      marks: [150, 70, 40],
      bonus: { from: 'entrant', flag: 'festival-strawberry', text: 'The judges loved the show so much they left a crate of strawberry seeds at the store.' },
    },
    talk: {
      mirren: 'Do not bribe the judges. Pie is not a bribe. Pie is a courtesy.',
      bram: 'Too many petals. They get in the forge. Ida made me wear a flower. It stays.',
      ida: 'I baked since four this morning. Blossom cake, by the slice. Have two.',
      tam: 'Spring bites softly. Good day for a long sit and a short sentence.',
      wren: 'Petals make the best confetti. I have been collecting them since sunrise.',
      olwen: 'Spring is when the shrine hums. Put your ear to the stone. Go on.',
    },
  },
  sunfair: {
    id: 'sunfair', name: 'Sun Fair', from: 10 * H, to: 20 * H,
    stall: 'The scale is resting. Come back when the sun is lower.',
    contest: {
      title: 'The Fishing Derby',
      invite: 'The Fishing Derby! Hand me your best catch and we will weigh it on the honest scale. The one that got away does not count.',
      ask: 'Enter a fish',
      accepts: (i) => i.kind === 'fish',
      marks: [140, 90, 55],
      bonus: { from: 'first', item: { id: 'gem-aquamarine', n: 1 }, text: 'Tam presses a chip of lake-blue stone into your hand. "From the water. To the winner."' },
    },
    talk: {
      mirren: 'Sun Fair! I am selling shade by the hour. It is going very well.',
      bram: 'Hot. Loud. Everyone is glad. I stood in the shade for an hour and enjoyed it.',
      ida: 'Cold soup and lemon ice. Eat before the sun gets to them.',
      tam: 'The Derby is mine every year. Some say the lake lets me win. The lake is a gentleman.',
      wren: 'Look at the water. Someone spilled the sky in it.',
      olwen: 'Long days are for long remembering. Sit in the light a while.',
    },
  },
  harvest: {
    id: 'harvest', name: 'Harvest Fair', from: 10 * H, to: 20 * H,
    stall: 'Stallholders are clearing the table. The judges are sleeping it off.',
    contest: {
      title: 'The Grand Harvest Table',
      invite: 'The Grand Harvest Table! Any crop or home-cooked dish. The judges are hungry, so something filling helps.',
      ask: 'Enter a crop or a dish',
      accepts: (i) => i.kind === 'crop' || i.id.startsWith('dish-'),
      marks: [280, 150, 85],
      bonus: { from: 'first', item: { id: 'goldBar', n: 1 }, text: 'The grain guild sends a bar of gold, wrapped in a ribbon.' },
    },
    talk: {
      mirren: 'I pretend not to have favourite pumpkins. I have favourite pumpkins.',
      bram: 'Pumpkins the size of anvils. I would not drop one on a foot.',
      ida: 'Eight pies since dawn. I will cry if they are not finished by dusk.',
      tam: 'Good year. Lake is full, nets are full, and so am I.',
      wren: 'The leaves are falling in the best order. Orange, then orange, then orange.',
      olwen: 'Autumn counts what the year gave. Bring your harvest. The valley says thank you.',
    },
  },
  lantern: {
    id: 'lantern', name: 'Lantern Festival', from: 10 * H, to: 25 * H,
    stall: 'Tonight the shrine takes the stage. The lanterns rise at eight, here on the green. Find a good spot.',
    talk: {
      mirren: 'After dark, the shrine. Stand close. You will want to see it.',
      bram: 'I polished the lamp posts. Twice. Do not tell anyone.',
      ida: 'Tea for everyone, hot and sweet. It is going to be a cold, clear night.',
      tam: 'I have seen this valley dark. I would like to see it bright once more.',
      wren: 'Everyone is looking up already. I looked at the stars first.',
      olwen: 'Soon. When the sky is fully dark, we light them together.',
    },
  },
};

export const FESTIVAL_DAYS: Readonly<Record<number, FestivalId>> = { 7: 'blossom', 14: 'sunfair', 21: 'harvest', 28: 'lantern' };
export const FESTIVAL_NAMES: Readonly<Record<string, string>> = Object.fromEntries(Object.values(FESTIVALS).map((f) => [f.id, f.name]));

/** The fair held on this day of the year, if there is one. Each falls on the last day of its season. */
export function festivalToday(day: number): FestivalId | null {
  return FESTIVAL_DAYS[((day - 1) % DAYS_PER_YEAR) + 1] ?? null;
}

export const isFestivalDay = (day: number): boolean => festivalToday(day) !== null;

/** The fair that is open right now, if there is one. */
export function festivalOpen(day: number, minute: number): FestivalDef | null {
  const id = festivalToday(day);
  const f = id ? FESTIVALS[id] : null;
  return f && minute >= f.from && minute < f.to ? f : null;
}

/** Where everyone stands on the green while a fair is on. */
const SPOTS: Readonly<Record<string, Omit<Stop, 'from' | 'map'>>> = {
  mirren: { x: 19, y: 16, dir: 'left' },
  olwen: { x: 20, y: 15, dir: 'right' },
  ida: { x: 27, y: 17, dir: 'left' },
  bram: { x: 28, y: 18, dir: 'right' },
  tam: { x: 21, y: 19, dir: 'right' },
  wren: { x: 23, y: 21, dir: 'up' },
};

/** Where a villager stands when the whole valley has gathered on the green. */
export function gatherSpot(npcId: string): Stop | null {
  const spot = SPOTS[npcId];
  return spot ? { from: 0, map: 'village', ...spot } : null;
}

export function festivalSpot(npcId: string, day: number, minute: number): Stop | null {
  const fest = festivalOpen(day, minute);
  const spot = gatherSpot(npcId);
  return fest && spot ? { ...spot, from: fest.from } : null;
}
