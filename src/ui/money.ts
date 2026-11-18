const UNITS: readonly (readonly [number, string])[] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];

/**
 * Gold as the screens write it: every digit while it fits, then three figures and a letter (1.23M, 99.9M, 100M), so a number can never
 * grow out of its chip. It rounds down, so the screen never claims more than the player has.
 */
export function money(gold: number): string {
  const whole = Number.isFinite(gold) ? Math.max(0, Math.floor(gold)) : 0;
  for (const [size, letter] of UNITS) {
    if (whole < size) continue;
    const x = whole / size;
    const places = x >= 100 ? 0 : x >= 10 ? 1 : 2;
    const scale = 10 ** places;
    return `${(Math.floor(x * scale) / scale).toString()}${letter}`;
  }
  return String(whole);
}
