// Walk to the village, meet Mirren, shop, and give to the shrine.
export default async ({ lh, press, hold, wait, shot, state }) => {
  await lh('setMinute', 10 * 60 + 5);
  await lh('go', 'village', 3, 12, 'right');
  await wait(900);
  await shot('v1-arrive');
  let st = await state();
  console.log('[probe] loc', st.player.loc, 'x,y', st.player.x.toFixed(0), st.player.y.toFixed(0), 'gold', st.player.gold);

  // stand under Mirren and talk
  await lh('teleport', 6, 13, 'up');
  await wait(400);
  await shot('v2-near-mirren');
  await press('e', 300);
  await wait(900);
  await shot('v3-dialogue');
  await press('e', 200);
  await wait(500);
  await press('e', 300);
  await wait(900);
  await shot('v4-dialogue-2');
  // advance until the choices show
  for (let i = 0; i < 5; i++) { await press('e', 350); await wait(400); }
  await shot('v5-choices');
  console.log('[probe] toasts', JSON.stringify(await lh('toasts')));
  await press('Escape', 300);
  await wait(300);

  // the shop door
  await lh('teleport', 6, 11, 'up');
  await wait(300);
  await press('e', 300);
  await wait(800);
  await shot('v6-shop');
  await press('Escape', 300);

  // the shrine
  await lh('teleport', 23, 17, 'up');
  await wait(300);
  await press('e', 300);
  await wait(800);
  await shot('v7-shrine');
  await press('Escape', 300);

  // the board and the cafe
  await lh('teleport', 29, 15, 'up');
  await wait(300);
  await press('e', 300);
  await wait(800);
  await shot('v8-board');
  await press('Escape', 300);
  await lh('setMinute', 21 * 60);
  await wait(1200);
  await shot('v9-evening');
  st = await state();
  console.log('[probe] done, day', st.day, 'min', Math.round(st.minute));
};
