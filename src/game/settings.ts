export interface Settings {
  music: number;
  sfx: number;
  /** Shake the screen a little on big moments. */
  shake: boolean;
}

const KEY = 'lantern-hollow:settings';
const DEFAULTS: Settings = { music: 0.6, sfx: 0.8, shake: true };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = read();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private browsing: settings just last for this visit
  }
}
