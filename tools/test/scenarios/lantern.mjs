// Gives a bundle to the shrine, closes the pop-up and films the lantern coming on (slow: a third of speed).
//   PORT=53868 node tools/test/probe.mjs tools/test/scenarios/lantern.mjs --size 844x390 --dpr 3 --touch --out /tmp/lantern
export default async ({ page, wait, shot, log }) => {
  await wait(1500);
  await page.evaluate(() => {
    const lh = window.__lh;
    lh.setMinute(1100);
    for (const [id, n] of [['radish', 2], ['potato', 2], ['cauliflower', 1], ['tulip', 2]]) lh.give(id, n);
    lh.go('village', 24, 18, 'up');
  });
  await wait(1200);
  const lit = () => page.evaluate(() => window.__lh.state().bundles.spring?.every((n, i) => n >= [2, 2, 1, 2][i]) ?? false);
  await page.evaluate(() => window.__lh.interact({ kind: 'shrine' }));
  await wait(500);
  await shot('0-shrine');
  await page.keyboard.press('Enter');
  await wait(500);
  await shot('1-given');
  log(`[probe] bundle complete: ${await lit()}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const w = window.__lh.game().scene.getScene('World'); w.tweens.timeScale = 0.35; w.time.timeScale = 0.35; });
  for (const [name, ms] of [['2-closed', 250], ['3-bloom-a', 500], ['4-bloom-b', 700], ['5-bloom-c', 900], ['6-after', 1500]]) {
    await wait(ms);
    await shot(name);
  }
  await page.evaluate(() => { const w = window.__lh.game().scene.getScene('World'); w.tweens.timeScale = 1; w.time.timeScale = 1; });
  log('[probe] done');
};
