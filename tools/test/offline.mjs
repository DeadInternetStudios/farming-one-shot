// Plays the built game once online, then cuts the network and reloads: it must still start.
// It jumps into a farm with the test flags, so the build must be made with them: VITE_TEST_HOOKS=1 npm run build
// Run: VITE_TEST_HOOKS=1 npm run build && npx vite preview --port 54180 & node tools/test/offline.mjs http://127.0.0.1:54180/
import { createRequire } from 'node:module';

const base = process.argv[2] ?? 'http://127.0.0.1:54180/';
const from = process.env.X100_PLAYWRIGHT_FROM ?? '/Users/mac/Documents/GitHub/unslop-design/skills/unslop-design/x.js';
const { chromium } = createRequire(from)('playwright');
const check = (ok, what) => { console.log(`[offline] ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) process.exitCode = 1; };

const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 576 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const failed = [];
page.on('requestfailed', (r) => failed.push(r.url().replace(base, '/')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// no ?mute here: the sound files have to load to be cached. The browser itself is started muted.
const url = `${base}?debug=1&new=1&play=1&skip=1`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__lh, null, { timeout: 30000 });

const manifest = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]')?.href;
  if (!href) return null;
  const res = await fetch(href);
  return res.ok ? res.json() : null;
});
check(!!manifest && manifest.name === 'Cozy Farming Simulator MVP', 'the manifest loads');
for (const icon of manifest?.icons ?? []) {
  const res = await page.request.get(new URL(icon.src, base).href);
  check(res.ok(), `icon ${icon.src} (${icon.sizes}) loads`);
}
const apple = await page.evaluate(() => document.querySelector('link[rel=apple-touch-icon]')?.href);
check(!!apple && (await page.request.get(apple)).ok(), 'the home screen icon loads');

const ready = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { state: reg.active?.state, scope: reg.scope };
});
check(ready.state === 'activated', `the worker is active (${ready.state})`);
await page.waitForTimeout(9000);
const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const cache = await caches.open(names[0]);
  const keys = await cache.keys();
  return { names, count: keys.length, hasAtlas: keys.some((k) => k.url.includes('atlas.png')), hasJs: keys.some((k) => /assets\/index-.*\.js/.test(k.url)), hasAudio: keys.some((k) => k.url.includes('/audio/')) };
});
console.log('[offline] cache', JSON.stringify(cached));
check(cached.count > 20 && cached.hasAtlas && cached.hasJs && cached.hasAudio, 'the pictures, the code and the sound are in the cache');

await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
const alive = await page.waitForFunction(() => !!window.__lh, null, { timeout: 30000 }).then(() => true, () => false);
check(alive, 'with the network cut, a reload still starts the game');
if (failed.length) console.log('[offline] failed requests', JSON.stringify(failed.slice(0, 12)));
if (alive) {
  await page.waitForTimeout(1500);
  const day = await page.evaluate(() => window.__lh.state().day);
  check(day === 1, 'and it plays: day 1 on the clock');
  await page.screenshot({ path: '.100x/shots/offline.png' });
}
check(errors.length === 0, `no page errors ${errors.slice(0, 2).join(' | ')}`);
await browser.close();
