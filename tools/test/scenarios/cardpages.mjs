// A card too tall for a short screen (the Controls page on a phone held sideways) is read a page at a time, and every line of it can be reached.
//   node tools/test/probe.mjs tools/test/scenarios/cardpages.mjs --touch --size 640x360 --dpr 2
export default async ({ lh, page, press, wait, shot, log }) => {
  const seen = () =>
    page.evaluate(() => {
      const ui = window.__lh.game().scene.getScene('UI');
      return ui.children.list.filter((o) => o.visible && typeof o.text === 'string' && o.text.length > 0).map((o) => o.text.replace(/\s+/g, ' '));
    });
  await wait(1200);
  await press('Tab', 100);
  for (let i = 0; i < 50 && !(await lh('info')).paused; i++) await wait(100);
  await wait(300);
  await press('z', 300);
  await wait(500);

  const mustRead = [
    ['Controls', ['Drag on the left', 'Drag past the ring to hurry', 'The big button uses', 'The bag button opens', 'Tap a slot', 'Tap a tile', 'tap Eat']],
    ['Help and about', ['Cozy Farming Simulator MVP v', 'this browser only', 'Back up your farm', 'say which version']],
  ];
  for (const [row, phrases] of mustRead) {
    const rows = await lh('options');
    const to = rows.indexOf(row);
    // the list opens on its first row
    const here = await page.evaluate(() => window.__lh.game().scene.getScene('UI').stack.top.pane.place);
    for (let i = 0; i < (to - here + rows.length) % rows.length; i++) await press('ArrowDown', 80);
    await wait(400);
    let all = '';
    let pages = 0;
    for (let i = 0; i < 8; i++) {
      all += ` ${(await seen()).join(' ')}`;
      pages++;
      await shot(`cardpages-${row.split(' ')[0].toLowerCase()}-${i}`);
      const text = (await seen()).join(' ');
      if (!/More|From the top/.test(text)) break;
      if (/From the top/.test(text)) break;
      await press('Enter', 300);
      await wait(300);
    }
    const missing = phrases.filter((p) => !all.includes(p));
    log(`[probe] ${row}: read in ${pages} page(s), missing ${JSON.stringify(missing)}`);
    if (missing.length > 0) throw new Error(`${row} lost text on this screen: ${missing.join(' | ')}`);
  }
};
