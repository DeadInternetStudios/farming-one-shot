// Films the first ten seconds: the title, the lantern bloom after New Game, the house fading in from the same warm dark, the letter,
// and the date card that opens the first morning. Needs the real title, so no skip flag in the address:
//   PORT=53868 node tools/test/probe.mjs tools/test/scenarios/opening.mjs --url "http://127.0.0.1:53868/?mute=1&debug=1&new=1" --size 390x844 --dpr 2 --touch --out /tmp/opening
export default async ({ press, wait, shot, page, log, state }) => {
  await wait(2000);
  await shot('o0-title');
  await press('Enter');
  const t0 = Date.now();
  const at = async (ms, name) => { const d = ms - (Date.now() - t0); if (d > 0) await wait(d); await shot(name); };
  await at(200, 'o1');
  await at(450, 'o2');
  await at(750, 'o3');
  await at(1100, 'o4');
  await at(1700, 'o5');
  await at(3000, 'o6');
  await press('Enter');
  await wait(400);
  await press('Enter');
  const t1 = Date.now();
  const at1 = async (ms, name) => { const d = ms - (Date.now() - t1); if (d > 0) await wait(d); await shot(name); };
  await at1(250, 'm1');
  await at1(900, 'm2');
  await at1(1800, 'm3');
  await at1(3400, 'm4');
  log('[probe] done', JSON.stringify((await state()).player.loc));
};
