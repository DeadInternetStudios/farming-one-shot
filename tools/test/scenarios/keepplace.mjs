// Your place in a list survives the page being rebuilt: flipping "Larger interface" and turning the screen must leave the selection on the same row.
//   node tools/test/probe.mjs tools/test/scenarios/keepplace.mjs --touch --size 390x844 --dpr 3
export default async ({ lh, page, press, wait, shot, log }) => {
  const place = () =>
    page.evaluate(() => {
      const ui = window.__lh.game().scene.getScene('UI');
      return ui.stack.top?.pane?.place ?? -1;
    });
  await wait(1200);
  await press('Tab', 100);
  for (let i = 0; i < 50 && !(await lh('info')).paused; i++) await wait(100);
  await wait(300);
  await press('z', 300);
  await wait(300);
  const rows = await lh('options');
  const row = rows.indexOf('Larger interface');
  if (row < 0) throw new Error(`no Larger interface row in ${JSON.stringify(rows)}`);
  for (let i = 0; i < row; i++) await press('ArrowDown', 80);
  await wait(300);
  if ((await place()) !== row) throw new Error(`expected to be on row ${row}, found ${await place()}`);
  await shot('keepplace-1-on-the-row');

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-hollow:settings') ?? '{}').big === true);
  await press('Enter', 300);
  await wait(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-hollow:settings') ?? '{}').big === true);
  if (after === before) throw new Error('Larger interface did not flip');
  const kept = await place();
  log(`[probe] after the toggle the selection is row ${kept} of ${rows.length} (was ${row})`);
  if (kept !== row) throw new Error(`the toggle threw away the place in the list: row ${row} became ${kept}`);
  await shot('keepplace-2-after-toggle');

  // turn the screen and back: the same page is built again
  const size = page.viewportSize();
  if (size) {
    await page.setViewportSize({ width: size.height, height: size.width });
    await wait(900);
    const turned = await place();
    await page.setViewportSize(size);
    await wait(900);
    const back = await place();
    log(`[probe] turned: row ${turned}, turned back: row ${back}`);
    if (turned !== row || back !== row) throw new Error(`turning the screen moved the selection: ${row} -> ${turned} -> ${back}`);
  }

  // a different tab starts at the top again
  await press('c', 300);
  await wait(500);
  await press('z', 300);
  await wait(500);
  const fresh = await place();
  log('[probe] back on Options from another tab: row', fresh);
  if (fresh !== 0) throw new Error(`a tab switch should start at the top, found row ${fresh}`);

  // put the setting back for the next run
  for (let i = 0; i < row; i++) await press('ArrowDown', 80);
  await press('Enter', 300);
};
