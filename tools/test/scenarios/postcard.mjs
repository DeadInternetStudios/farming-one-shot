// The postcard: light up the farm, press P (or use the Options page), look at the card, and keep it.
// Everything goes through the real keys, the real menu and the browser's own download (or a stand-in share sheet on a phone).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SPOTS = [[19, 11], [21, 11], [23, 11], [19, 13], [21, 13], [23, 13], [20, 12], [22, 12]];
const PIECES = ['deco-lantern-gold', 'deco-lantern-pink', 'deco-lantern-red', 'deco-stone-lantern', 'deco-lantern-teal', 'deco-planter'];
const OUT = '.100x/shots/postcard';

const png = (file) => {
  const b = readFileSync(file);
  return b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length } : null;
};

export default async ({ lh, page, press, wait, shot, state, log }) => {
  const failed = [];
  const expect = (cond, what) => {
    log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
    if (!cond) failed.push(what);
  };
  mkdirSync(OUT, { recursive: true });
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  // how many presses down the Options list the postcard row is: asked of the game by its label, so a row added above it cannot throw this off
  const rowOf = async (label) => {
    const rows = await lh('options');
    const at = rows.indexOf(label);
    if (at < 0) throw new Error(`there is no "${label}" row in Options: ${JSON.stringify(rows)}`);
    return at;
  };
  const cardOpen = () => page.evaluate(() => window.__lh.game().textures.exists('postcard-card'));
  const waitFor = async (fn, what, ms = 8000) => {
    for (let t = 0; t < ms; t += 100) {
      if (await fn()) return true;
      await wait(100);
    }
    log(`[probe] gave up waiting for ${what}`);
    return false;
  };

  // a phone has a share sheet, a computer downloads: stand in for the sheet so the phone path can be seen
  if (touch) {
    await page.evaluate(() => {
      navigator.canShare = () => true;
      navigator.share = async (d) => {
        const a = new Uint8Array(await d.files[0].arrayBuffer());
        let s = '';
        for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
        window.__shared = { n: d.files.length, name: d.files[0].name, type: d.files[0].type, title: d.title, b64: btoa(s) };
      };
    });
  }

  // lanterns on the farm, set out by hand like a player would
  await page.evaluate(() => { const st = window.__lh.state(); st.player.gold = 500; st.day = 5; });
  await lh('setMinute', 10 * 60);
  await lh('go', 'farm', 20, 13, 'down');
  await wait(900);
  const placed = new Set();
  for (const id of PIECES) {
    await lh('give', id, 1);
    for (const [x, y] of SPOTS) {
      const key = `${x},${y}`;
      if (placed.has(key)) continue;
      await lh('teleport', x, y + 1, 'up');
      await wait(120);
      const slot = (await state()).player.slots.findIndex((s) => s && s.id === id);
      if (slot < 0 || slot > 9) break;
      await page.evaluate((i) => { window.__lh.state().player.selected = i; }, slot);
      await press('e', 160);
      await wait(160);
      if ((await state()).locations.farm.objects[key]?.k === 'decor') { placed.add(key); break; }
    }
  }
  expect(placed.size === PIECES.length, `${placed.size} pieces stand on the farm`);
  await lh('teleport', 21, 13, 'down');

  // night: the lanterns are lit, and the game says once that a postcard can be taken
  await lh('weather', 'sun');
  await lh('setMinute', 21 * 60 + 30);
  await wait(2200);
  const toasts = JSON.stringify(await lh('toasts'));
  expect(/postcard/i.test(toasts), `the nudge appeared: ${toasts.slice(-120)}`);
  expect((await state()).flags.postcardNudged === true, 'and it is remembered, so it says it once');
  await shot('postcard-0-night');

  // press P: the card lies on the table
  let sent;
  if (touch) {
    // a phone has no P key: the Options page is the way in
    await press('Tab', 100);
    await waitFor(async () => (await lh('info')).paused, 'the menu');
    await wait(250);
    await press('z', 300);
    await wait(250);
    for (let i = await rowOf('Take a postcard'); i > 0; i--) await press('ArrowDown', 80);
    await wait(250);
    await shot('postcard-1-options');
    await press('Enter', 300);
  } else {
    await press('p', 150);
  }
  expect(await waitFor(cardOpen, 'the card'), 'the card is on the table');
  await wait(500);
  await shot('postcard-2-card');
  expect((await state()).flags.postcard === true, 'the game knows a postcard was taken');
  expect((await lh('info')).paused, 'the world waits while the card is open');
  expect(!(await lh('toasts').then((t) => /would not focus/.test(JSON.stringify(t)))), 'the camera did not complain');

  // keep it
  const file = '/tmp/lantern-hollow-probe-postcard.png';
  if (touch) {
    await press('Enter', 200);
    await waitFor(() => page.evaluate(() => Boolean(window.__shared)), 'the share sheet');
    sent = await page.evaluate(() => window.__shared);
    expect(sent && sent.n === 1 && sent.type === 'image/png' && sent.title === 'Cozy Farming Simulator MVP', `the share sheet got ${sent && `${sent.n} ${sent.type} ${sent.name}`}`);
    if (sent) writeFileSync(file, Buffer.from(sent.b64, 'base64'));
  } else {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), press('Enter', 100)]);
    await download.saveAs(file);
    expect(download.suggestedFilename() === 'cozy-farming-simulator-mvp-spring-5.png', `the file is called ${download.suggestedFilename()}`);
  }
  const info = png(file);
  expect(info && info.w >= 700 && info.w <= 1250 && info.h >= 600, `a real picture: ${JSON.stringify(info)}`);
  copyFileSync(file, `${OUT}/card-${touch ? 'phone' : 'desktop'}-1.png`);
  await wait(300);
  await shot('postcard-3-kept');

  // turn the screen: the card must still be there
  const size = page.viewportSize();
  if (size) {
    await page.setViewportSize({ width: size.height, height: size.width });
    await wait(900);
    expect(await cardOpen(), 'the card survives turning the screen');
    await shot('postcard-4-turned');
    await page.setViewportSize(size);
    await wait(900);
    expect(await cardOpen(), 'and turning it back');
  }

  // close it: the world carries on
  await press('Escape', 300);
  expect(await waitFor(async () => !(await cardOpen()), 'the card to leave'), 'Escape puts the card away');
  expect(await waitFor(async () => !(await lh('info')).paused, 'the world to wake'), 'and the world wakes up again');

  // the second way in: the Options page closes the menu first, so the picture is the valley and not the menu
  await lh('teleport', 22, 13, 'down');
  await wait(300);
  await press('Tab', 100);
  await waitFor(async () => (await lh('info')).paused, 'the menu');
  await wait(250);
  await press('z', 300);
  await wait(250);
  for (let i = await rowOf('Take a postcard'); i > 0; i--) await press('ArrowDown', 80);
  await wait(250);
  await press('Enter', 300);
  expect(await waitFor(cardOpen, 'the second card'), 'the Options page takes a postcard too');
  await wait(500);
  await shot('postcard-5-from-options');
  let second = null;
  if (touch) await press('Enter', 200);
  else [second] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), press('Enter', 100)]);
  if (second) {
    await second.saveAs('/tmp/lantern-hollow-probe-postcard-2.png');
    copyFileSync('/tmp/lantern-hollow-probe-postcard-2.png', `${OUT}/card-desktop-2.png`);
  }
  await press('Escape', 300);

  // the camera while something else is open does nothing
  await press('Tab', 100);
  await waitFor(async () => (await lh('info')).paused, 'the menu');
  await wait(250);
  await press('p', 200);
  await wait(900);
  expect(!(await cardOpen()), 'P does nothing while the menu is open');
  await press('Escape', 300);
  log('[probe] touch device:', touch);
  if (failed.length > 0) throw new Error(`${failed.length} checks failed: ${failed.join('; ')}`);
};
