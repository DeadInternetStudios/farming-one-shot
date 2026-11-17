// The street with its bunting, and the entry list at the judging stall.
export default async ({ lh, page, press, wait, shot, log }) => {
  await page.evaluate(() => {
    const st = window.__lh.state();
    for (const id of ['mirren', 'bram', 'ida', 'tam', 'wren', 'olwen']) st.social[id] = { points: 0, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    for (const [id, n] of [['flower', 3], ['radish', 2], ['potato', 1], ['cauliflower', 1], ['mushroom', 1]]) window.__lh.give(id, n);
  });
  await lh('setDay', 7);
  await lh('setMinute', 13 * 60);
  await lh('go', 'village', 22, 12, 'right');
  await wait(2200);
  await shot('fair2-1-street');
  await lh('teleport', 17, 17, 'up');
  await wait(500);
  await press('e', 3200);
  await shot('fair2-2-invite');
  await press('e', 600);
  await shot('fair2-3-choices');
  await press('e', 900);
  await shot('fair2-4-list');
  await press('ArrowDown', 200);
  await press('ArrowDown', 300);
  await shot('fair2-5-list-2');
  await press('e', 600);
  await shot('fair2-6-detail');
};
