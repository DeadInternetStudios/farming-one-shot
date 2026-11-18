// Presses the real buttons of the store with a finger (or the mouse) and checks that the money moves.
//   node tools/test/probe.mjs tools/test/scenarios/tapbuy.mjs --size 390x844 --dpr 3 --touch --out .100x/shots/tapbuy
export default async ({ page, wait, shot, log }) => {
  if (!process.env.FRESH) {
    const url = page.url().replace('&new=1', '').replace('&skip=1', '');
    await page.addInitScript({ path: 'tools/test/fixtures/midgame.js' });
    await page.goto(url, { waitUntil: 'load' });
    await wait(2600);
  }
  await page.evaluate(() => { window.__lh.setMinute(600); window.__lh.interact({ kind: 'shop', id: 'store' }); });
  await wait(900);

  const touch = await page.evaluate(() => 'ontouchstart' in window);
  const where = (text, nth = 'last') => page.evaluate(([t, which]) => {
    const g = window.__lh.game();
    const ui = g.scene.getScene('UI');
    const hits = ui.children.list.filter((o) => o.type === 'BitmapText' && o.text === t && o.visible && o.active);
    const o = which === 'first' ? hits[0] : hits[hits.length - 1];
    if (!o) return null;
    const k = ui.cameras.main.zoom * g.scale.zoom;
    const b = o.getBounds();
    return { x: (b.x + b.width / 2) * k, y: (b.y + b.height / 2) * k };
  }, [text, nth]);
  const tap = async (text, nth) => {
    const at = await where(text, nth);
    if (!at) { log(`[probe] no "${text}" on screen`); return false; }
    if (touch) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await wait(350);
    return true;
  };
  const gold = () => page.evaluate(() => window.__lh.state().player.gold);
  const count = (id) => page.evaluate((want) => window.__lh.state().player.slots.reduce((a, s) => a + (s && s.id === want ? s.n : 0), 0), id);

  const g0 = await gold();
  const seeds0 = await count('seed-tomato');
  await shot('0-open');
  const pressed = await tap('Buy', 'last');
  const g1 = await gold();
  log(`[probe] Buy pressed ${pressed}: gold ${g0} -> ${g1}, tomato seeds ${seeds0} -> ${await count('seed-tomato')}`);
  await shot('1-bought');
  await tap('Buy 5');
  const g2 = await gold();
  log(`[probe] Buy 5 pressed: gold ${g1} -> ${g2}`);
  await tap('Sell', 'first');
  await shot('2-sell-tab');
  await tap('Sell 1');
  const g3 = await gold();
  log(`[probe] Sell 1 pressed: gold ${g2} -> ${g3}`);
  await shot('3-sold');
};
