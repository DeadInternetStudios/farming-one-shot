// Opens every pop-up the game has, asks the game where everything is (tools/test/audit.mjs), and then turns the
// screen on its side and back with the pop-up still open. Run it once for each screen size you care about:
//   node tools/test/probe.mjs tools/test/scenarios/layout.mjs --size 360x640 --dpr 2 --touch --out /tmp/layout
// ONLY=menu-bag,shop-buy limits it to some states. TURN=0 skips the turning. SHOTS=1 photographs every look, not only the bad ones.
// It exits with 1 when anything is wrong.
import { check, settle } from '../audit.mjs';

export default async ({ page, wait, press, lh, log, shot }) => {
  const url = page.url().replace('&new=1', '').replace('&skip=1', '');
  await page.addInitScript({ path: `tools/test/fixtures/${process.env.FIXTURE ?? 'midgame'}.js` });
  await page.goto(url, { waitUntil: 'load' });
  await wait(2600);
  await lh('setMinute', 600);
  await wait(500);

  const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
  const turn = process.env.TURN !== '0';
  const size = page.viewportSize();
  const interact = (what) => page.evaluate((w) => window.__lh.interact(w), what);
  let problems = 0;
  let looked = 0;

  const once = async (label) => {
    looked++;
    const n = await check(page, label, ['UI']);
    problems += n;
    if (n > 0 || process.env.SHOTS) await shot(label.replace(/\s+/g, '-'));
  };
  const look = async (label, canTurn = true) => {
    await once(label);
    if (!turn || !canTurn) return;
    await page.setViewportSize({ width: size.height, height: size.width });
    await settle(page, size.height > size.width);
    await once(`${label} turned`);
    await page.setViewportSize(size);
    await settle(page, size.width > size.height);
    await once(`${label} turned back`);
  };
  const leave = async (keys = ['Escape']) => {
    for (const k of keys) await press(k);
    await wait(450);
  };

  const states = [
    ['hud-day', async () => {}, async () => {}],
    ['hud-night', async () => { await lh('setMinute', 1300); await wait(500); }, async () => { await lh('setMinute', 600); await wait(300); }],
    ['hud-toast', async () => { await lh('emit', 'toast', 'The farm looks lovely lit up. Try Take a postcard in Options.'); await lh('emit', 'hint', 'Talk to Mirren'); await wait(500); }, async () => { await wait(300); }],
    ['menu-bag', () => interact({ kind: 'menu', tab: 'bag' }), leave],
    ['menu-craft', () => interact({ kind: 'menu', tab: 'craft' }), leave],
    ['menu-lanterns', () => interact({ kind: 'menu', tab: 'bundles' }), leave],
    ['menu-friends', () => interact({ kind: 'menu', tab: 'friends' }), leave],
    ['menu-options', () => interact({ kind: 'menu', tab: 'options' }), leave],
    ['shop-buy', () => interact({ kind: 'shop', id: 'store' }), leave],
    ['shop-farm', async () => { await interact({ kind: 'shop', id: 'store' }); await wait(500); await press('ArrowRight'); }, leave],
    ['shop-garden', async () => { await interact({ kind: 'shop', id: 'store' }); await wait(500); await press('ArrowRight'); await press('ArrowRight'); }, leave],
    ['shop-sell', async () => { await interact({ kind: 'shop', id: 'store' }); await wait(500); for (let i = 0; i < 3; i++) await press('ArrowRight'); }, leave],
    ['shop-cafe', () => interact({ kind: 'shop', id: 'cafe' }), leave],
    ['shop-smithy', () => interact({ kind: 'shop', id: 'smithy' }), leave],
    ['shrine', () => interact({ kind: 'shrine' }), leave],
    ['stove', () => interact({ kind: 'cook' }), leave],
    ['board', () => interact({ kind: 'board' }), leave],
    ['chest', () => interact({ kind: 'chest', loc: 'farm', key: '3,3' }), leave],
    ['talk', async () => { await interact({ kind: 'talk', id: 'mirren' }); await wait(3000); }, leave],
    ['gift', async () => { await interact({ kind: 'talk', id: 'mirren' }); await wait(3000); await press('Enter'); await wait(700); await press('Enter'); await wait(700); }, leave],
    ['fishing', () => page.evaluate(() => window.__lh.interact({ kind: 'fish', item: 'fish-perch', difficulty: 0.5, size: 0.3, done: () => {} })), async () => { await leave(); await wait(1000); }],
    ['postcard', async () => { await lh('emit', 'postcard'); await wait(2200); }, leave],
    ['ask-sleep', async () => { await lh('emit', 'ask-sleep'); await wait(600); }, leave],
    ['sign', async () => { await lh('emit', 'dialog', 'Lantern Hollow. Mind the geese, and welcome. Fresh seeds are sold at the store each morning.'); await wait(600); }, leave],
    ['letter', async () => { await lh('emit', 'letter'); await wait(600); }, async () => { await leave(['Enter']); await wait(2500); }],
    ['finale', async () => {
      await page.evaluate(() => window.__lh.emit('finale', { lit: 7, title: 'Every lantern is lit.', lines: ['The whole village stood in the square and watched the valley glow.', 'Grandma Hollis would have said it was about time.'], rows: [['Days', '28'], ['Lanterns', '7 of 7'], ['Gold earned', '99,999,999g'], ['Friends', '6 of 6']] }, () => {}));
      await wait(600);
    }, async () => { await leave(['Enter']); }],
    ['summary', async () => { await lh('sleep'); await wait(3800); }, async () => { await leave(['Enter']); await wait(2500); await lh('setMinute', 600); await wait(400); }],
    // a day with a long shipping list and every note, the tallest tally there is
    ['summary-big', async () => {
      await page.evaluate(() => {
        const st = window.__lh.state();
        for (let i = 0; i < 40; i++) st.shipping.push({ id: ['pumpkin', 'melon', 'corn', 'tomato', 'sunflower', 'pepper'][i % 6], n: 99 });
      });
      await lh('sleep');
      await wait(3800);
    }, async () => { await leave(['Enter']); await wait(2500); await lh('setMinute', 600); await wait(400); }],
  ];

  for (const [name, open, close, canTurn = true] of states) {
    if (only.length && !only.includes(name)) continue;
    await open();
    await wait(700);
    await look(name, canTurn);
    // the letter and the finale have a second page
    if (name === 'letter' || name === 'finale') {
      await press('Enter');
      await wait(600);
      await look(`${name}-2`, canTurn);
    }
    await close();
    // closing must leave nothing open, or the next thing you press lands on the wrong pop-up
    const left = await page.evaluate(() => {
      const ui = window.__lh.game().scene.getScene('UI');
      return [ui.stack.isOpen && 'a screen', ui.modals.isOpen && 'a panel'].filter(Boolean).join(' and ');
    });
    if (left) {
      problems++;
      log(`[probe] FAIL ${name} closed: ${left} is still open`);
      for (let i = 0; i < 3; i++) await leave();
    }
  }
  log(`[probe] ${problems === 0 ? 'ok  ' : 'FAIL'} ${problems} problems in ${looked} looks at ${size.width}x${size.height}`);
  if (problems > 0) process.exitCode = 1;
};
