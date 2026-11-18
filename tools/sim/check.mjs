// The money check, for people and for the build. Exits 1 when any line says FAIL.
//   npm run check:economy                          the real rules
//   npm run check:economy -- --defect=windfall     the same check with one bug put in on purpose
// Defects: nan-price (a price that is not a number), windfall (crops pay four times), no-forage (picking pays nothing), frozen-lake (fish pay nothing).
import { loadGame } from './load.mjs';

const arg = process.argv.slice(2).find((a) => a.startsWith('--defect='));
const defect = arg ? arg.slice('--defect='.length) : 'none';
const { mod, close } = await loadGame('/tools/sim/checks.ts');
if (!mod.DEFECTS.includes(defect)) {
  console.error(`No defect called ${defect}. Try one of: ${mod.DEFECTS.join(', ')}`);
  await close();
  process.exit(2);
}
const report = mod.runChecks(defect);
for (const r of report.results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}: ${r.detail}`);
console.log();
for (const line of report.table) console.log(line);
await close();
process.exit(report.results.every((r) => r.ok) ? 0 : 1);
