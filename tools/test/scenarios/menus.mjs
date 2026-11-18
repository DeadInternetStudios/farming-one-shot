// Opens every pop-up on the mid-game save and photographs it. Run it at each size you care about:
//   node tools/test/probe.mjs tools/test/scenarios/menus.mjs --size 360x640 --dpr 2 --touch --out .100x/shots/menus-360
// Set ONLY=shop,chest to take some of them, and FIXTURE=lategame for the save with 99,999,999 gold and the widest totals.
export default async ({ page, wait, shot, press, log }) => {
  const url = page.url().replace('&new=1', '').replace('&skip=1', '');
  await page.addInitScript({ path: `tools/test/fixtures/${process.env.FIXTURE ?? 'midgame'}.js` });
  await page.goto(url, { waitUntil: 'load' });
  await wait(2600);
  await page.evaluate(() => window.__lh.setMinute(600));
  await wait(400);
  const open = (what) => page.evaluate((w) => window.__lh.interact(w), what);
  const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
  const want = (n) => only.length === 0 || only.includes(n);
  const run = async (name, what, after) => {
    if (!want(name)) return;
    await open(what);
    await wait(700);
    if (after) await after();
    await shot(name);
    await press('Escape');
    await wait(350);
  };
  for (const tab of ['bag', 'craft', 'bundles', 'friends', 'options']) await run(`menu-${tab}`, { kind: 'menu', tab });
  await run('shop-buy', { kind: 'shop', id: 'store' });
  await run('shop-sell', { kind: 'shop', id: 'store' }, async () => { await press('ArrowRight'); await press('ArrowRight'); await press('ArrowRight'); await wait(400); });
  await run('shrine', { kind: 'shrine' });
  await run('stove', { kind: 'cook' });
  await run('board', { kind: 'board' });
  await run('chest', { kind: 'chest', loc: 'farm', key: '3,3' });
  await run('talk', { kind: 'talk', id: 'mirren' }, async () => { await wait(2600); });
  if (want('bed')) {
    await page.evaluate(() => window.__lh.emit('ask-sleep'));
    await wait(600);
    await shot('bed');
    await press('Escape');
    await wait(300);
  }
  if (want('sign')) {
    await page.evaluate(() => window.__lh.emit('dialog', 'Lantern Hollow. Mind the geese, and welcome. Fresh seeds are sold at the store each morning.'));
    await wait(600);
    await shot('sign');
    await press('Escape');
    await wait(300);
  }
  log('[probe] done');
};
