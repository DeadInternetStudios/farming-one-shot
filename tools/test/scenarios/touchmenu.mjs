// A phone has no keyboard: the menu must open and close from the glass alone, by tapping the bag button the way a thumb would.
//   node tools/test/probe.mjs tools/test/scenarios/touchmenu.mjs --touch --size 390x844 --dpr 3
// It never calls the test hook's `interact`, and never presses a key.
export default async ({ page, shot, wait, log, lh }) => {
  // where a UI object is on the screen, in CSS pixels
  const where = (frameStartsWith) =>
    page.evaluate((prefix) => {
      const game = window.__lh.game();
      const ui = game.scene.getScene('UI');
      const cam = ui.cameras.main;
      const dpr = window.devicePixelRatio || 1;
      const hit = ui.children.list.find((o) => o.visible && o.frame && String(o.frame.name).startsWith(prefix));
      if (!hit) return null;
      return { x: ((hit.x - cam.worldView.x) * cam.zoom) / dpr, y: ((hit.y - cam.worldView.y) * cam.zoom) / dpr };
    }, frameStartsWith);
  const paused = async () => (await lh('info')).paused;

  await wait(1500);
  await shot('touchmenu-0-play');
  const menu = await where('ui/menu-btn');
  if (!menu) throw new Error('there is no menu button on the touch screen');
  log('[probe] menu button at', Math.round(menu.x), Math.round(menu.y), 'css px');
  if (await paused()) throw new Error('the game starts paused');

  await page.touchscreen.tap(menu.x, menu.y);
  await wait(900);
  await shot('touchmenu-1-open');
  if (!(await paused())) throw new Error('tapping the bag button did not open the menu');
  log('[probe] the menu opened by touch');

  // the Options tab is the last of five at the top of the panel: find it by its icon
  const cog = await where('ui/tab-options');
  if (cog) {
    await page.touchscreen.tap(cog.x, cog.y);
    await wait(700);
    await shot('touchmenu-2-options');
    log('[probe] tapped Options');
  } else log('[probe] note: no Options tab icon found');

  // and out again, by the red close button
  const close = await where('ui/btn-berry');
  if (!close) throw new Error('there is no close button to tap');
  await page.touchscreen.tap(close.x, close.y);
  await wait(900);
  if (await paused()) throw new Error('the close button did not close the menu');
  log('[probe] the menu closed by touch');
  await shot('touchmenu-3-closed');
};
