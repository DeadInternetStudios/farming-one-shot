import { describe, expect, it } from 'vitest';
import { keyLine, learn, learned, teaching } from '../src/game/teach';

const farm = (day = 1, flags: Record<string, boolean> = {}) => ({ day, flags });

describe('teaching the first minute', () => {
  it('says all three things on a new farm, in the order a player needs them', () => {
    expect(keyLine(farm())).toBe('Arrows or WASD to walk  -  E or Space to use  -  Tab for your bag');
  });

  it('drops each part once it has been done', () => {
    const st = farm();
    learn(st, 'walk');
    expect(keyLine(st)).toBe('E or Space to use  -  Tab for your bag');
    learn(st, 'use');
    expect(keyLine(st)).toBe('Tab for your bag');
    learn(st, 'menu');
    expect(keyLine(st)).toBe('');
  });

  it('remembers in the farm itself, so a reload does not start the hints again', () => {
    const st = farm();
    learn(st, 'use');
    const reloaded = farm(1, JSON.parse(JSON.stringify(st.flags)));
    expect(learned(reloaded, 'use')).toBe(true);
    expect(teaching(reloaded, 'use')).toBe(false);
  });

  it('stays quiet for a farm that is already well along, whatever its notes say', () => {
    expect(keyLine(farm(4))).toBe('');
    expect(keyLine(farm(20))).toBe('');
    expect(teaching(farm(3), 'walk')).toBe(true);
    expect(teaching(farm(4), 'walk')).toBe(false);
  });
});
