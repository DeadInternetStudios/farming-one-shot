import { describe, expect, it } from 'vitest';
import { controlsLines } from '../src/ui/controlsText';
import { carryHint, chestHint, swapHint } from '../src/ui/words';

describe('instructions name the hand that is playing', () => {
  it('a finger taps and a mouse clicks, never the other way round', () => {
    for (const f of [swapHint, carryHint]) {
      expect(f(true)).toMatch(/tap/i);
      expect(f(true)).not.toMatch(/click|enter/i);
      expect(f(false)).toMatch(/click/i);
      expect(f(false)).not.toMatch(/\btap/i);
    }
    expect(chestHint(true, 'chest')).toBe('Tap to take it.');
    expect(chestHint(true, 'bag')).toBe('Tap to store it.');
    expect(chestHint(false, 'chest')).toBe('Click or press Enter to take it.');
    expect(chestHint(false, 'bag')).toBe('Click or press Enter to store it.');
  });

  it('the controls page lists keys for a keyboard and gestures for a phone, with no key names on glass', () => {
    const phone = controlsLines(true, true).join(' ');
    const desk = controlsLines(false, true).join(' ');
    expect(phone).toMatch(/drag/i);
    expect(phone).toMatch(/bag button/i);
    expect(phone).not.toMatch(/\b(WASD|Tab|Esc|Shift|Space)\b/);
    for (const key of ['WASD', 'Shift', 'Space', 'Tab', 'Esc', 'F eats']) expect(desk).toContain(key);
    expect(desk).toContain('P takes a postcard');
    expect(controlsLines(false, false).join(' ')).not.toContain('postcard');
  });
});
