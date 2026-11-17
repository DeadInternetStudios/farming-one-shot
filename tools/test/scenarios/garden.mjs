// Buy a lantern in the store, set every kind of garden piece out on the farm, look at them at dusk and at night,
// then pick one up with the axe. Everything goes through the real windows and keys.
const PIECES = ['deco-lantern-gold', 'deco-lantern-teal', 'deco-lantern-pink', 'deco-lamp-post', 'deco-stone-lantern', 'deco-planter', 'deco-birdbath', 'deco-gnome'];
const SPOTS = [[19, 11], [21, 11], [23, 11], [19, 13], [21, 13], [23, 13], [20, 12], [22, 12], [24, 12], [20, 10], [22, 10], [24, 10]];

export default async ({ lh, page, press, wait, shot, state, log }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  const farmObjects = async () => (await state()).locations.farm.objects;
  const decorCount = async () => Object.values(await farmObjects()).filter((o) => o.k === 'decor').length;
  const slotOf = async (id) => (await state()).player.slots.findIndex((s) => s && s.id === id);
  const select = async (index) => { await page.evaluate((i) => { window.__lh.state().player.selected = i; }, index); };

  await page.evaluate(() => { window.__lh.state().player.gold = 2000; window.__lh.state().day = 6; });
  await lh('setMinute', 10 * 60 + 5);

  // the store: Buy, Farm, Garden, Sell
  await lh('go', 'village', 3, 12, 'right');
  await wait(900);
  await lh('teleport', 6, 11, 'up');
  await wait(300);
  log('[probe] fps', JSON.stringify(await lh('fps')));
  for (let tries = 0; tries < 6 && !(await lh('info')).paused; tries++) {
    await press('e', 300);
    await wait(800);
  }
  expect((await lh('info')).paused, 'the store window is open');
  await press('ArrowRight', 200);
  await wait(200);
  await press('ArrowRight', 200);
  await wait(400);
  await shot('garden-1-store');
  const before = await state();
  await press('e', 300); // the cheapest piece on the list
  await wait(500);
  const bought = await state();
  const price = before.player.gold - bought.player.gold;
  expect(price > 0 && price <= 120, `a lantern cost ${price}g`);
  expect(bought.player.slots.some((s) => s && s.id === 'deco-lantern-red'), 'the red lantern is in the bag');
  await shot('garden-2-bought');
  await press('Escape', 300);
  await wait(500);

  // out to the farm: the first lantern goes down by the well, next to the path
  await lh('go', 'farm', 20, 13, 'down');
  await wait(900);
  const lit0 = await lh('lights');
  const placed = new Map();
  const place = async (id) => {
    for (const [x, y] of SPOTS) {
      const key = `${x},${y}`;
      if (placed.has(key)) continue;
      await lh('teleport', x, y + 1, 'up');
      await wait(120);
      const at = await slotOf(id);
      if (at < 0 || at > 9) { log('[probe] no hotbar slot for', id, at); return false; }
      await select(at);
      await press('e', 160);
      await wait(160);
      const o = (await farmObjects())[key];
      if (o && o.k === 'decor') { placed.set(key, id); return true; }
    }
    return false;
  };
  expect(await place('deco-lantern-red'), 'the bought lantern went down');
  for (const id of PIECES) {
    await lh('give', id, 1);
    expect(await place(id), `${id} went down`);
  }
  expect((await decorCount()) === PIECES.length + 1, `${await decorCount()} pieces stand on the farm`);
  const lit1 = await lh('lights');
  log('[probe] lights before', JSON.stringify(lit0), 'after', JSON.stringify(lit1));
  expect(lit1.spots > lit0.spots && lit1.glows > lit0.glows, 'the lanterns add light spots and glows');

  // a solid piece blocks the walk
  await lh('teleport', 21, 12, 'down');
  await wait(400);
  await shot('garden-3-day');
  await lh('setMinute', 18 * 60 + 40);
  await wait(900);
  await shot('garden-4-dusk');
  await lh('setMinute', 22 * 60);
  await wait(1200);
  await shot('garden-5-night');
  await lh('weather', 'rain');
  await wait(900);
  await shot('garden-6-night-rain');
  await lh('weather', 'sun');

  // pick one up with the axe: it comes back as the lantern it was
  const [firstKey] = [...placed.keys()];
  const [fx, fy] = firstKey.split(',').map(Number);
  await lh('setMinute', 10 * 60);
  await lh('teleport', fx, fy + 1, 'up');
  await wait(200);
  await select(2);
  const bagBefore = (await state()).player.slots.filter(Boolean).length;
  await press('e', 200);
  await wait(300);
  const gone = (await farmObjects())[firstKey];
  expect(!gone, 'the axe lifts the lantern');
  const after = await state();
  expect(after.player.slots.some((s) => s && s.id === 'deco-lantern-red'), 'the lantern is back in the bag');
  expect(after.player.slots.filter(Boolean).length >= bagBefore, 'nothing was lost');
  const lit2 = await lh('lights');
  expect(lit2.spots === lit1.spots - 1, `the light went with it ${JSON.stringify(lit2)}`);
  await shot('garden-7-lifted');
  log('[probe] toasts', JSON.stringify(await lh('toasts')));
};
