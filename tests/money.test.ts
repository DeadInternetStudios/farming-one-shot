import { describe, expect, it } from 'vitest';
import { money } from '../src/ui/money';

describe('how gold is written on the screens', () => {
  it('shows every digit up to the last one that fits, and no commas', () => {
    expect(money(0)).toBe('0');
    expect(money(1850)).toBe('1850');
    expect(money(999_999)).toBe('999999');
  });

  it('turns a million or more into three figures and a letter', () => {
    expect(money(1_000_000)).toBe('1M');
    expect(money(1_234_567)).toBe('1.23M');
    expect(money(12_345_678)).toBe('12.3M');
    expect(money(99_999_999)).toBe('99.9M');
    expect(money(100_000_000)).toBe('100M');
    expect(money(2_500_000_000)).toBe('2.5B');
    expect(money(7e12)).toBe('7T');
  });

  it('never shows more than the player has', () => {
    for (const gold of [1_999_999, 9_999_999, 12_999_999, 99_999_999, 123_999_999]) {
      const written = money(gold);
      const scale = written.endsWith('M') ? 1e6 : 1e9;
      expect(Number.parseFloat(written) * scale).toBeLessThanOrEqual(gold);
    }
  });

  it('stays short enough for the gold chip however large the number gets', () => {
    for (let e = 6; e <= 15; e++) expect(money(10 ** e + 12345).length).toBeLessThanOrEqual(5);
  });

  it('does not write nonsense for a number that is not one', () => {
    expect(money(Number.NaN)).toBe('0');
    expect(money(-5)).toBe('0');
    expect(money(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
