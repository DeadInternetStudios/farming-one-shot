import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { controlsLines } from '../src/ui/controlsText';
import { helpLines } from '../src/ui/helpText';
import { SUPPORT, versionLabel } from '../src/version';

describe('the help card', () => {
  it('names the build, so a report can say which one broke', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(versionLabel().startsWith(`v${version}`)).toBe(true);
    expect(helpLines(versionLabel(), '')[0]).toContain(versionLabel());
  });

  it('says where the farm lives and how to keep it safe, in words for any device', () => {
    const text = helpLines('v1.0.0', '').join(' ');
    expect(text).toMatch(/this browser only/i);
    expect(text).toMatch(/nothing is sent anywhere/i);
    expect(text).toMatch(/back up your farm/i);
    expect(text).not.toMatch(/\b(Tab|Esc|click|tap)\b/i);
  });

  it('keeps every line short enough to fit a page of the card on a phone held sideways', () => {
    for (const line of [...helpLines(versionLabel(), 'someone@example.com'), ...controlsLines(true, true), ...controlsLines(false, true)]) expect(line.length).toBeLessThanOrEqual(90);
  });

  it('prints an address only when someone has given one', () => {
    expect(helpLines('v1', '').join(' ')).not.toMatch(/write to/i);
    expect(helpLines('v1', 'help@example.com').join(' ')).toContain('Write to help@example.com');
    expect(SUPPORT).toBe('');
  });
});
