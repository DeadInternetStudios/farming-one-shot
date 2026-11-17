const SWING = 520;
export default async ({ press, lh, state, wait, log, shot }) => {
  const act = async (ms = SWING) => { await lh('act'); await wait(ms); };
  const tiles = [20, 21, 22];
  await press('1');
  for (const x of tiles) { await lh('teleport', x, 19, 'down'); await act(700); }
  log('after hoe', JSON.stringify(await lh('tile', 21, 20)), JSON.stringify(await lh('tile', 20, 20)));
  await press('6');
  for (const x of tiles) { await lh('teleport', x, 19, 'down'); await act(300); }
  await press('2');
  for (const x of tiles) { await lh('teleport', x, 19, 'down'); await act(700); }
  await lh('teleport', 21, 18, 'down');
  await wait(300);
  await shot('a-planted');
  log('planted', JSON.stringify(await lh('tile', 21, 20)));
  await lh('setMinute', 1300);
  await lh('sleep');
  await wait(2600);
  await press('Space', 1800);
  await lh('teleport', 21, 18, 'down');
  await wait(300);
  await shot('b-after-sleep');
  log('after sleep', JSON.stringify(await lh('tile', 21, 20)), JSON.stringify(await lh('tile', 20, 20)));
  await lh('repaint');
  await wait(300);
  await shot('c-after-repaint');
  log('after repaint', JSON.stringify(await lh('tile', 21, 20)));
};
