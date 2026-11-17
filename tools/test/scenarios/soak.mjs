// Sleep through the days one after another with everyone met and every recipe known, so the nightly
// work (requests, growth, withering, spawns, rain, mail) runs on every season. Any error shows up as a PROBLEM.
const FROM = Number(process.env.SOAK_FROM ?? 1);
const TO = Number(process.env.SOAK_TO ?? 28);

export default async ({ lh, page, press, wait, state, log, shot }) => {
  await page.evaluate(() => {
    const st = window.__lh.state();
    for (const id of ['mirren', 'ida', 'bram', 'tam', 'wren', 'olwen']) {
      st.social[id] = { points: 400, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    }
    st.deepest = 5;
    st.recipes = ['chest', 'furnace', 'sprinkler', 'jam', 'salad', 'soup', 'stew', 'tea', 'pie'];
  });
  await lh('setDay', FROM);
  let day = (await state()).day;
  const seen = [];
  let requests = 0;
  while (day < TO) {
    await lh('setMinute', 22 * 60);
    await lh('sleep');
    await wait(1700);
    for (let i = 0; i < 6; i++) { await press('e', 120); await wait(220); }
    const st = await state();
    requests = Math.max(requests, st.requests.length);
    if (st.day !== day + 1) { log(`[probe] FAIL day ${day} did not advance (now ${st.day}, sleeping modal stuck?)`); await shot(`soak-stuck-${day}`); break; }
    day = st.day;
    seen.push(`${day}:${st.weather}:${st.requests.length}`);
  }
  const st = await state();
  log(`[probe] reached day ${st.day}, most notes up at once ${requests}, gold ${st.player.gold}`);
  log(`[probe] ${seen.join(' ')}`);
  await shot('soak-end');
};
