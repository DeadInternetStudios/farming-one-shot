import { describe, expect, it } from 'vitest';
import { computeLayout, slotPitch, tapH } from '../src/display';

/** The screens the game is checked on: [css width, css height, pixel ratio, touch]. */
const SCREENS: [string, number, number, number, boolean][] = [
  ['phone', 390, 844, 3, true],
  ['small phone', 360, 640, 2, true],
  ['phone on its side', 844, 390, 3, true],
  ['small phone on its side', 640, 360, 2, true],
  ['smallest phone', 320, 568, 2, true],
  ['smallest phone on its side', 568, 320, 2, true],
  ['folded phone', 280, 653, 3, true],
  ['folded phone on its side', 653, 280, 3, true],
  ['tablet', 820, 1180, 2, true],
  ['laptop', 1440, 900, 1, false],
  ['big monitor', 1920, 1080, 1, false],
];

/** Screen pixels one interface pixel covers. */
const cssPerUi = (w: number, h: number, dpr: number, touch: boolean): number => {
  const l = computeLayout(w, h, dpr, touch);
  return l.uiZoom / l.dpr;
};

describe('touch targets', () => {
  for (const [name, w, h, dpr, touch] of SCREENS) {
    const l = computeLayout(w, h, dpr, touch);

    it(`${name}: buttons are as tall as a fingertip on touch and plain on a pointer`, () => {
      const px = tapH(l) * cssPerUi(w, h, dpr, touch);
      if (touch) expect(px).toBeGreaterThanOrEqual(44);
      else expect(tapH(l)).toBe(17);
    });

    it(`${name}: grid cells are as large as a fingertip on touch and plain on a pointer`, () => {
      const px = slotPitch(l) * cssPerUi(w, h, dpr, touch);
      if (touch) expect(px).toBeGreaterThanOrEqual(44);
      else expect(slotPitch(l)).toBe(21);
    });

    it(`${name}: the interface is wide and tall enough for a pop-up`, () => {
      expect(l.uiW).toBeGreaterThanOrEqual(180);
      expect(l.uiH).toBeGreaterThanOrEqual(180);
    });
  }

  it('never grows a button past what a fingertip needs', () => {
    for (const [, w, h, dpr, touch] of SCREENS) {
      const l = computeLayout(w, h, dpr, touch);
      if (tapH(l) === 17) continue;
      expect((tapH(l) - 1) * cssPerUi(w, h, dpr, touch)).toBeLessThan(44);
    }
  });
});
