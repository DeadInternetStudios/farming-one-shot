export default async ({ lh, wait, log, press }) => {
  await lh('teleport', 20, 19, 'down');
  await press('1', 200);
  const t0 = Date.now();
  await lh('act');
  let first = null;
  for (let i = 0; i < 60; i++) {
    const info = await lh('info');
    const t = Date.now() - t0;
    if (first === null && !info.swinging) first = t;
    if (i % 5 === 0) log(`t=${t}ms swinging=${info.swinging}`);
    await wait(40);
    if (first !== null && t > first + 200) break;
  }
  log('swing ended at', first, 'ms');
};
