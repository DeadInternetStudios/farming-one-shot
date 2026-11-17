// A look at the HUD with the goal line, a place banner and a toast, at whatever size the probe was given.
export default async ({ lh, wait, shot, log }) => {
  await wait(1200);
  log('[probe] goal', JSON.stringify(await lh('goal')));
  await shot('hud-a');
  await lh('go', 'village', 6, 12, 'right');
  await wait(900);
  await lh('give', 'radish', 3);
  await wait(1200);
  await shot('hud-b');
};
