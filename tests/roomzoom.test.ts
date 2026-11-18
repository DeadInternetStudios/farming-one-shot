import { describe, expect, it } from 'vitest';
import { roomZoom } from '../src/systems/roomZoom';

// the house is 16 x 11 tiles; the open-air zoom is what the same screen would use outdoors
describe('how big a room is drawn', () => {
  it('shows a tall phone nearly the whole room instead of cutting it mid-rug', () => {
    // 390 x 844 at 3x: outdoors this is 7, which would show only 10 of the room's 16 tiles across
    expect(roomZoom(1170, 2532, 16, 11, 7)).toBe(5);
  });

  it('keeps a phone on its side as large as it was', () => {
    expect(roomZoom(2532, 1170, 16, 11, 7)).toBe(7);
  });

  it('grows the room on a big screen, as before', () => {
    expect(roomZoom(1280, 720, 16, 11, 3)).toBe(4);
    expect(roomZoom(1920, 1080, 16, 11, 5)).toBe(6);
  });

  it('never loses more than two tiles each way unless the whole room fits at a smaller size', () => {
    for (const [w, h, open] of [[640, 1136, 4], [750, 1334, 5], [1170, 2532, 7], [1080, 2400, 6], [1284, 2778, 7], [320, 568, 2], [1440, 900, 3]] as const) {
      const z = roomZoom(w, h, 16, 11, open);
      const whole = Math.max(1, Math.floor(Math.min(w / 256, h / 176)));
      expect(z).toBeGreaterThanOrEqual(whole);
      expect(z).toBeLessThanOrEqual(Math.max(open, whole));
      if (z > whole) {
        expect(w / (z * 16)).toBeGreaterThanOrEqual(16 - 2);
        expect(h / (z * 16)).toBeGreaterThanOrEqual(11 - 2);
      }
    }
  });
});
