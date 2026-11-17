// Turn the screen and change the window size a few times: the canvas must always fill the window exactly,
// at a pixel ratio of 1 (most desktops) and above (phones, laptops).
export default async ({ page, wait, log }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  const measure = () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { win: [innerWidth, innerHeight], shown: [Math.round(r.width), Math.round(r.height)], buffer: [c.width, c.height], dpr: devicePixelRatio };
  });
  const fits = (m) =>
    m.shown[0] === m.win[0] && m.shown[1] === m.win[1] &&
    Math.abs(m.buffer[0] - Math.round(m.win[0] * m.dpr)) <= 1 && Math.abs(m.buffer[1] - Math.round(m.win[1] * m.dpr)) <= 1;

  await wait(1500);
  const start = page.viewportSize();
  expect(fits(await measure()), `fits at the start: ${JSON.stringify(await measure())}`);
  const steps = [
    [start.height, start.width],
    [start.width, start.height],
    [800, 500],
    [1100, 720],
    [start.width, start.height],
  ];
  for (const [width, height] of steps) {
    await page.setViewportSize({ width, height });
    await wait(700);
    const m = await measure();
    expect(fits(m), `fits at ${width}x${height}: shown ${m.shown.join('x')}, buffer ${m.buffer.join('x')}, ratio ${m.dpr}`);
  }
};
