import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'lantern-hollow:tab';

/** Just enough of a browser for the tab claim: storage, a clock, and the events it listens to. */
function browser() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const target = {
    addEventListener: (t: string, f: (e: unknown) => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t))?.add(f),
    removeEventListener: (t: string, f: (e: unknown) => void) => void listeners.get(t)?.delete(f),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { ...target, setInterval, clearInterval });
  vi.stubGlobal('document', { ...target, hidden: false });
  return {
    claim: () => JSON.parse(data.get(KEY) ?? 'null') as { id: string; t: number } | null,
    otherTabClaims: () => data.set(KEY, JSON.stringify({ id: 'other-tab', t: Date.now() })),
    fire: (type: string, e: unknown = {}) => listeners.get(type)?.forEach((f) => f(e)),
    listening: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
}

/** The module keeps this tab's id at load, so each test gets its own tab. */
async function freshTab() {
  vi.resetModules();
  return import('../src/game/tablock');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('one farm, one tab', () => {
  it('sees no other tab when nobody has claimed the farm', async () => {
    browser();
    const tab = await freshTab();
    expect(tab.otherTabOpen()).toBe(false);
    expect(tab.holdsFarm()).toBe(true);
  });

  it('sees another tab while its claim is fresh, and stops seeing it once the claim is 6 seconds old', async () => {
    const b = browser();
    const tab = await freshTab();
    b.otherTabClaims();
    expect(tab.otherTabOpen()).toBe(true);
    vi.advanceTimersByTime(5_900);
    expect(tab.otherTabOpen()).toBe(true);
    vi.advanceTimersByTime(200);
    expect(tab.otherTabOpen()).toBe(false);
  });

  it('does not count its own claim as another tab', async () => {
    const b = browser();
    const tab = await freshTab();
    tab.holdFarm(() => {});
    expect(b.claim()).not.toBeNull();
    expect(tab.otherTabOpen()).toBe(false);
  });

  it('keeps its claim fresh while it plays', async () => {
    const b = browser();
    const tab = await freshTab();
    tab.holdFarm(() => {});
    const first = b.claim()?.t ?? 0;
    vi.advanceTimersByTime(4_100);
    expect(b.claim()?.t ?? 0).toBeGreaterThan(first);
  });

  it('is told once when another tab takes the farm, and then stops writing over it', async () => {
    const b = browser();
    const tab = await freshTab();
    const lost = vi.fn();
    tab.holdFarm(lost);
    b.otherTabClaims();
    b.fire('storage', { key: KEY });
    b.fire('storage', { key: KEY });
    vi.advanceTimersByTime(10_000);
    expect(lost).toHaveBeenCalledTimes(1);
    expect(b.claim()?.id).toBe('other-tab');
    expect(b.listening()).toBe(0);
  });

  it('notices on its next heartbeat even if the storage event never arrives', async () => {
    const b = browser();
    const tab = await freshTab();
    const lost = vi.fn();
    tab.holdFarm(lost);
    b.otherTabClaims();
    vi.advanceTimersByTime(2_100);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('notices when the tab comes back to the front', async () => {
    const b = browser();
    const tab = await freshTab();
    const lost = vi.fn();
    tab.holdFarm(lost);
    b.otherTabClaims();
    b.fire('visibilitychange');
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('lets go of its claim on leaving, but never removes another tab\'s', async () => {
    const b = browser();
    const tab = await freshTab();
    const letGo = tab.holdFarm(() => {});
    letGo();
    expect(b.claim()).toBeNull();

    const again = tab.holdFarm(() => {});
    b.otherTabClaims();
    again();
    expect(b.claim()?.id).toBe('other-tab');
  });
});
