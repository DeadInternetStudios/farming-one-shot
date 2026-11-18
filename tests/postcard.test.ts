import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/display';
import { MARGIN, STAMP, dateParts, fitLine, planCard, planCrop, postcardName, stampLantern } from '../src/features/postcard/layout';

const SCREENS: ReadonlyArray<readonly [string, number, number, number]> = [
  ['laptop', 1440, 900, 2],
  ['desktop', 1920, 1080, 1],
  ['small window', 960, 600, 1],
  ['phone upright', 390, 844, 3],
  ['phone sideways', 844, 390, 3],
  ['small phone', 320, 568, 2],
  ['tablet', 820, 1180, 2],
  ['ultrawide', 3440, 1440, 1],
];

describe('the postcard photo', () => {
  for (const [name, w, h, dpr] of SCREENS) {
    const l = computeLayout(w, h, dpr, dpr > 1);
    it(`is a whole-pixel 3:2 picture inside the screen: ${name}`, () => {
      for (const [fx, fy] of [[0.5, 0.5], [0, 0], [1, 1], [0.1, 0.9], [-1, 2]] as const) {
        const c = planCrop(l.devW, l.devH, l.worldZoom, fx, fy);
        expect(c.cw * 2).toBe(c.ch * 3);
        expect(Number.isInteger(c.cw) && Number.isInteger(c.ch)).toBe(true);
        expect(c.sw).toBe(c.cw * l.worldZoom);
        expect(c.sh).toBe(c.ch * l.worldZoom);
        expect(c.sx).toBeGreaterThanOrEqual(0);
        expect(c.sy).toBeGreaterThanOrEqual(0);
        expect(c.sx + c.sw).toBeLessThanOrEqual(l.devW);
        expect(c.sy + c.sh).toBeLessThanOrEqual(l.devH);
      }
    });

    it(`takes as much of the screen as a 3:2 picture can: ${name}`, () => {
      const c = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.5);
      const artW = Math.floor(l.devW / l.worldZoom);
      const artH = Math.floor(l.devH / l.worldZoom);
      expect(c.cw).toBeLessThanOrEqual(artW);
      expect(c.ch).toBeLessThanOrEqual(artH);
      expect(c.cw).toBeGreaterThan(Math.min(artW, artH * 1.5) - 3);
    });
  }

  it('is centred on the farmer when there is room, and slides back to the edge when there is not', () => {
    const l = computeLayout(1920, 1080, 1, false);
    const mid = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.5);
    expect(mid.sx + mid.sw / 2).toBeCloseTo(l.devW / 2, -1);
    const left = planCrop(l.devW, l.devH, l.worldZoom, 0.05, 0.5);
    expect(left.sx).toBe(0);
    const right = planCrop(l.devW, l.devH, l.worldZoom, 0.95, 0.5);
    expect(right.sx + right.sw).toBe(l.devW);
  });

  it('can follow the farmer up and down on a tall screen', () => {
    const l = computeLayout(390, 844, 3, true);
    const top = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.2);
    const low = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.8);
    expect(low.sy).toBeGreaterThan(top.sy);
  });
});

describe('the card', () => {
  for (const [name, w, h, dpr] of SCREENS) {
    const l = computeLayout(w, h, dpr, dpr > 1);
    it(`keeps the photo, words and stamp apart on the paper: ${name}`, () => {
      const c = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.5);
      const p = planCard(c.cw, c.ch);
      expect(Number.isInteger(p.k) && p.k >= 1).toBe(true);
      expect(p.px + c.cw + MARGIN).toBe(p.w);
      expect(p.textY).toBeGreaterThanOrEqual(p.py + c.ch);
      expect(p.stamp.x).toBeGreaterThanOrEqual(MARGIN + p.textW);
      expect(p.stamp.x + STAMP.w + MARGIN).toBe(p.w);
      expect(p.stamp.y + STAMP.h + MARGIN).toBeLessThanOrEqual(p.h);
      expect(p.textW).toBeGreaterThan(80);
    });
  }

  it('makes the picture big enough to be worth sharing, but not huge', () => {
    for (const [, w, h, dpr] of SCREENS) {
      const l = computeLayout(w, h, dpr, dpr > 1);
      const c = planCrop(l.devW, l.devH, l.worldZoom, 0.5, 0.5);
      const p = planCard(c.cw, c.ch);
      expect(p.w * p.k).toBeGreaterThanOrEqual(700);
      expect(p.w * p.k).toBeLessThanOrEqual(1250);
    }
  });

  it('uses the big greeting only where "Lantern Hollow" fits twice as wide', () => {
    expect(planCard(300, 200).bigTitle).toBe(true);
    expect(planCard(165, 110).bigTitle).toBe(false);
  });
});

describe('the words', () => {
  const width = (s: string): number => s.length * 6;

  it('writes the date the way the game does', () => {
    expect(dateParts(5, 21 * 60 + 40, 'rain')).toEqual(['Spring 5', '9:40 pm', 'rainy']);
    expect(dateParts(28, 6 * 60, 'snow')).toEqual(['Winter 7', '6:00 am', 'snowy']);
  });

  it('calls a dry night clear and a dry day sunny', () => {
    expect(dateParts(5, 12 * 60, 'sun')[2]).toBe('sunny');
    expect(dateParts(5, 22 * 60, 'sun')[2]).toBe('clear');
    expect(dateParts(5, 22 * 60, 'rain')[2]).toBe('rainy');
  });

  it('keeps as many pieces as fit and always keeps the first', () => {
    const parts = ['Spring 5', '9:40 pm', 'rainy'];
    expect(fitLine(parts, width, 500)).toBe('Spring 5, 9:40 pm, rainy');
    expect(fitLine(parts, width, 110)).toBe('Spring 5, 9:40 pm');
    expect(fitLine(parts, width, 1)).toBe('Spring 5');
  });

  it('names the file after the day, so cards do not overwrite each other', () => {
    expect(postcardName(5)).toBe('cozy-farming-simulator-mvp-spring-5.png');
    expect(postcardName(22)).toBe('cozy-farming-simulator-mvp-winter-1.png');
    expect(new Set([1, 2, 3, 4, 5, 6, 7].map(postcardName)).size).toBe(7);
  });

  it('changes the lantern on the stamp from day to day', () => {
    expect(new Set([1, 2, 3].map(stampLantern)).size).toBe(3);
    expect(stampLantern(4)).toBe(stampLantern(1));
  });
});
