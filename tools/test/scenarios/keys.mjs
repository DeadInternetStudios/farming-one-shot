export default async ({ hold, press, lh, state, wait, log, page }) => {
  await lh('teleport', 20, 19, 'down');
  await wait(200);
  let s = await state();
  log('before', s.player.x, s.player.y);
  await hold('ArrowRight', 400);
  s = await state();
  log('after ArrowRight', s.player.x, s.player.y);
  await hold('d', 400);
  s = await state();
  log('after d', s.player.x, s.player.y);
  await page.evaluate(() => {
    window.addEventListener('keydown', (e) => console.log(`[probe] keydown code=${e.code} key=${e.key} keyCode=${e.keyCode}`));
  });
  await press('Space', 300);
  await press('e', 300);
  await press('1', 300);
};
