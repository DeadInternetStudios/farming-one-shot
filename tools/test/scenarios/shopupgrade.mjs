// Buy a farm upgrade through the real shop window, the same way a player does, and check what changed.
export default async ({ lh, page, press, wait, shot, state, log }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await page.evaluate(() => { window.__lh.state().player.gold = 700; });
  await lh('setMinute', 10 * 60 + 5);
  await lh('go', 'village', 3, 12, 'right');
  await wait(900);
  await lh('teleport', 6, 11, 'up');
  await wait(300);
  await press('e', 300);
  await wait(800);
  await press('ArrowRight', 200); // the Farm tab
  await wait(400);
  await shot('shopup-1-farm-tab');
  const before = await state();
  await press('e', 300); // the first thing on the list
  await wait(500);
  await shot('shopup-2-bought');
  const after = await state();
  log('[probe] upgrades', JSON.stringify(after.upgrades), 'pets', JSON.stringify(after.pets.map((p) => p.kind)), 'gold', before.player.gold, '->', after.player.gold);
  const spent = before.player.gold - after.player.gold;
  expect(spent > 0, `gold went down by ${spent}`);
  expect(after.upgrades.length + after.pets.length > before.upgrades.length + before.pets.length, 'something was bought');
  // try again with nothing left in the pocket: it must refuse
  await page.evaluate(() => { window.__lh.state().player.gold = 3; });
  await press('e', 300);
  await wait(500);
  const poor = await state();
  expect(poor.player.gold === 3, 'a purse of 3 gold buys nothing');
  await shot('shopup-3-refused');
  log('[probe] toasts', JSON.stringify(await lh('toasts')));
};
