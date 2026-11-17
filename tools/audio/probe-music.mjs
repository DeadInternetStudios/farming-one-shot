// Prints level facts for each tune before it is encoded: room-to-notes balance and how much the limiter bends.
import { TRACKS, renderTrack } from './music.mjs';
const only = process.argv.slice(2);
for (const name of Object.keys(TRACKS)) {
  if (only.length && !only.includes(name)) continue;
  const s = renderTrack(TRACKS[name]);
  let sum = 0, bent = 0, peak = 0;
  for (let i = 0; i < s.n; i++) {
    sum += s.l[i] * s.l[i];
    peak = Math.max(peak, Math.abs(s.l[i]));
    if (Math.abs(s.l[i]) > 0.7) bent++;
  }
  const rms = Math.sqrt(sum / s.n);
  const { dryRms, wetRms } = s.mixStats;
  const mel = s.parts.melody ?? 0;
  const mixLine = Object.entries(s.parts).filter(([k]) => k !== 'melody').map(([k, v]) => `${k} ${(v - mel).toFixed(0)}`).join('  ');
  console.log(`${name.padEnd(9)} rms ${(20 * Math.log10(rms)).toFixed(1)} dB  peak ${(20 * Math.log10(peak)).toFixed(1)} dB  crest ${(20 * Math.log10(peak / rms)).toFixed(1)} dB  bent ${(bent / s.n * 100).toFixed(3)}%  room/notes ${(20 * Math.log10(wetRms / dryRms)).toFixed(1)} dB\n          vs melody: ${mixLine}`);
}
