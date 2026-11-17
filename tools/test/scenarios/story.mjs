// The first minutes: title, new game, the letter, the first goals, a night's sleep.
//   node tools/test/probe.mjs tools/test/scenarios/story.mjs --url "http://127.0.0.1:53868/?mute=1&debug=1&new=1"
export default async ({ press, wait, shot, page, log, state }) => {
  const expect = (cond, what) => log(`[probe] ${cond ? 'ok  ' : 'FAIL'} ${what}`);
  await wait(1500);
  await press('Enter');                 // New Game
  await wait(2800);                     // fade, then the letter opens after a beat
  await shot('story-1-letter-a');
  await press('Enter');
  await wait(400);
  await shot('story-2-letter-b');
  await press('Enter');
  await wait(700);
  let st = await state();
  expect(st.player.loc === 'house', 'a new game begins inside the house');
  await shot('story-3-house');
  log(`[probe] goal check: outside=${st.flags.outside}`);
};
