// Checks what the sound system decides, without listening: which tune, which background sounds, what is loaded.
// Run with the sound switched on in the page (no ?mute) and the browser itself muted:
//   node tools/test/probe.mjs tools/test/scenarios/audio.mjs --url "http://127.0.0.1:53868/?debug=1&new=1"
export default async ({ lh, press, wait, log, page }) => {
  const snap = async (label) => {
    const a = await lh('audio');
    log(`[probe] ${label}: tune=${a.tune ? `${a.tune.name}@${a.tune.volume}` : '-'} leaving=[${a.leaving}] beds=${JSON.stringify(a.beds)} ctx=${a.context}`);
    log(`[probe]    loaded=${a.loaded.filter((k) => k.startsWith('music/')).join(',')} pending=[${a.pending}] failed=[${a.failed}]`);
    return a;
  };
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);

  await page.mouse.click(640, 360);
  await press('ArrowDown');
  await wait(2500);
  let a = await snap('morning on the farm');
  expect(a.context === 'running', 'the audio engine is running after a key press');
  expect(a.tune?.name === 'farm', 'farm tune plays on the farm');
  expect(a.tune && a.tune.volume > 0.3, 'the tune has faded up');
  expect((a.beds['amb-birds'] ?? 0) > 0.05, 'birds sing on a spring morning');
  expect(a.beds['amb-crickets'] === undefined, 'no crickets in the morning');

  await lh('weather', 'rain');
  await wait(3000);
  a = await snap('rain');
  expect((a.beds['amb-rain'] ?? 0) > 0.2, 'rain is heard');
  expect(a.beds['amb-birds'] === undefined || a.beds['amb-birds'] < 0.1, 'birds go quiet in the rain');

  await lh('weather', 'sun');
  await lh('setMinute', 21 * 60);
  await wait(3500);
  a = await snap('21:00 outdoors');
  expect(a.tune?.name === 'night' || a.leaving.includes('farm'), 'the night tune takes over');
  expect((a.beds['amb-crickets'] ?? 0) > 0.1, 'crickets at night');

  await lh('go', 'house', 4, 5);
  await wait(4500);
  a = await snap('indoors at night');
  expect(a.tune?.name === 'home', 'the house has its own tune');
  expect(a.beds['amb-crickets'] === undefined || a.beds['amb-crickets'] < 0.05, 'crickets stay outside');

  await lh('setMinute', 9 * 60);
  await lh('go', 'farm', 28, 1.2);
  await wait(1500);
  await lh('go', 'forest', 19, 36);
  await wait(5000);
  a = await snap('forest');
  expect(a.tune?.name === 'forest' || a.pending.includes('music/forest'), 'the forest tune is on its way or playing');
  await wait(4000);
  a = await snap('forest, later');
  expect(a.tune?.name === 'forest', 'the forest tune plays once it has loaded');

  await lh('go', 'mine-1', 4, 4);
  await wait(6000);
  a = await snap('mine');
  expect(a.tune?.name === 'mine', 'mine tune');
  expect((a.beds['amb-cave'] ?? 0) > 0.3, 'cave hum');

  await lh('sfx', 'coin');
  await lh('sfx', 'nope');
  a = await snap('after two effects');
  expect(a.played.coin === 1 && a.played.nope === 1, 'effects reach the speakers');

  await lh('sleep');
  await wait(2500);
  a = await snap('going to sleep');
  expect(a.sleeping, 'sleep ducks the sound');
  expect(a.tune && a.tune.volume < 0.15, 'the tune is turned down while asleep');
  expect(a.played.sleep === 1, 'the sleep sound played');

  const loaded = a.loaded.filter((k) => k.startsWith('music/')).length;
  expect(loaded <= 5, `at most five tunes are kept in memory (have ${loaded})`);
};
