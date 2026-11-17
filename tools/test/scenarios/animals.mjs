// The coop, the hens, the cat: set them up, look at them, feed them, take the eggs.
export default async ({ lh, page, wait, shot, log, press }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await page.evaluate(() => {
    const st = window.__lh.state();
    st.flags.coopDay = 1;
    st.upgrades.push('coop');
    st.pets.push({ id: 'hen-1', kind: 'chicken', name: 'Clover', fedDay: 0, happy: 50, since: -5 });
    st.pets.push({ id: 'hen-2', kind: 'chicken', name: 'Pepper', fedDay: 0, happy: 50, since: -5 });
    st.pets.push({ id: 'hen-3', kind: 'chicken', name: 'Biscuit', fedDay: 0, happy: 50, since: 3 });
    st.pets.push({ id: 'cat', kind: 'cat', name: 'Marmalade', fedDay: 0, happy: 50, since: 1 });
    st.flags.eggs = 3;
    window.__lh.give('hay', 5);
  });
  await lh('setDay', 3);
  await lh('setMinute', 10 * 60);
  await lh('teleport', 20, 10, 'up');
  await wait(2500);
  await shot('animals-1');
  await page.evaluate(() => window.__lh.act());
  await wait(500);
  log('[probe] toasts', JSON.stringify(await lh('toasts')));
  let st = await page.evaluate(() => { const s = window.__lh.state(); return { eggs: s.flags.eggs, fed: s.pets.map((p) => p.fedDay), hay: s.player.slots.filter(Boolean).filter((x) => x.id === 'hay').reduce((a, x) => a + x.n, 0), egg: s.player.slots.filter(Boolean).filter((x) => x.id === 'egg').reduce((a, x) => a + x.n, 0) }; });
  log('[probe]', JSON.stringify(st));
  expect(st.eggs === 0 && st.egg === 3, 'the three eggs moved into the bag');
  expect(st.fed.filter((d) => d === 3).length === 3, 'all three hens were fed');
  await shot('animals-2');
  await lh('setMinute', 22 * 60);
  await wait(1500);
  await shot('animals-3-night');
};
