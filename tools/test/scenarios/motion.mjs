// Films the interface motion in slow motion (a tenth of speed) and shoots the states that have a designed look:
// hover, empty, refused. Frames are written as open-a/b/c (a pop-up easing in), tab-a/b/c (a page easing in after a tab switch),
// hover-row, empty-sell, refusal and board.
//   PORT=53868 node tools/test/probe.mjs tools/test/scenarios/motion.mjs --size 390x844 --dpr 3 --touch --out /tmp/motion
export default async ({ page, wait, shot, log }) => {
  const url = page.url();
  const where = (text) => page.evaluate((t) => {
    const g = window.__lh.game();
    const scene = g.scene.getScene('UI');
    const hits = scene.children.list.filter((o) => o.type === 'BitmapText' && o.text === t && o.visible && o.active);
    const o = hits[hits.length - 1];
    if (!o) return null;
    const k = scene.cameras.main.zoom * g.scale.zoom;
    const b = o.getBounds();
    return { x: (b.x + b.width / 2) * k, y: (b.y + b.height / 2) * k };
  }, text);

  // the states, on a fresh game where nothing is for sale yet and money is short
  await wait(1500);
  await page.evaluate(() => window.__lh.setMinute(600));
  await wait(300);
  await page.evaluate(() => window.__lh.interact({ kind: 'shop', id: 'store' }));
  await wait(500);
  const row = await where('Potato Seeds');
  if (row) { await page.mouse.move(row.x, row.y); await wait(200); }
  await shot('hover-row');
  await page.keyboard.press('ArrowLeft');
  await wait(500);
  await shot('empty-sell');
  await page.keyboard.press('ArrowRight');
  await wait(300);
  await page.keyboard.press('ArrowRight');
  await wait(500);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await wait(200);
  await page.keyboard.press('Enter');
  await wait(450);
  await shot('refusal');
  await page.keyboard.press('Escape');
  await wait(400);
  await page.evaluate(() => window.__lh.interact({ kind: 'board' }));
  await wait(500);
  await shot('board');
  await page.keyboard.press('Escape');
  await wait(400);

  // the motion, on the mid-game save, at a tenth of speed
  await page.addInitScript({ path: 'tools/test/fixtures/midgame.js' });
  await page.goto(url.replace('&new=1', '').replace('&skip=1', ''), { waitUntil: 'load' });
  await wait(2600);
  await page.evaluate(() => { window.__lh.setMinute(600); window.__lh.game().scene.getScene('UI').tweens.timeScale = 0.1; });
  await page.evaluate(() => window.__lh.interact({ kind: 'shop', id: 'store' }));
  await wait(120); await shot('open-a');
  await wait(500); await shot('open-b');
  await wait(1800); await shot('open-c');
  await page.keyboard.press('ArrowRight');
  await wait(60); await shot('tab-a');
  await wait(500); await shot('tab-b');
  await wait(1500); await shot('tab-c');
  await page.evaluate(() => { window.__lh.game().scene.getScene('UI').tweens.timeScale = 1; });
  log('[probe] done');
};
