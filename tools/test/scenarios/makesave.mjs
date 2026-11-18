// Builds a mid-game save for screenshots: day 12, a field of mixed crops at every stage, lanterns and garden pieces scattered the way a player leaves them, a full bag, and the clock at ten at night.
// Run it, then load the file it writes with `100x shots --init-script tools/test/fixtures/midgame.js`.
import { mkdirSync, writeFileSync } from 'node:fs';

// scattered, not in a lattice: a few by the path, one near the well, a pair by the field, a loner by the fence
const SPOTS = [[21, 15], [18, 17], [25, 16], [23, 19], [19, 14], [27, 18], [20, 19], [24, 14], [16, 16], [26, 13], [17, 19], [18, 12]];
const PIECES = ['deco-lantern-gold', 'deco-lantern-pink', 'deco-lantern-red', 'deco-stone-lantern', 'deco-lantern-teal', 'deco-planter', 'deco-lamp-post', 'deco-birdbath'];

export default async ({ lh, page, press, wait, state, log }) => {
  await page.evaluate(() => {
    const st = window.__lh.state();
    st.player.gold = 1850;
    st.day = 12;
  });
  await lh('setMinute', 10 * 60);
  // set the garden out like a player does
  await lh('go', 'farm', 21, 16, 'down');
  await wait(900);
  const placed = new Set();
  for (const id of PIECES) {
    await lh('give', id, 1);
    for (const [x, y] of SPOTS) {
      const key = `${x},${y}`;
      if (placed.has(key)) continue;
      await lh('teleport', x, y + 1, 'up');
      await wait(120);
      const slot = (await state()).player.slots.findIndex((s) => s && s.id === id);
      if (slot < 0 || slot > 9) break;
      await page.evaluate((i) => { window.__lh.state().player.selected = i; }, slot);
      await press('e', 160);
      await wait(160);
      if ((await state()).locations.farm.objects[key]?.k === 'decor') { placed.add(key); break; }
    }
  }
  log('[probe] garden pieces placed:', placed.size);

  // a full bag
  for (const [id, n] of [['seed-corn', 12], ['seed-cauliflower', 6], ['corn', 8], ['potato', 5], ['flower', 6], ['fish-trout', 2], ['dish-pie', 2], ['copperBar', 4], ['gem-ruby', 1], ['lantern', 1]]) await lh('give', id, n);

  // the field: three rows of six crops, at the ages a week of watering leaves them (the oldest in the corner, one corn plant ripe).
  // Written straight into the save, because swinging a hoe eighteen times is slow and the timing is not worth chasing.
  await page.evaluate(() => {
    const st = window.__lh.state();
    const soil = st.locations.farm.soil;
    const rows = { 20: ['tomato', [3, 3, 2, 2, 1, 1]], 21: ['corn', [5, 4, 4, 3, 2, 2]], 22: ['sunflower', [3, 3, 2, 2, 1, 0]] };
    for (const [y, [id, ages]] of Object.entries(rows)) {
      ages.forEach((age, i) => { soil[`${20 + i},${y}`] = { wet: (i + Number(y)) % 3 !== 0, crop: { id, age, regrowing: false, dead: false } }; });
    }
    window.__lh.repaint();
  });
  log('[probe] crops planted:', await page.evaluate(() => Object.values(window.__lh.state().locations.farm.soil).filter((t) => t.crop).length));
  await lh('teleport', 22, 17, 'down');
  await lh('setMinute', 22 * 60);
  await wait(600);
  await press('Tab', 100);
  await wait(300);
  await press('Escape', 100);
  const raw = await page.evaluate(() => JSON.stringify(window.__lh.state()));
  mkdirSync('tools/test/fixtures', { recursive: true });
  writeFileSync('tools/test/fixtures/midgame.js', `try { if (!sessionStorage.getItem('lh-seeded')) { localStorage.setItem('lantern-hollow:save:v1', ${JSON.stringify(raw)}); sessionStorage.setItem('lh-seeded', '1'); } } catch (e) {}\n`);
  log('[probe] save bytes', raw ? raw.length : 0);
};
