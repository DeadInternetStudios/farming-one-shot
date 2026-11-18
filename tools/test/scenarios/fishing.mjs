// Cast from the dock, wait for a bite, set the hook, and win the fight with real key presses.
export default async ({ lh, press, wait, shot, state, page }) => {
  await lh('setMinute', 18 * 60 + 10);
  await lh('give', 'rod', 1);
  await lh('go', 'lake', 24, 14, 'right');
  await wait(900);
  const st0 = await state();
  const slot = st0.player.slots.findIndex((s) => s && s.id === 'rod');
  await press(String((slot + 1) % 10), 200);
  await press('e', 100);
  await wait(700);
  await shot('f1-waiting');
  await lh('fish', true, { item: 'fish-trout', difficulty: 0.5 });
  for (let i = 0; i < 40; i++) {
    const f = await lh('fish');
    if (f.phase === 'bite') break;
    await wait(100);
  }
  await shot('f2-bite');
  await press('e', 250);
  await wait(400);
  let held = false;
  let prev = null;
  let shots = 0;
  for (let i = 0; i < 900; i++) {
    const s = await page.evaluate(() => {
      const f = window.__fight;
      return f ? { fish: f.fish, zone: f.zone, state: f.state, p: f.progress, perfect: f.perfect } : null;
    });
    if (!s) { if (i > 5) break; await wait(40); continue; }
    if (s.state !== 'on') break;
    const vel = prev === null ? 0 : (s.zone - prev) / 0.05;
    prev = s.zone;
    const want = s.fish - s.zone - vel * 0.22 > 0;
    if (want && !held) { await page.keyboard.down('e'); held = true; }
    else if (!want && held) { await page.keyboard.up('e'); held = false; }
    if (i === 40 && shots === 0) {
      await shot('f3-fight');
      shots++;
      // the numbers above steer the fight, but a player steers by the picture: the fish has to be on screen, and not faded to nothing
      const seen = await page.evaluate(() => {
        const ui = window.__lh.game().scene.getScene('UI');
        return ui.children.list.filter((o) => o.visible && o.frame && String(o.frame.name).startsWith('item/fish-')).map((o) => o.alpha);
      });
      console.log('[probe] fish images on screen, alpha', JSON.stringify(seen));
      if (!seen.some((a) => a === 1)) throw new Error(`the fish cannot be seen in the fight (alphas ${JSON.stringify(seen)})`);
    }
    await wait(45);
  }
  if (held) await page.keyboard.up('e');
  await wait(1100);
  await shot('f4-after');
  console.log('[probe] toasts', JSON.stringify(await lh('toasts')));
  const st = await state();
  console.log('[probe] caught', st.stats.caught, 'seen', JSON.stringify(st.seen), 'bag', JSON.stringify(st.player.slots.filter((s) => s && s.id.startsWith('fish'))), 'energy', st.player.energy);
};
