export default async ({ press, lh, state, wait, log, shot }) => {
  const soil = async (tag) => {
    const s = await state();
    log(tag, 'sel', s.player.selected, 'energy', s.player.energy, 'soil', Object.keys(s.locations.farm.soil).join(' '), 'toasts', JSON.stringify(await lh('toasts')));
  };
  await lh('teleport', 20, 19, 'down');
  await wait(300);
  await press('1');
  await press('Space', 900);
  await soil('hoe at 20,20');
  await lh('teleport', 21, 19, 'down');
  log('info', JSON.stringify(await lh('info')));
  await press('Space', 900);
  await soil('hoe at 21,20');
  log('obj at 21,20', JSON.stringify((await state()).locations.farm.objects['21,20']));
  await lh('teleport', 22, 19, 'down');
  await press('Space', 900);
  await soil('hoe at 22,20');
  await lh('teleport', 20, 21, 'down');
  await press('Space', 900);
  await soil('hoe at 20,22');
  await shot('till');
};
