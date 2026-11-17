export default async ({ lh, wait, log }) => {
  for (let i = 0; i < 4; i++) {
    await wait(1000);
    log('fps', JSON.stringify(await lh('fps')));
  }
  await lh('setMinute', 1260);
  await wait(1500);
  log('night fps', JSON.stringify(await lh('fps')));
};
