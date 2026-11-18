// A phone can hurry: dragging the stick well past its ring walks faster than a drag that stays inside it, by real touch events.
//   node tools/test/probe.mjs tools/test/scenarios/hurry.mjs --touch --size 390x844 --dpr 3
export default async ({ lh, page, wait, state, shot, log }) => {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const at = async () => {
    const p = (await state()).player;
    return { x: p.x, y: p.y };
  };
  await wait(1200);

  const run = async (reach, label) => {
    await lh('go', 'farm', 8, 14, 'right');
    await wait(900);
    const from = await at();
    await touch('touchStart', 40, 600);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', 40 + (reach * i) / 8, 600); await wait(20); }
    await wait(150);
    const t0 = Date.now();
    const a = await at();
    await wait(900);
    const b = await at();
    const sec = (Date.now() - t0) / 1000;
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / sec;
    await shot(`hurry-${label}`);
    await touch('touchEnd');
    await wait(300);
    const rest = await at();
    const stopped = await lh('info');
    log(`[probe] ${label}: drag ${reach} css px, moved ${Math.round(Math.hypot(b.x - from.x, b.y - from.y))} px, ${speed.toFixed(1)} px/s`);
    await wait(300);
    const still = await at();
    if (Math.hypot(still.x - rest.x, still.y - rest.y) > 0.5) throw new Error('the player kept walking after the finger lifted');
    void stopped;
    return speed;
  };

  const walk = await run(30, 'walk');
  const hurry = await run(150, 'hurry');
  log(`[probe] walk ${walk.toFixed(1)} px/s, hurry ${hurry.toFixed(1)} px/s`);
  if (!(hurry > walk * 1.3)) throw new Error(`dragging past the ring should hurry: ${hurry.toFixed(1)} vs ${walk.toFixed(1)}`);
  if (walk < 25) throw new Error(`a short drag should still walk at a steady pace, got ${walk.toFixed(1)}`);
};
