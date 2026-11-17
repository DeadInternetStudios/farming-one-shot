// The farm well refills the can without a walk to the pond.
export default async ({ lh, page, press, wait, shot, log, state }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await page.evaluate(() => { window.__lh.state().player.water = 2; });
  await lh('teleport', 17, 14, 'up');
  await wait(700);
  await shot('well-1');
  await press('e', 400);
  await wait(500);
  const st = await state();
  expect(st.player.water >= 18, `the can is full, ${st.player.water}`);
  log('[probe] toasts', JSON.stringify(await lh('toasts')));
  await shot('well-2');
};
