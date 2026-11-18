// The farm lives in one browser slot, so a second tab must ask before taking it, and the first must stop saving afterwards.
//   node tools/test/probe.mjs tools/test/scenarios/twotabs.mjs   (takes about 40 seconds: it waits for two autosaves)
export default async ({ page, shot, wait, log }) => {
  const KEY = 'lantern-hollow:save:v1';
  const origin = new URL(page.url()).origin;
  await wait(16500);
  if (!(await page.evaluate((k) => localStorage.getItem(k) !== null, KEY))) throw new Error('the first tab never saved');

  const b = await page.context().newPage();
  b.on('pageerror', (e) => log('[probe] second tab pageerror', e.message));
  await b.goto(`${origin}/?mute=1&debug=1`, { waitUntil: 'load' });
  await b.waitForTimeout(1800);
  await b.keyboard.press('Enter');
  await b.waitForTimeout(800);
  await b.screenshot({ path: '.100x/shots/probe/twotabs-ask.png' });
  const inWorld = () => b.evaluate(() => typeof window.__lh !== 'undefined');
  if (await inWorld()) throw new Error('the second tab went straight into the farm without asking');
  log('[probe] second tab is asking first (twotabs-ask.png)');

  // "Play here" is the left answer; the safe one, Cancel, is where the cursor starts
  await b.keyboard.press('ArrowLeft');
  await b.keyboard.press('Enter');
  await b.waitForTimeout(3500);
  if (!(await inWorld())) throw new Error('the second tab did not open the farm after "Play here"');
  await shot('twotabs-first-locked');

  // the first tab must now refuse to write over the second
  await page.evaluate(() => { window.__lh.state().player.gold = 424242; });
  await wait(16500);
  const stored = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const overwrote = stored?.includes('424242') ?? false;
  log("[probe] first tab wrote its gold over the second tab's farm:", overwrote);
  if (overwrote) throw new Error('the first tab kept saving after another tab took the farm');
  await b.close();
};
