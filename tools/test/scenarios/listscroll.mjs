// A finger (or the mouse) dragging a long list should scroll it, and a plain tap should still pick a row.
//   node tools/test/probe.mjs tools/test/scenarios/listscroll.mjs --size 360x640 --dpr 2 --touch --out .100x/shots/listscroll
export default async ({ page, wait, shot, log }) => {
  const url = page.url().replace('&new=1', '').replace('&skip=1', '');
  await page.addInitScript({ path: 'tools/test/fixtures/midgame.js' });
  await page.goto(url, { waitUntil: 'load' });
  await wait(2600);
  await page.evaluate(() => { window.__lh.setMinute(600); window.__lh.interact({ kind: 'shop', id: 'store' }); });
  await wait(900);
  await shot('0-open');
  const x = 180;
  const drag = async (from, to) => {
    await page.mouse.move(x, from);
    await page.mouse.down();
    await page.mouse.move(x, (from + to) / 2, { steps: 4 });
    await page.mouse.move(x, to, { steps: 4 });
    await page.mouse.up();
    await wait(300);
  };
  await drag(215, 150);
  await shot('1-dragged-up');
  const gold = (await page.evaluate(() => window.__lh.state().player.gold));
  await drag(150, 215);
  await shot('2-dragged-back');
  const gold2 = (await page.evaluate(() => window.__lh.state().player.gold));
  log(`[probe] gold before ${gold} after ${gold2} (a drag must never buy anything)`);
  // a tap on the second row selects it, a second tap buys
  await drag(215, 150);
  await page.mouse.click(x, 215);
  await wait(300);
  await shot('3-tapped-once');
  log(`[probe] gold after one tap on an unselected row ${await page.evaluate(() => window.__lh.state().player.gold)} (a first tap only selects)`);
};
