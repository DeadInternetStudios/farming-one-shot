// Check that the keyboard moves the player and report where they end up.
export default async ({ lh, hold, wait, state }) => {
  await lh('setMinute', 11 * 60);
  await lh('go', 'forest', 20, 9, 'up');
  await wait(800);
  for (let i = 0; i < 4; i++) {
    const before = await state();
    await hold('ArrowUp', 400);
    await wait(100);
    const after = await state();
    console.log('[probe] step', i, before.player.loc, before.player.y.toFixed(1), '->', after.player.loc, after.player.y.toFixed(1));
  }
};
