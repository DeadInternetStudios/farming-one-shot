import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { runChecks } from '../tools/sim/checks';

const RUN = { timeout: 60_000 };

describe('the money check (npm run check:economy)', () => {
  it('passes on the real rules', RUN, () => {
    expect(runChecks('none').results.filter((r) => !r.ok)).toEqual([]);
  });

  // The check is only worth having if it goes red. Each defect is put in on purpose and must fail the line that names it, with exit code 1.
  const cases = [
    ['nan-price', 'every number stays a real number'],
    ['windfall', 'the first week is a start, not a windfall'],
    ['no-forage', 'a broke farmer can start over'],
  ] as const;
  for (const [defect, line] of cases) {
    it(`fails the line "${line}" and exits 1 when ${defect} is put in`, RUN, () => {
      const run = spawnSync(process.execPath, ['tools/sim/check.mjs', `--defect=${defect}`], { encoding: 'utf8' });
      expect(run.status).toBe(1);
      expect(run.stdout).toContain(`FAIL ${line}`);
    });
  }

  it('turns away a defect it does not know instead of passing', RUN, () => {
    const run = spawnSync(process.execPath, ['tools/sim/check.mjs', '--defect=nope'], { encoding: 'utf8' });
    expect(run.status).toBe(2);
  });
});
