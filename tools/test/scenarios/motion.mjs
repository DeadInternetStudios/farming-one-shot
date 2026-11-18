// Films the interface motion in slow motion and shoots the states that have a designed look:
// hover, empty, refused. Frames are written as open-a/b/c (a pop-up easing in), tab-a/b/c (a page easing in after a tab switch),
// hover-row, empty-sell, refusal and board.
//   PORT=53868 node tools/test/probe.mjs tools/test/scenarios/motion.mjs --size 390x844 --dpr 3 --touch --out /tmp/motion
// A screenshot takes a good part of a second, so the tweens run at a fiftieth of speed: a pop-up's 200 ms becomes ten seconds.
// The motion eases out, so most of it happens early: the second shot is taken soon after the first to catch it half-way.
const SLOW = 0.02;

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
  const speed = (k) => page.evaluate((s) => { window.__lh.game().scene.getScene('UI').tweens.timeScale = s; }, k);

  // the states, on a fresh game where money is short
  await wait(1500);
  await page.evaluate(() => window.__lh.setMinute(600));
  await wait(300);
  await page.evaluate(() => window.__lh.interact({ kind: 'shop', id: 'store' }));
  await wait(500);
  const row = await where('Potato Seeds');
  if (row) { await page.mouse.move(row.x, row.y); await wait(200); }
  await shot('hover-row');
  // nothing in the bag the store would buy: the Sell page has to say so
  await page.evaluate(() => { const slots = window.__lh.state().player.slots; slots.forEach((_, i) => { slots[i] = null; }); });
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

  // the motion, on the mid-game save
  await page.addInitScript({ path: 'tools/test/fixtures/midgame.js' });
  await page.goto(url.replace('&new=1', '').replace('&skip=1', ''), { waitUntil: 'load' });
  await wait(2600);
  await page.evaluate(() => window.__lh.setMinute(600));
  await speed(SLOW);
  await page.evaluate(() => window.__lh.interact({ kind: 'shop', id: 'store' }));
  await shot('open-a');
  await wait(1200); await shot('open-b');
  await wait(3500); await shot('open-c');
  await speed(1);
  await wait(800);
  await speed(SLOW);
  await page.keyboard.press('ArrowRight');
  await shot('tab-a');
  await wait(700); await shot('tab-b');
  await wait(2200); await shot('tab-c');
  await speed(1);
  log('[probe] done');
};
