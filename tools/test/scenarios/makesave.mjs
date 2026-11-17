// Builds a mid-game save for screenshots: day 12, crops growing, a lit garden, a full bag, a few friends.
// Run it, then load the file it writes with `100x shots --init-script tools/test/fixtures/midgame.js`.
import { mkdirSync, writeFileSync } from 'node:fs';

const SPOTS = [[19, 11], [21, 11], [23, 11], [19, 13], [21, 13], [23, 13], [20, 12], [22, 12]];
const PIECES = ['deco-lantern-gold', 'deco-lantern-pink', 'deco-lantern-red', 'deco-stone-lantern', 'deco-lantern-teal', 'deco-planter', 'deco-lamp-post', 'deco-birdbath'];

export default async ({ lh, page, press, wait, state, log }) => {
  await page.evaluate(() => {
    const st = window.__lh.state();
    st.player.gold = 1850;
    st.day = 12;
  });
  await lh('setMinute', 10 * 60);
  // set the garden out like a player does
  await lh('go', 'farm', 20, 13, 'down');
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

  // a field: hoe, seed, water (the swing takes half a second, so ask for it through the debug action)
  const act = async (ms = 560) => { await lh('act'); await wait(ms); };
  const pick = (id) => page.evaluate((want) => {
    const st = window.__lh.state();
    const i = st.player.slots.findIndex((q) => q && (q.id === want || q.id.startsWith(want)));
    if (i >= 0 && i < 10) st.player.selected = i;
    return i;
  }, id);
  const field = [[20, 20], [21, 20], [22, 20], [20, 21], [21, 21], [22, 21]];
  for (const [x, y] of field) { await lh('teleport', x, y - 1, 'down'); await pick('hoe'); await act(); }
  for (const [x, y] of field) { await lh('teleport', x, y - 1, 'down'); await pick('seed-corn'); await act(300); }
  for (const [x, y] of field) { await lh('teleport', x, y - 1, 'down'); await pick('can'); await act(); }
  await lh('teleport', 21, 13, 'down');
  await lh('setMinute', 21 * 60);
  await wait(600);
  await press('Tab', 100);
  await wait(300);
  await press('Escape', 100);
  const raw = await page.evaluate(() => JSON.stringify(window.__lh.state()));
  mkdirSync('tools/test/fixtures', { recursive: true });
  writeFileSync('tools/test/fixtures/midgame.js', `try { if (!sessionStorage.getItem('lh-seeded')) { localStorage.setItem('lantern-hollow:save:v1', ${JSON.stringify(raw)}); sessionStorage.setItem('lh-seeded', '1'); } } catch (e) {}\n`);
  log('[probe] save bytes', raw ? raw.length : 0);
};
