// A fair day on the green: bunting, the crowd, the judging stall.
export default async ({ lh, page, press, wait, shot, log, state }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await page.evaluate(() => {
    const st = window.__lh.state();
    for (const id of ['mirren', 'bram', 'ida', 'tam', 'wren', 'olwen']) st.social[id] = { points: 0, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    window.__lh.give('fish-trout', 1);
    window.__lh.give('fish-perch', 1);
  });
  await lh('setDay', 14);
  await lh('setMinute', 11 * 60 + 30);
  await lh('go', 'village', 24, 17, 'up');
  await wait(2500);
  await shot('fair-1-green');
  log('[probe] goal', JSON.stringify(await lh('goal')));
  await lh('teleport', 17, 17, 'up');
  await wait(600);
  await shot('fair-2-stall');
  await press('e', 500);
  await wait(900);
  await shot('fair-3-invite');
  for (let i = 0; i < 4; i++) { await press('e', 250); await wait(250); }
  await shot('fair-4-choices');
  await press('e', 300);
  await wait(700);
  await shot('fair-5-pick');
  await press('e', 300);
  await wait(500);
  await shot('fair-6-detail');
  await press('e', 300);
  await wait(900);
  await shot('fair-7-result');
  const st = await state();
  log('[probe] gold', st.player.gold, 'entered', st.flags['fair-14'], 'toasts', JSON.stringify(await lh('toasts')));
  expect(typeof st.flags['fair-14'] === 'string', 'the entry was recorded');
  for (let i = 0; i < 6; i++) { await press('e', 250); await wait(250); }
  await lh('setMinute', 18 * 60 + 40);
  await wait(1800);
  await shot('fair-8-evening');
};
