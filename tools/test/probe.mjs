// Drives the running game in a muted headless Chromium and lets a scenario poke at it.
// Run: node tools/test/probe.mjs <scenario.mjs> [--url http://127.0.0.1:PORT/] [--size 1280x720] [--dpr 1]
// A scenario exports default async ({ page, shot, log, state, press, wait }) => void.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const scenarioPath = args.find((a) => !a.startsWith('--') && a.endsWith('.mjs'));
if (!scenarioPath) { console.error('usage: probe.mjs <scenario.mjs>'); process.exit(2); }

const url = flag('url', `http://127.0.0.1:${process.env.PORT ?? 53868}/?mute=1&debug=1&new=1&play=1&skip=1`);
const [w, h] = flag('size', '1280x720').split('x').map(Number);
const dpr = Number(flag('dpr', '1'));
const outDir = flag('out', '.100x/shots/probe');
mkdirSync(outDir, { recursive: true });

const from = process.env.X100_PLAYWRIGHT_FROM ?? '/Users/mac/Documents/GitHub/unslop-design/skills/unslop-design/x.js';
const { chromium } = createRequire(from)('playwright');

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: args.includes('--touch'), isMobile: args.includes('--touch') });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  if (m.text().startsWith('[probe]')) console.log(m.text());
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${e.stack ?? ''}`));

const tools = {
  page,
  log: (...a) => console.log(...a),
  wait: (ms) => page.waitForTimeout(ms),
  press: async (k, ms = 80) => { await page.keyboard.press(k); await page.waitForTimeout(ms); },
  hold: async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); },
  state: () => page.evaluate(() => window.__lh.state()),
  lh: (fn, ...a) => page.evaluate(([f, args]) => window.__lh[f](...args), [fn, a]),
  shot: async (name) => { const p = path.join(outDir, `${name}.png`); await page.screenshot({ path: p }); console.log('shot', p); return p; },
};

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
try {
  const mod = await import(pathToFileURL(path.resolve(scenarioPath)).href);
  await mod.default(tools);
} catch (e) {
  console.error('scenario failed:', e);
  process.exitCode = 1;
}
if (problems.length) console.log('PROBLEMS:\n' + [...new Set(problems)].join('\n'));
else console.log('no console problems');
await browser.close();
