/**
 * What the Help and about card says: which build this is, where the farm lives, and who to tell when something breaks.
 * Short lines, each one thing, because a phone held sideways shows this card a few lines at a time.
 */
export function helpLines(version: string, support: string): string[] {
  return [
    `Cozy Farming Simulator MVP ${version}.`,
    'Your farm is kept in this browser only.',
    'There is no account, and nothing is sent anywhere.',
    'Clearing site data or changing browser can lose it.',
    'A phone browser left alone for a long while can too.',
    'Back up your farm now and then.',
    support ? `Need help? Write to ${support}.` : 'If something goes wrong, say which version this is.',
    ...(support ? ['Say which version this is.'] : []),
  ];
}
