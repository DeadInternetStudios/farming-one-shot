// A monkey at the keyboard: walks, swings, switches tools, opens the menu and wanders between places in
// every season. It has no goal. It is here to find the crash nobody thought to look for.
//   MONKEY_SECONDS=40 MONKEY_SEED=3 PORT=... node tools/test/probe.mjs tools/test/scenarios/monkey.mjs
const SECONDS = Number(process.env.MONKEY_SECONDS ?? 40);
let seed = Number(process.env.MONKEY_SEED ?? 1) * 2654435761;
const rand = () => { seed = (seed ^ (seed << 13)) >>> 0; seed = (seed ^ (seed >>> 17)) >>> 0; seed = (seed ^ (seed << 5)) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];

const PLACES = [
  ['farm', 28, 14], ['farm', 12, 16], ['village', 3, 12], ['village', 24, 12], ['lake', 24, 14], ['forest', 20, 36], ['forest', 20, 9],
  ['mine-1', 4, 4], ['mine-3', 4, 4], ['house', 4, 5],
];
const MOVES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const DAYS = [3, 10, 17, 24, 28];

export default async ({ lh, page, press, hold, wait, state, log, shot }) => {
  await page.evaluate(() => {
    const st = window.__lh.state();
    for (const id of ['mirren', 'ida', 'bram', 'tam', 'wren', 'olwen']) {
      st.social[id] = { points: 300, met: true, talkedDay: 0, giftedDay: 0, giftsWeek: 0, weekStart: 0, claimed: [] };
    }
    st.player.gold = 3000;
    for (const [id, n] of [['rod', 1], ['seed-radish', 20], ['seed-potato', 10], ['hay', 6], ['copperOre', 12], ['coal', 6], ['wood', 30], ['stone', 30], ['furnace', 1], ['chest', 1], ['sprinkler', 2], ['flower', 5], ['egg', 3]]) window.__lh.give(id, n);
  });
  const t0 = Date.now();
  let steps = 0;
  let dayIdx = 0;
  while ((Date.now() - t0) / 1000 < SECONDS) {
    steps++;
    const r = rand();
    if (steps % 40 === 0) {
      await lh('setDay', DAYS[dayIdx++ % DAYS.length]);
      await lh('setMinute', 8 * 60 + Math.floor(rand() * 600));
    }
    if (steps % 12 === 0) {
      const [map, x, y] = pick(PLACES);
      await lh('go', map, x, y, 'down');
      await wait(500);
    } else if (r < 0.4) await hold(pick(MOVES), 120 + Math.floor(rand() * 600));
    else if (r < 0.62) await press('KeyE', 60);
    else if (r < 0.75) await press(pick(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']), 50);
    else if (r < 0.84) {
      await press('Tab', 200);
      for (let i = 0; i < 4; i++) await press(pick(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyE']), 90);
      await press('Escape', 150);
    } else if (r < 0.9) await press('KeyF', 60);
    else if (r < 0.95) await press(pick(['KeyQ', 'KeyR']), 50);
    else await press('Escape', 80);
    if (steps % 25 === 0) {
      // close anything left open, so the walk goes on
      await press('Escape', 120);
      await press('Escape', 120);
    }
  }
  const st = await state();
  log(`[probe] monkey did ${steps} things, now day ${st.day} at ${st.player.loc}, gold ${st.player.gold}, energy ${Math.round(st.player.energy)}`);
  await shot('monkey-end');
};
