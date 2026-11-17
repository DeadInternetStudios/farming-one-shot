/**
 * Makes the game installable and playable with no connection.
 * One call to `startOffline()` in main.ts turns it on. To cut it, delete that call, this folder,
 * `public/sw.js`, `public/manifest.webmanifest` and the manifest and icon lines in index.html.
 */
export const PWA_ON = true;

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let waiting: InstallPrompt | null = null;

export function startOffline(): void {
  if (!PWA_ON) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    waiting = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => { waiting = null; });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => whenLoaded(() => {
        const seen = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ remember: [location.href, ...seen] });
      }))
      .catch(() => undefined);
  });
}

/** Waits until the game has stopped asking for files, then runs `then`. Gives up waiting after about a minute. */
function whenLoaded(then: () => void): void {
  let last = -1;
  let tries = 0;
  const look = (): void => {
    const n = performance.getEntriesByType('resource').length;
    if (n === last || ++tries > 30) then();
    else { last = n; setTimeout(look, 2000); }
  };
  look();
}

/** True when the browser is holding an install offer we can show from a button. */
export const canInstall = (): boolean => PWA_ON && waiting !== null;

/** Whether the game is already running as an installed app. */
export function isInstalled(): boolean {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export async function install(): Promise<boolean> {
  if (!waiting) return false;
  const offer = waiting;
  waiting = null;
  await offer.prompt();
  return (await offer.userChoice).outcome === 'accepted';
}
