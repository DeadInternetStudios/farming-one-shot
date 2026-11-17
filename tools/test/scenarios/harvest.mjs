const SWING = 520;
export default async ({ press, lh, state, wait, log, shot }) => {
  const act = async (ms = SWING) => { await lh('act'); await wait(ms); };
  const tiles = [[20, 20], [21, 20], [22, 20]];
  await lh('teleport', 21, 19, 'down');
  await press('1');
  for (const [x] of tiles) { await lh('teleport', x, 19, 'down'); await act(); }
  await press('6');
  for (const [x] of tiles) { await lh('teleport', x, 19, 'down'); await act(250); }
  const water = async () => {
    await press('2');
    for (const [x] of tiles) { await lh('teleport', x, 19, 'down'); await act(); }
  };
  await water();
  await lh('teleport', 21, 18, 'down');
  await shot('h1-planted');
  for (let day = 2; day <= 6; day++) {
    await lh('setMinute', 1300);
    await lh('sleep');
    await wait(2600);
    await press('Space', 1800);
    const s = await state();
    log('day', s.day, 'minute', Math.round(s.minute), 'crops', JSON.stringify(Object.values(s.locations.farm.soil).map((q) => q.crop && `${q.crop.age}${q.wet ? 'w' : ''}`)));
    await lh('teleport', 21, 18, 'down');
    await shot(`h${day}`);
    await water();
  }
  await lh('teleport', 21, 18, 'down');
  await wait(300);
  await shot('h-ripe');
  // harvest by hand: face each tile
  for (const [x] of tiles) { await lh('teleport', x, 19, 'down'); await act(900); }
  await shot('h-harvested');
  log('toasts', JSON.stringify(await lh('toasts')));
  const s = await state();
  log('inventory', JSON.stringify(s.player.slots.filter(Boolean)));
};
