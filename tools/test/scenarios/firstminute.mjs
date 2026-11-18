// The first-minute hints retire as each thing is done, and the farm remembers it: walk, use, open the bag.
//   node tools/test/probe.mjs tools/test/scenarios/firstminute.mjs
export default async ({ wait, hold, press, state, log, lh }) => {
  await wait(1200);
  const notes = async () => {
    const s = await state();
    return { walk: s.flags.taughtWalk === true, use: s.flags.taughtUse === true, menu: s.flags.taughtMenu === true };
  };
  const expectNotes = async (what, want) => {
    const got = await notes();
    log(`[probe] ${what}: ${JSON.stringify(got)}`);
    for (const k of Object.keys(want)) if (got[k] !== want[k]) throw new Error(`${what}: ${k} should be ${want[k]}`);
  };
  await expectNotes('on a new farm', { walk: false, use: false, menu: false });
  await hold('ArrowRight', 300);
  await expectNotes('after walking', { walk: true, use: false, menu: false });
  await press('Space', 200);
  await expectNotes('after using what is in hand', { walk: true, use: true, menu: false });
  await press('Tab', 600);
  await expectNotes('after opening the bag', { walk: true, use: true, menu: true });
  if (!(await lh('info')).paused) throw new Error('the bag did not open');
};
