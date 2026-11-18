// Films the evening in steps at one spot, to judge the golden hour, the dusk and the blue night: gold, rose, violet, night.
//   PORT=53868 node tools/test/probe.mjs tools/test/scenarios/dusk.mjs --size 390x844 --dpr 3 --touch --out /tmp/dusk
// Summer day 1 sunsets at 21:00 (minute 1260). Change the moments, the day (winter is 22) and the weather with environment variables:
//   MINUTES=1215,1240,1255,1275,1290,1305 DAY=8 WEATHER=sun
const STEPS = (process.env.MINUTES ?? '1215,1240,1255,1275,1290,1305').split(',').map(Number);
export default async ({ page, wait, shot }) => {
  await wait(1500);
  await page.evaluate(([d, w]) => { const lh = window.__lh; lh.setDay(d); lh.weather(w); }, [Number(process.env.DAY ?? 8), process.env.WEATHER ?? 'sun']);
  await wait(800);
  let i = 0;
  for (const m of STEPS) {
    await page.evaluate((v) => window.__lh.setMinute(v), m);
    await wait(350);
    await shot(`m${String(i++).padStart(2, '0')}-${m}`);
  }
};
