/**
 * The zoom for a room: as large as the screen allows, but never so large that more than two of the room's tiles in either direction
 * fall off the edge. The open-air zoom is the most it may take; a tall phone gets a smaller one, so the room is seen whole instead of cut mid-rug.
 */
export function roomZoom(devW: number, devH: number, tilesW: number, tilesH: number, openAir: number): number {
  const whole = Math.max(1, Math.floor(Math.min(devW / (tilesW * 16), devH / (tilesH * 16))));
  let zoom = Math.max(openAir, whole);
  while (zoom > whole && (devW / (zoom * 16) < tilesW - 2 || devH / (zoom * 16) < tilesH - 2)) zoom -= 1;
  return zoom;
}
