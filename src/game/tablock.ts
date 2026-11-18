/**
 * One farm, one tab. The save is a single slot in the browser, so two tabs playing would each overwrite the other's days.
 * A tab that is playing writes a claim every few seconds; a second tab sees it and asks before taking over,
 * and the first one, finding the claim is no longer its own, stops saving.
 */
const KEY = 'lantern-hollow:tab';
/** A claim older than this belongs to a tab that is gone or asleep. */
const STALE_MS = 6000;
const BEAT_MS = 2000;

const me = Math.random().toString(36).slice(2) + Date.now().toString(36);

interface Claim {
  id: string;
  t: number;
}

function read(): Claim | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Claim>;
    return typeof c.id === 'string' && typeof c.t === 'number' ? { id: c.id, t: c.t } : null;
  } catch {
    return null;
  }
}

function write(now: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: me, t: now }));
  } catch {
    /* no storage: there is no other tab to tell either */
  }
}

/** True when another tab is playing right now. */
export function otherTabOpen(now = Date.now()): boolean {
  const c = read();
  return c !== null && c.id !== me && now - c.t < STALE_MS;
}

/** True while no other tab has claimed the farm since this one did. */
export const holdsFarm = (): boolean => {
  const c = read();
  return c === null || c.id === me;
};

/** Takes the farm for this tab, and keeps saying so. `lost` runs once if another tab takes it. Returns a function that lets go. */
export function holdFarm(lost: () => void): () => void {
  write(Date.now());
  let over = false;
  const check = (): void => {
    if (over) return;
    if (!holdsFarm()) {
      over = true;
      stop();
      lost();
    }
  };
  const beat = window.setInterval(() => {
    check();
    if (!over) write(Date.now());
  }, BEAT_MS);
  const onStorage = (e: StorageEvent): void => { if (e.key === KEY) check(); };
  const onVisible = (): void => { if (!document.hidden) check(); };
  const release = (): void => {
    if (holdsFarm()) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* nothing to release */
      }
    }
  };
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pagehide', release);
  function stop(): void {
    window.clearInterval(beat);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pagehide', release);
  }
  return () => {
    stop();
    release();
  };
}
