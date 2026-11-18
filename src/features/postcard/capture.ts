import type Phaser from 'phaser';
import { getLayout } from '../../display';
import { session } from '../../game/session';
import { downloadBlob } from '../../systems/files';
import { Pen, composePostcard } from './compose';
import type { Lantern } from './compose';
import { dateParts, planCrop, postcardName, stampLantern } from './layout';

export interface Taken {
  canvas: HTMLCanvasElement;
  name: string;
}

/** The screen as it is right now, without the interface: hide it, let one frame draw, copy it, show it again. */
function grab(ui: Phaser.Scene): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const renderer = ui.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    let settled = false;
    const finish = (img: HTMLImageElement | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(giveUp);
      ui.scene.setVisible(true);
      resolve(img);
    };
    const giveUp = window.setTimeout(() => finish(null), 2500);
    ui.scene.setVisible(false);
    renderer.snapshot((shot) => finish(shot instanceof HTMLImageElement ? shot : null));
  });
}

interface FontData {
  chars: ConstructorParameters<typeof Pen>[0];
  lineHeight: number;
}

function makePen(scene: Phaser.Scene): Pen | null {
  const font = scene.cache.bitmapFont.get('hollow') as { data?: FontData } | undefined;
  const sheet = scene.textures.get('hollow').getSourceImage() as CanvasImageSource | undefined;
  return font?.data && sheet ? new Pen(font.data.chars, sheet, font.data.lineHeight) : null;
}

function lanternFor(scene: Phaser.Scene, day: number): Lantern | null {
  const f = scene.textures.getFrame('title', `lantern/${stampLantern(day)}`);
  return f ? { image: f.source.image as CanvasImageSource, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight } : null;
}

/** Takes the picture and builds the card. Null when the browser would not give the picture up. */
export async function takePostcard(ui: Phaser.Scene): Promise<Taken | null> {
  const pen = makePen(ui);
  if (!pen) return null;
  const st = session.state;
  const view = ui.scene.get('World').cameras.main.worldView;
  const fx = (st.player.x - view.x) / view.width;
  const fy = (st.player.y - 8 - view.y) / view.height;
  const shot = await grab(ui);
  if (!shot) return null;
  const crop = planCrop(shot.width, shot.height, getLayout().worldZoom, fx, fy);
  const canvas = composePostcard({ shot, crop, pen, lantern: lanternFor(ui, st.day), dateParts: dateParts(st.day, st.minute, st.weather) });
  return { canvas, name: postcardName(st.day) };
}

export function toFile(t: Taken): Promise<File | null> {
  return new Promise((resolve) => t.canvas.toBlob((b) => resolve(b ? new File([b], t.name, { type: 'image/png' }) : null), 'image/png'));
}

/** Gives the card away: the share sheet on a phone, a download anywhere else. Null when the player backs out. */
export async function sendPostcard(file: File, share: boolean): Promise<string | null> {
  if (share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cozy Farming Simulator MVP' });
      return 'Shared.';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
    }
  }
  downloadBlob(file.name, file);
  return 'Saved to your downloads.';
}
