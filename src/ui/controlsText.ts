/** Every input the game takes, for the device in the player's hands: what the Controls page shows, and what a screen reader is told. */
export function controlsLines(touch: boolean, postcard: boolean): string[] {
  return touch
    ? [
        'Drag on the left of the screen to walk. Drag past the ring to hurry.',
        'The big button uses what is in your hand: dig, water, plant, talk, open a door.',
        'The bag button opens your bag, crafting, friends and these options.',
        'Tap a slot at the bottom to pick a tool or item.',
        'Tap a tile next to you to use your tool there.',
        'To eat, open your bag, tap the food and tap Eat.',
      ]
    : [
        'Arrow keys or WASD walk. Hold Shift to hurry.',
        'E, Space or Enter use what is in your hand, talk, or open a door.',
        '1 to 0, Q and R, or the mouse wheel pick a tool or item. Clicking a slot works too.',
        'Click a tile next to you to use your tool there.',
        'F eats the food you are holding.',
        'Tab or Esc opens your bag and these options.',
        ...(postcard ? ['P takes a postcard.'] : []),
      ];
}
