import Phaser from 'phaser';

/**
 * Drives the main camera so the view always starts on a whole world pixel. With a whole-number
 * zoom that keeps every sprite and tile sharp and the light map exactly lined up.
 */
export class CameraRig {
  /** Top left of the view in world pixels, always whole numbers. */
  vx = 0;
  vy = 0;
  private fx = 0;
  private fy = 0;
  private mapW = 0;
  private mapH = 0;

  constructor(readonly cam: Phaser.Cameras.Scene2D.Camera) {
    cam.setRoundPixels(true);
  }

  get viewW(): number {
    return this.cam.width / this.cam.zoom;
  }
  get viewH(): number {
    return this.cam.height / this.cam.zoom;
  }

  setMap(w: number, h: number): void {
    this.mapW = w;
    this.mapH = h;
  }

  /** Where the view top left wants to be to centre on a point, kept inside the map. */
  private target(x: number, y: number): { x: number; y: number } {
    const dw = this.viewW;
    const dh = this.viewH;
    const clamp = (v: number, size: number, view: number): number => (size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v)));
    return { x: clamp(x - dw / 2, this.mapW, dw), y: clamp(y - dh / 2, this.mapH, dh) };
  }

  snapTo(x: number, y: number): void {
    const t = this.target(x, y);
    this.fx = t.x;
    this.fy = t.y;
    this.apply();
  }

  update(dt: number, x: number, y: number): void {
    const t = this.target(x, y);
    const k = 1 - Math.exp(-dt * 7);
    this.fx += (t.x - this.fx) * k;
    this.fy += (t.y - this.fy) * k;
    this.apply();
  }

  private apply(): void {
    this.vx = Math.round(this.fx);
    this.vy = Math.round(this.fy);
    const cam = this.cam;
    cam.scrollX = this.vx - (cam.width - this.viewW) / 2;
    cam.scrollY = this.vy - (cam.height - this.viewH) / 2;
  }
}
