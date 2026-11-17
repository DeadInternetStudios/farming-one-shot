// The Lantern Festival: the shrine lights lantern by lantern, paper lanterns lift off, fireworks, then the closing card.
export default async ({ lh, page, press, wait, shot, log, state }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  const lit = Number(process.env.LIT ?? 7);
  await page.evaluate((n) => {
    const st = window.__lh.state();
    for (const id of ['mirren', 'bram', 'ida', 'tam', 'wren', 'olwen']) st.social[id] = { points: 400, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    const ids = ['spring', 'summer', 'fall', 'forage', 'angler', 'miner', 'hearth'];
    ids.slice(0, n).forEach((id) => { st.bundles[id] = [99, 99, 99, 99, 99, 99, 99, 99]; });
    st.stats.earned = 18420; st.stats.harvested = 311; st.stats.caught = 24; st.stats.mined = 143;
    st.flags.outside = true; st.flags.letter = true;
  }, lit);
  await lh('setDay', 28);
  await lh('setMinute', 19 * 60 + 40);
  await lh('go', 'village', 24, 12, 'down');
  await wait(2500);
  await shot('finale-0-dusk');
  log('[probe] goal', JSON.stringify(await lh('goal')));
  await lh('setMinute', 20 * 60 + 1);
  const t0 = Date.now();
  for (const at of (process.env.AT ?? '2.4,5.6,7.6,9.0,9.4,9.9,10.9,11.8,13.2,15.5,18.0,19.5').split(',').map(Number)) {
    await wait(Math.max(0, at * 1000 - (Date.now() - t0)));
    await shot(`finale-t${String(at).replace('.', '_')}`);
  }
  await press('e', 700);
  await shot('finale-card-2');
  await press('e', 1500);
  await shot('finale-after');
  const st = await state();
  log('[probe] finaleDay', st.flags.finaleDay, 'lit', st.flags.finaleLit);
};
