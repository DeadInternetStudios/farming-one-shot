import { describe, expect, it } from 'vitest';
import { controlsLines } from '../src/ui/controlsText';
import { ITEMS } from '../src/data/items';
import { carryHint, chestHint, heldHint, swapHint } from '../src/ui/words';

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

  it('says to eat only what can be eaten, and names the key only for a keyboard', () => {
    const berry = { name: 'Wild Berries', energy: 10, sell: 20 };
    const stone = { name: 'Stone', sell: 2 };
    expect(heldHint(berry, false)).toBe('Wild Berries. Press F to eat it, or ship it from the bin.');
    expect(heldHint(berry, true)).toBe('Wild Berries. Open your bag to eat it, or ship it from the bin.');
    expect(heldHint(stone, true)).toBe('Stone. You can ship it from the bin.');
    expect(heldHint({ name: 'Keepsake', sell: 0 }, false)).toBe('Keepsake.');
    for (const def of Object.values(ITEMS)) {
      for (const touch of [true, false]) {
        const line = heldHint(def, touch);
        expect(/to eat it/.test(line)).toBe(Boolean(def.energy));
        if (touch) expect(line).not.toMatch(/\bPress\b/);
      }
    }
  });

  it('the phone page teaches hurrying and eating, which have no key to name', () => {
    const phone = controlsLines(true, true).join(' ');
    expect(phone).toMatch(/hurry/i);
    expect(phone).toMatch(/\beat\b/i);
  });
});
