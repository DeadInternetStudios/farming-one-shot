// What a screen reader can learn from the page: the canvas has a name, the controls are listed in words, the goal is spoken, and zooming is allowed.
//   node tools/test/probe.mjs tools/test/scenarios/a11y.mjs
export default async ({ page, wait, log }) => {
  await wait(1500);
  const seen = await page.evaluate(() => ({
    role: document.querySelector('canvas')?.getAttribute('role'),
    label: document.querySelector('canvas')?.getAttribute('aria-label') ?? '',
    controls: [...document.querySelectorAll('#how li')].map((li) => li.textContent),
    live: document.getElementById('live')?.textContent ?? '',
    viewport: document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '',
  }));
  log('[probe] canvas role', seen.role, '| controls listed', seen.controls.length, '| spoken', JSON.stringify(seen.live));
  if (seen.role !== 'img' || !/Cozy Farming Simulator MVP/.test(seen.label)) throw new Error('the canvas has no name');
  if (seen.controls.length < 4) throw new Error('the controls are not listed in the page');
  if (!/^Next: /.test(seen.live)) throw new Error(`the goal is not spoken: ${JSON.stringify(seen.live)}`);
  if (/user-scalable=no|maximum-scale/.test(seen.viewport)) throw new Error('zooming is switched off');
};
