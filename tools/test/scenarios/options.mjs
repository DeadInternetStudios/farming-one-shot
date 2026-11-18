// The Options page: calm motion, backing up the farm to a file, and restoring it from one.
// Everything goes through the real menu and the browser's own download and file-picker events.
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = 'lantern-hollow:save:v1';

export default async ({ lh, page, press, wait, shot, state, log }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  // start the way a player does, without the probe's new-game flag, so the restart after a restore can continue from the save
  await page.goto(page.url().replace('&new=1', ''), { waitUntil: 'load' });
  await wait(1500);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await page.evaluate(() => { const st = window.__lh.state(); st.player.gold = 777; st.day = 5; });
  await lh('setMinute', 10 * 60);
  await wait(300);

  // the list starts on its first row each time the menu opens
  let cur = 0;
  const openOptions = async () => {
    await press('Tab', 100);
    for (let i = 0; i < 50 && !(await lh('info')).paused; i++) await wait(100); // the first build can stall a moment
    await wait(200);
    await press('z', 300); // one step back from Bag wraps round to Options
    await wait(200);
    cur = 0;
  };
  await openOptions();
  await shot('options-1-list');

  // the list, top to bottom
  const rows = touch
    ? ['Controls', 'Music', 'Sounds', 'Day length', 'Screen shake', 'Calm motion', 'Larger interface', 'Controls side', 'Take a postcard', 'Back up your farm', 'Restore a backup', 'Save game', 'Back to title']
    : ['Controls', 'Music', 'Sounds', 'Day length', 'Screen shake', 'Calm motion', 'Larger interface', 'Take a postcard', 'Back up your farm', 'Restore a backup', 'Save game', 'Back to title'];
  const go = async (name) => {
    const to = rows.indexOf(name);
    for (let i = 0; i < (to - cur + rows.length) % rows.length; i++) await press('ArrowDown', 60);
    cur = to;
    await wait(200);
  };

  // calm motion
  await go('Calm motion');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-hollow:settings') ?? '{}'));
  await press('Enter', 300);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lantern-hollow:settings') ?? '{}'));
  expect(Boolean(after.calm) !== Boolean(before.calm), `calm motion flipped ${before.calm} -> ${after.calm}`);
  await shot('options-2-calm');
  await press('Enter', 300);

  // back up the farm: a real download
  await go('Back up your farm');
  await shot('options-3-backup');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), press('Enter', 100)]);
  const file = '/tmp/lantern-hollow-probe-backup.json';
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(download.suggestedFilename() === 'lantern-hollow-day-5.json', `the file is called ${download.suggestedFilename()}`);
  expect(backup.game === 'lantern-hollow' && backup.save.player.gold === 777 && backup.save.day === 5, 'the file holds this farm');

  // a different farm in a different file, then restore it
  backup.save.player.gold = 4242;
  backup.save.day = 9;
  const other = '/tmp/lantern-hollow-probe-restore.json';
  writeFileSync(other, JSON.stringify(backup));
  await go('Restore a backup');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), press('Enter', 100)]);
  await chooser.setFiles(other);
  await wait(350);
  // the page reloads itself 900 ms after a restore, which can land in the middle of a slow screenshot
  await shot('options-4-restored').catch(() => log('[probe] (the page restarted during the screenshot)'));
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
  expect(stored && stored.player.gold === 4242 && stored.day === 9, 'the restored farm is the saved game');

  // the running game must not write over it on its way out
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(200);
  const still = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
  expect(still && still.player.gold === 4242, 'leaving the page does not save the old farm over it');

  // the game starts itself again from that save a moment later
  await page.waitForFunction(() => window.__lh && window.__lh.state().day === 9, null, { timeout: 20000 }).then(
    () => expect(true, 'the game restarted by itself'),
    () => expect(false, 'the game restarted by itself'),
  );
  await wait(1500);
  const back = await state();
  expect(back.player.gold === 4242 && back.day === 9, `and it continues from the backup: gold ${back.player.gold}, day ${back.day}`);
  await shot('options-5-continued');
  // a junk file is refused with a plain sentence, leaving the save alone
  await openOptions();
  await go('Restore a backup');
  const junk = '/tmp/lantern-hollow-probe-junk.json';
  writeFileSync(junk, '{"hello": "world"}');
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), press('Enter', 100)]);
  await chooser2.setFiles(junk);
  await wait(500);
  await shot('options-6-refused');
  const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
  expect(kept && kept.player.gold === 4242, 'a junk file leaves the save alone');
  log('[probe] touch device:', touch);
};
