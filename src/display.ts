import type Phaser from 'phaser';

/**
 * The canvas is measured in device pixels (CSS size x pixel ratio) and shown at 1/ratio, so one
 * canvas pixel is one screen pixel. The world and the interface each get a whole-number zoom,
 * so every art pixel is the same size on screen and nothing shimmers.
 */
export interface Layout {
  dpr: number;
  cssW: number;
  cssH: number;
  devW: number;
  devH: number;
  /** Device pixels per world pixel. */
  worldZoom: number;
  /** Device pixels per interface pixel. */
  uiZoom: number;
  /** Interface size in interface pixels. */
  uiW: number;
  uiH: number;
  touch: boolean;
}

export function computeLayout(cssW: number, cssH: number, dpr: number, touch: boolean): Layout {
  const devW = Math.max(1, Math.round(cssW * dpr));
  const devH = Math.max(1, Math.round(cssH * dpr));
  const cssShort = Math.min(cssW, cssH);
  const devShort = Math.min(devW, devH);
  const tilesShort = cssShort < 520 ? 11 : cssShort < 800 ? 13 : 15;
  const worldZoom = Math.max(1, Math.round(devShort / tilesShort / 16));
  const cssPerUi = cssShort >= 800 ? 3 : 2;
  const uiZoom = Math.max(1, Math.round(cssPerUi * dpr));
  return { dpr, cssW, cssH, devW, devH, worldZoom, uiZoom, uiW: Math.floor(devW / uiZoom), uiH: Math.floor(devH / uiZoom), touch };
}

/** A fingertip needs about this many CSS pixels. */
const FINGER = 44;

/** Height of anything you press, in interface pixels: 17 for a pointer, enough for a fingertip on touch. */
export const tapH = (l: Layout): number => (l.touch ? Math.max(17, Math.ceil(FINGER / (l.uiZoom / l.dpr))) : 17);

/** The distance between slot cells in a grid: a 20 px slot plus a gap, roomier for fingers. */
export const slotPitch = (l: Layout): number => (l.touch ? Math.max(21, Math.ceil(FINGER / (l.uiZoom / l.dpr))) : 21);

let current: Layout = computeLayout(960, 600, 1, false);
export const getLayout = (): Layout => current;

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0) && window.matchMedia('(pointer: coarse)').matches;

export function measure(parent: HTMLElement): Layout {
  const r = parent.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return computeLayout(Math.max(1, r.width), Math.max(1, r.height), dpr, isTouchDevice());
}

/** Keeps the canvas matched to its parent. Emits `layout` on the game's event emitter. */
export function installLayout(game: Phaser.Game, parent: HTMLElement): void {
  const apply = (): void => {
    const next = measure(parent);
    const same = next.devW === current.devW && next.devH === current.devH && next.dpr === current.dpr;
    current = next;
    if (!same) {
      // size first, then zoom: with no scale mode Phaser only writes the canvas's CSS size when the zoom is set,
      // and where the pixel ratio is 1 `resize` never writes it, so zooming first left the canvas at its old size
      game.scale.resize(next.devW, next.devH);
      game.scale.setZoom(1 / next.dpr);
    }
    game.events.emit('layout', next);
  };
  new ResizeObserver(apply).observe(parent);
  window.addEventListener('orientationchange', () => window.setTimeout(apply, 200));
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', apply);
  current = measure(parent);
}

/** Zoom a camera so interface coordinates start at the top left. */
export function fitUiCamera(cam: Phaser.Cameras.Scene2D.Camera, l: Layout): void {
  cam.setSize(l.devW, l.devH);
  cam.setZoom(l.uiZoom);
  cam.setScroll(-(l.devW - l.devW / l.uiZoom) / 2, -(l.devH - l.devH / l.uiZoom) / 2);
}
