// Visit the forest, the lake and every floor of the mine.
export default async ({ lh, press, hold, wait, shot, state }) => {
  await lh('setMinute', 11 * 60);
  await lh('go', 'forest', 20, 36, 'up');
  await wait(900);
  await shot('w1-forest-south');
  await lh('teleport', 20, 22, 'up');
  await wait(500);
  await shot('w2-forest-clearing');
  await lh('teleport', 20, 9, 'up');
  await wait(500);
  await shot('w3-forest-north');
  await lh('teleport', 20, 7, 'up');
  await wait(400);
  await hold('ArrowUp', 900);
  await wait(900);
  let st = await state();
  console.log('[probe] after walking into the mine mouth:', st.player.loc, st.player.x.toFixed(0), st.player.y.toFixed(0));
  await shot('w4-mine-1');
  for (let f = 2; f <= 5; f++) {
    await lh('go', `mine-${f}`, 4, 4, 'down');
    await wait(700);
    await shot(`w5-mine-${f}`);
    const info = await lh('info');
    console.log('[probe] floor', f, JSON.stringify(info.target));
  }
  await lh('go', 'lake', 2, 14, 'right');
  await wait(900);
  await shot('w6-lake-west');
  await lh('teleport', 20, 14, 'right');
  await wait(600);
  await shot('w7-lake-dock');
  await lh('setMinute', 19 * 60 + 20);
  await wait(900);
  await shot('w8-lake-dusk');
  st = await state();
  console.log('[probe] done, loc', st.player.loc);
};
