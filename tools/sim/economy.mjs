// Plays the farm with a few kinds of player and prints how the money moves. `npm run sim`.
//   npm run sim                 the table for each player
//   npm run sim -- --days       also every day
//   npm run sim -- --write      save the summary to .100x/must-not-break/game-economy-sim.txt
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadGame } from './load.mjs';

const args = new Set(process.argv.slice(2));
const { mod, close } = await loadGame('/tools/sim/farmer.ts');

const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };

const MILESTONES = [
  ['a cat', 250],
  ['the coop', 1200],
  ['a bigger bag', 1500],
  ['a copper tool', 500],
  ['a silver tool', 1500],
  ['a gold tool', 5000],
];

for (const key of ['casual', 'steady', 'keen']) {
  const profile = mod.PROFILES[key];
  const run = mod.playFarm(profile, 28, 1);
  out(`${profile.name}: up to ${profile.maxField} tiles, ${profile.workMin} minutes a day on the farm`);
  const at = (d) => run.days[d - 1];
  const earnedTo = (d) => run.days.slice(0, d).reduce((a, r) => a + r.earned, 0);
  out(`  gold at the end of day  7: ${at(7).gold}   14: ${at(14).gold}   21: ${at(21).gold}   28: ${at(28).gold}`);
  out(`  earned by day 7: ${earnedTo(7)}   14: ${earnedTo(14)}   21: ${earnedTo(21)}   28: ${earnedTo(28)}`);
  const peak = run.days.reduce((a, r) => (r.tiles > a.tiles ? r : a), run.days[0]);
  out(`  most crops growing: ${peak.tiles} on day ${peak.day}`);
  const first = (n) => run.days.find((r) => r.gold >= n)?.day;
  out(`  first day with: ${MILESTONES.map(([w, n]) => `${n}g (${w}) ${first(n) ?? 'never'}`).join(', ')}`);
  const thirsty = run.days.filter((r) => r.note.includes('thirsty')).length;
  const noTime = run.days.filter((r) => r.note.includes('no time')).length;
  const withered = run.days.reduce((a, r) => a + r.withered, 0);
  out(`  days with thirsty crops: ${thirsty}, days too short for the store: ${noTime}, crops withered: ${withered}`);
  const farmDays = run.days.filter((r) => r.note !== 'winter');
  out(`  seeds bought: ${run.days.reduce((a, r) => a + r.spent, 0)}g, lowest gold in hand: ${Math.min(...run.days.map((r) => r.gold))}g, best day: ${Math.max(...run.days.map((r) => r.earned))}g`);
  out(`  average on a farm day: ${Math.round(farmDays.reduce((a, r) => a + r.earned, 0) / farmDays.length)}g`);
  if (args.has('--days')) {
    out('  day  gold  paid  seeds  tiles  planted  harvested  energy  mins  note');
    for (const r of run.days) out(`  ${String(r.day).padStart(3)} ${String(r.gold).padStart(5)} ${String(r.earned).padStart(5)} ${String(r.spent).padStart(6)} ${String(r.tiles).padStart(6)} ${String(r.planted).padStart(8)} ${String(r.harvested).padStart(10)} ${String(r.energyLeft).padStart(7)} ${String(r.minutesLeft).padStart(5)}  ${r.note}`);
  }
  out();
}

if (args.has('--write')) {
  mkdirSync('.100x/must-not-break', { recursive: true });
  writeFileSync('.100x/must-not-break/game-economy-sim.txt', lines.join('\n') + '\n');
  console.log('wrote .100x/must-not-break/game-economy-sim.txt');
}
await close();
