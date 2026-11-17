// Touch hotbar: every cell is 44 CSS pixels wide, and the edge cells slide the window so slots 9 and 10 can be reached.
//   node tools/test/probe.mjs tools/test/scenarios/hotbar.mjs --size 390x844 --dpr 3 --touch --out .100x/shots/hotbar
export default async ({ page, wait, shot, log, state }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await page.evaluate(() => {
    const st = window.__lh.state();
    // fill the bar so there is something in every slot
    const ids = ['hoe', 'can', 'axe', 'pick', 'scythe', 'seed-radish', 'seed-potato', 'wood', 'stone', 'fiber'];
    st.player.slots.splice(0, 10, ...ids.map((id) => ({ id, n: id.startsWith('seed') || id === 'wood' || id === 'stone' || id === 'fiber' ? 5 : 1 })));
  });
  await wait(600);
  const g = await page.evaluate(() => {
    const css = innerWidth;
    const cssH = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const uiZoom = Math.max(1, Math.round((Math.min(css, cssH) >= 800 ? 3 : 2) * dpr));
    return { uiW: Math.floor((css * dpr) / uiZoom), uiH: Math.floor((cssH * dpr) / uiZoom), cssPerUi: uiZoom / dpr };
  });
  const visible = Math.max(5, Math.min(10, Math.floor((g.uiW - 8) / 22)));
  const x0 = Math.floor((g.uiW - (visible * 22 + 1)) / 2);
  const y = (g.uiH - 24 + 10) * g.cssPerUi;
  const cell = (i) => (x0 + i * 22 + 10) * g.cssPerUi;
  log('[probe] layout', JSON.stringify({ ...g, visible, x0 }));
  expect(22 * g.cssPerUi >= 44, `cells are ${22 * g.cssPerUi} CSS px wide`);
  await shot('hotbar-0');
  const selected = async () => (await state()).player.selected;
  // tap the last visible cell
  await page.touchscreen.tap(cell(visible - 1), y);
  await wait(500);
  const a = await selected();
  expect(a === visible - 1, `tapped the last visible cell, selected ${a}`);
  await shot('hotbar-1-edge');
  // the window slid, so the next one along is now on screen: tap the last cell again until slot 10 is selected
  for (let n = 0; n < 4 && (await selected()) < 9; n++) {
    await page.touchscreen.tap(cell(visible - 1), y);
    await wait(500);
  }
  expect((await selected()) === 9, `reached slot 10 by touch, selected ${await selected()}`);
  await shot('hotbar-2-end');
  // and back to the start
  for (let n = 0; n < 6 && (await selected()) > 0; n++) {
    await page.touchscreen.tap(cell(0), y);
    await wait(500);
  }
  expect((await selected()) === 0, `back to slot 1, selected ${await selected()}`);
  await shot('hotbar-3-start');
};
