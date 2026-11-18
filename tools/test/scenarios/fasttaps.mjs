// Three quick taps on three tiles while the first swing is still going: all three must be tilled, in order, none dropped.
//   node tools/test/probe.mjs tools/test/scenarios/fasttaps.mjs
// GAP is the time between taps in milliseconds (default 30, well inside one swing).
export default async ({ page, wait, log, press, lh }) => {
  const gap = Number(process.env.GAP ?? 30);
  await lh('teleport', 21, 19, 'down');
  await press('1', 200);
  const screen = (tx, ty) =>
    page.evaluate(([x, y]) => {
      const cam = window.__lh.game().scene.getScene('World').cameras.main;
      return { x: (x * 16 + 8 - cam.worldView.x) * cam.zoom, y: (y * 16 + 8 - cam.worldView.y) * cam.zoom };
    }, [tx, ty]);
  const tiles = [[22, 19], [22, 20], [22, 18]];
  const before = (await lh('state')).player.energy;
  for (const [x, y] of tiles) {
    const s = await screen(x, y);
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.up();
    await wait(gap);
  }
  await wait(2200);
  const tilled = [];
  for (const [x, y] of tiles) tilled.push(Boolean((await lh('tile', x, y)).soil));
  const spent = Math.round((before - (await lh('state')).player.energy) * 100) / 100;
  log('[probe] tilled', JSON.stringify(tilled), 'energy spent', spent);
  if (!tilled.every(Boolean)) throw new Error(`a tap was dropped: ${JSON.stringify(tilled)}`);

  // a held button must not bank a long queue: the first press swings at once and three more are kept, so eight quick presses are four actions
  await lh('teleport', 26, 19, 'down');
  const start = (await lh('state')).player.energy;
  for (let i = 0; i < 8; i++) { await lh('act'); await wait(gap); }
  await wait(3200);
  const used = Math.round((start - (await lh('state')).player.energy) * 100) / 100;
  const one = spent / 3;
  log('[probe] eight presses used', used, 'energy, one action costs', Math.round(one * 100) / 100);
  if (Math.abs(used - 4 * one) > 0.02) throw new Error(`eight quick presses did ${used / one} actions instead of 4`);
};
