// Renders every sound effect, ambient bed and tune from code, encodes them, and writes the list the game loads.
//   npm run audio            everything
//   npm run audio -- farm    only names that contain "farm"
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR } from './dsp.mjs';
import { BEDS, SFX, renderBed, renderSfx } from './sfx.mjs';
import { TRACKS, renderTrack } from './music.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = join(root, 'tools', '.cache', 'audio');
const out = join(root, 'public', 'assets', 'audio');
const only = process.argv.slice(2);

/** Loudness each kind is balanced to, in LUFS: the tunes sit under the effects, the beds sit under the tunes. */
const LUFS_MUSIC = -21;
const LUFS_BED = { 'amb-rain': -26, 'amb-wind': -30, 'amb-crickets': -31, 'amb-birds': -31, 'amb-cave': -30, 'amb-water': -29 };

function wavBytes(left, right) {
  const ch = right ? 2 : 1;
  const n = left.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * ch * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  const s16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(s16(left[i]), o); o += 2;
    if (right) { buf.writeInt16LE(s16(right[i]), o); o += 2; }
  }
  return buf;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
  return r.stderr;
}

function integratedLufs(wav) {
  const log = ffmpeg(['-i', wav, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  const m = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(log);
  if (!m) throw new Error('no loudness in ' + log.slice(-300));
  return Number(m[1]);
}

function trimTail(sig, floor = 0.002, keepMs = 25) {
  let end = sig.length;
  while (end > 1 && Math.abs(sig[end - 1]) < floor) end--;
  end = Math.min(sig.length, end + Math.round((keepMs / 1000) * SR));
  const o = sig.slice(0, end);
  const fade = Math.min(o.length, Math.round(0.02 * SR));
  for (let i = 0; i < fade; i++) o[o.length - 1 - i] *= i / fade;
  return o;
}

function scaleTo(left, right, gain) {
  const peak = (a) => { let p = 0; for (const v of a) p = Math.max(p, Math.abs(v)); return p; };
  const p = Math.max(peak(left), right ? peak(right) : 0);
  const g = Math.min(gain, 0.93 / Math.max(p, 1e-9));
  for (let i = 0; i < left.length; i++) left[i] *= g;
  if (right) for (let i = 0; i < right.length; i++) right[i] *= g;
  return g;
}

const made = [];

function ship(kind, name, left, right, lufs) {
  const dir = join(out, kind);
  mkdirSync(dir, { recursive: true });
  mkdirSync(cache, { recursive: true });
  const wav = join(cache, `${kind}-${name}.wav`);
  writeFileSync(wav, wavBytes(left, right));
  let note = '';
  if (lufs !== undefined) {
    const now = integratedLufs(wav);
    const g = scaleTo(left, right, 10 ** ((lufs - now) / 20));
    writeFileSync(wav, wavBytes(left, right));
    note = ` ${now.toFixed(1)} -> ${(now + 20 * Math.log10(g)).toFixed(1)} LUFS`;
  }
  const big = kind !== 'sfx';
  ffmpeg(['-i', wav, '-c:a', 'libopus', '-b:a', big ? (right ? '80k' : '48k') : '48k', '-vbr', 'on', '-application', 'audio', join(dir, `${name}.opus`)]);
  ffmpeg(['-i', wav, '-c:a', 'libmp3lame', '-b:a', big ? (right ? '112k' : '64k') : '64k', join(dir, `${name}.mp3`)]);
  rmSync(wav);
  const size = statSync(join(dir, `${name}.opus`)).size + statSync(join(dir, `${name}.mp3`)).size;
  made.push({ kind, name, seconds: left.length / SR, bytes: size });
  console.log(`${kind.padEnd(5)} ${name.padEnd(14)} ${(left.length / SR).toFixed(1).padStart(5)}s ${(size / 1024).toFixed(0).padStart(5)} KB${note}`);
}

const wanted = (n) => only.length === 0 || only.some((o) => n.includes(o));
const t0 = Date.now();

for (const name of Object.keys(SFX)) if (wanted(name)) ship('sfx', name, trimTail(renderSfx(name)));
for (const name of Object.keys(BEDS)) if (wanted(name)) ship('bed', name, renderBed(name), undefined, LUFS_BED[name] ?? -30);
for (const name of Object.keys(TRACKS)) {
  if (!wanted(name)) continue;
  const s = renderTrack(TRACKS[name]);
  ship('music', name, s.l, s.r, LUFS_MUSIC);
}

// the list the game reads: every key and where its file is
if (only.length === 0) {
  const names = (k) => made.filter((m) => m.kind === k).map((m) => m.name);
  const list = (k) => names(k).map((n) => `'${n}'`).join(', ');
  const files = made.map((m) => `  { key: '${m.kind}/${m.name}', urls: ['assets/audio/${m.kind}/${m.name}.opus', 'assets/audio/${m.kind}/${m.name}.mp3'] },`).join('\n');
  const src = `// Made by tools/audio/build.mjs. Do not edit by hand.

export const SFX_NAMES = [${list('sfx')}] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export const BED_NAMES = [${list('bed')}] as const;
export type BedName = (typeof BED_NAMES)[number];

export const TRACK_NAMES = [${list('music')}] as const;
export type TrackName = (typeof TRACK_NAMES)[number];

/** Each file is listed twice, newest format first; the loader takes the first one the browser can play. */
export const AUDIO_FILES: ReadonlyArray<{ key: string; urls: readonly string[] }> = [
${files}
];
`;
  mkdirSync(join(root, 'src', 'gen'), { recursive: true });
  writeFileSync(join(root, 'src', 'gen', 'audio.ts'), src);
  const total = made.reduce((a, m) => a + m.bytes, 0);
  console.log(`\n${made.length} files, ${(total / 1048576).toFixed(1)} MB (both formats), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
