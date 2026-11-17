// Walk into the house, look around, use the bed, walk back out.
export default async ({ lh, hold, press, wait, shot, state }) => {
  await lh('teleport', 11, 12, 'up');
  await hold('ArrowUp', 900);
  await wait(900);
  let st = await state();
  console.log('[probe] after door: loc=', st.player.loc, 'x,y=', st.player.x.toFixed(1), st.player.y.toFixed(1));
  await shot('house-1-arrive');
  await lh('teleport', 2, 4, 'up');
  await wait(300);
  await shot('house-2-bed');
  await press('e', 200);
  await wait(500);
  await shot('house-3-ask-sleep');
  await press('Escape', 200);
  await lh('setMinute', 22 * 60 + 40);
  await wait(400);
  await lh('teleport', 7, 8, 'down');
  await shot('house-4-night');
  await hold('ArrowDown', 900);
  await wait(900);
  st = await state();
  console.log('[probe] after exit: loc=', st.player.loc, 'x,y=', st.player.x.toFixed(1), st.player.y.toFixed(1));
  await shot('house-5-outside');
};
