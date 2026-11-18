/** Instructions that name the thing the player's hand is on: a finger taps, a mouse clicks. One place, so no screen speaks for the wrong device. */

export const swapHint = (touch: boolean): string =>
  touch ? 'Tap a stack, then another slot to swap them.' : 'Click a stack, then another slot, to swap them. Enter works too.';

export const carryHint = (touch: boolean): string => (touch ? 'Now tap where it goes.' : 'Now click where it goes.');

/** A chest slot says what a press on it does: the chest gives it to the bag, the bag gives it to the chest. */
export const chestHint = (touch: boolean, from: 'chest' | 'bag'): string => {
  const verb = from === 'chest' ? 'take it' : 'store it';
  return touch ? `Tap to ${verb}.` : `Click or press Enter to ${verb}.`;
};
