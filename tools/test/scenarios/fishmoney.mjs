// How much does an hour at the dock pay? Fish with real key presses for a while, win the fights with a
// simple bot, and report what came in against the game minutes and energy it used.
const PRICE = { 'fish-minnow': 20, 'fish-perch': 35, 'fish-carp': 45, 'fish-trout': 60, 'fish-eel': 90, 'fish-koi': 300 };
const SECONDS = Number(process.env.FISH_SECONDS ?? 90);

export default async ({ lh, press, wait, state, page, log }) => {
  await lh('setMinute', 7 * 60);
  await lh('give', 'rod', 1);
  await lh('go', 'lake', 24, 14, 'right');
  await wait(900);
  const st0 = await state();
  const slot = st0.player.slots.findIndex((s) => s && s.id === 'rod');
  await press(String((slot + 1) % 10), 200);
  const minute0 = st0.minute;
  const energy0 = st0.player.energy;
  const t0 = Date.now();
  let casts = 0;
  let fights = 0;
  let won = 0;
  const fightMs = [];
  const fightMinutes = [];
  while ((Date.now() - t0) / 1000 < SECONDS) {
    await press('e', 100);
    casts++;
    let bit = false;
    for (let i = 0; i < 160; i++) {
      const f = await lh('fish');
      if (f.phase === 'bite') { bit = true; break; }
      if (f.phase === 'none' && i > 6) break;
      await wait(60);
    }
    if (!bit) continue;
    await press('e', 150);
    await wait(300);
    const fightStart = Date.now();
    const m1 = (await state()).minute;
    let held = false;
    let prev = null;
    let outcome = null;
    for (let i = 0; i < 1200; i++) {
      const s = await page.evaluate(() => {
        const f = window.__fight;
        return f ? { fish: f.fish, zone: f.zone, state: f.state, p: f.progress } : null;
      });
      if (!s) { if (i > 5) break; await wait(40); continue; }
      if (s.state !== 'on') { outcome = s.state; break; }
      const vel = prev === null ? 0 : (s.zone - prev) / 0.05;
      prev = s.zone;
      const want = s.fish - s.zone - vel * 0.22 > 0;
      if (want && !held) { await page.keyboard.down('e'); held = true; }
      else if (!want && held) { await page.keyboard.up('e'); held = false; }
      await wait(45);
    }
    if (held) await page.keyboard.up('e');
    fights++;
    if (outcome === 'won') won++;
    fightMs.push(Date.now() - fightStart);
    fightMinutes.push((await state()).minute - m1);
    await wait(1100);
  }
  const st = await state();
  const secs = (Date.now() - t0) / 1000;
  const gold = st.player.slots.reduce((a, s) => a + (s && PRICE[s.id] ? PRICE[s.id] * s.n : 0), 0);
  const gameMin = st.minute - minute0;
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  log(`casts ${casts} bites ${fights} landed ${won} caught ${st.stats.caught}`);
  log(`real ${secs.toFixed(0)}s, game minutes ${gameMin}, energy used ${energy0 - st.player.energy}`);
  log(`fight avg ${avg(fightMs)}ms, game minutes during fights ${avg(fightMinutes)} each`);
  log(`fish worth ${gold}g, so ${(gold / secs).toFixed(1)}g per real second, ${(gold / Math.max(1, gameMin)).toFixed(2)}g per game minute`);
  const dayMinutes = 20 * 60;
  log(`a full day of ${dayMinutes} game minutes at that rate: ${Math.round((gold / Math.max(1, gameMin)) * dayMinutes)}g`);
};
