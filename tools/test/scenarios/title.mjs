// Looks at the title screen. Leave the play flag off the URL so the title opens:
//   node tools/test/probe.mjs tools/test/scenarios/title.mjs --url "http://127.0.0.1:53868/?mute=1&debug=1&new=1"
export default async ({ press, wait, shot, page, log }) => {
  await wait(1800);
  await shot('title-a');
  await wait(2500);
  await shot('title-b');
  await press('ArrowDown');
  const size = await page.evaluate(() => `${innerWidth}x${innerHeight}`);
  log(`[probe] viewport ${size}`);
};
