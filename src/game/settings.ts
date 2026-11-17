export interface Settings {
  music: number;
  sfx: number;
  /** Shake the screen a little on big moments. */
  shake: boolean;
  /** Fewer drifting specks, no flickering flames, no lightning flashes, no shake. Starts on when the device asks for reduced motion. */
  calm: boolean;
  /** Touch controls the other way round: the stick on the right, the action button on the left. */
  lefty: boolean;
}

const KEY = 'lantern-hollow:settings';

const deviceWantsCalm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function defaults(): Settings {
  return { music: 0.6, sfx: 0.8, shake: true, calm: deviceWantsCalm(), lefty: false };
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaults();
  }
}

export const settings: Settings = read();

/** Whether the camera may shake: only when asked for, and never in calm mode. */
export const shakeOn = (): boolean => settings.shake && !settings.calm;

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private browsing: settings just last for this visit
  }
}
