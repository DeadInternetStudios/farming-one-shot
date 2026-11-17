// Checks the files the game will actually play, by numbers only (nothing is ever played on this machine).
//   npm run audio:check        prints one line per file and a list of problems; exits 1 when there are any
//   npm run audio:check -- farm   only names that contain "farm"
// Spectrogram pictures land in .100x/shots/audio/ so the tunes can be looked at instead of heard.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chord, midi } from './dsp.mjs';
import { TRACKS } from './music.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const audioDir = join(root, 'public', 'assets', 'audio');
const picDir = join(root, '.100x', 'shots', 'audio');
const only = process.argv.slice(2);
const SR = 44100;
mkdirSync(picDir, { recursive: true });

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error(`cannot decode ${file}: ${r.stderr}`);
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
  const n = f.length >> 1;
  const l = new Float32Array(n), rr = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = f[2 * i]; rr[i] = f[2 * i + 1]; }
  return { l, r: rr, n };
}

function lufs(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(r.stderr);
  const tp = /True peak:\s+Peak:\s+(-?[\d.]+) dBFS/.exec(r.stderr);
  return { lufs: m ? Number(m[1]) : NaN, truePeak: tp ? Number(tp[1]) : NaN };
}

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Average power spectrum over the whole file. */
function spectrum(x, size, maxFrames = 400) {
  const power = new Float64Array(size / 2);
  const hop = size / 2;
  const frames = Math.max(1, Math.floor((x.length - size) / hop));
  const stride = Math.max(1, Math.floor(frames / maxFrames));
  const win = new Float64Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const re = new Float64Array(size), im = new Float64Array(size);
  let used = 0;
  for (let f = 0; f < frames; f += stride) {
    for (let i = 0; i < size; i++) { re[i] = (x[f * hop + i] ?? 0) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < size / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    used++;
  }
  for (let k = 0; k < power.length; k++) power[k] /= Math.max(1, used);
  return power;
}

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

function basics(a) {
  const n = a.n;
  let peak = 0, sumSq = 0, sumL = 0, sumR = 0, clipped = 0, dot = 0, ll = 0, rrr = 0;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = a.l[i], r = a.r[i];
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    if (Math.abs(l) >= 0.999 || Math.abs(r) >= 0.999) clipped++;
    sumSq += (l * l + r * r) / 2;
    sumL += l; sumR += r;
    dot += l * r; ll += l * l; rrr += r * r;
    mono[i] = (l + r) / 2;
  }
  return { peak, rms: Math.sqrt(sumSq / n), dc: Math.max(Math.abs(sumL / n), Math.abs(sumR / n)), clipped, corr: dot / Math.sqrt(Math.max(ll * rrr, 1e-12)), mono };
}

function tone(mono) {
  const size = 4096;
  const p = spectrum(mono, size);
  let total = 0, weighted = 0, hi4 = 0, hi8 = 0, low = 0;
  for (let k = 1; k < p.length; k++) {
    const f = (k * SR) / size;
    total += p[k]; weighted += p[k] * f;
    if (f > 4000) hi4 += p[k];
    if (f > 8000) hi8 += p[k];
    if (f < 80) low += p[k];
  }
  return { centroid: weighted / Math.max(total, 1e-12), above4k: hi4 / total, above8k: hi8 / total, below80: low / total };
}

function chroma(mono) {
  const size = 16384;
  const p = spectrum(mono, size, 200);
  const c = new Float64Array(12);
  for (let k = 1; k < p.length; k++) {
    const f = (k * SR) / size;
    if (f < 60 || f > 2400) continue;
    const m = 69 + 12 * Math.log2(f / 440);
    const pc = ((Math.round(m) % 12) + 12) % 12;
    const off = Math.abs(m - Math.round(m));
    if (off < 0.35) c[pc] += p[k];
  }
  const sum = c.reduce((a, b) => a + b, 0);
  return Array.from(c, (v) => v / Math.max(sum, 1e-12));
}

function keyOf(spec) {
  const set = new Set();
  for (const name of spec.chords) for (const m of chord(name, 4)) set.add(((m % 12) + 12) % 12);
  const addLine = (line) => { for (const tok of line.trim().split(/\s+/)) { const n = tok.split(':')[0]; if (n && n !== 'r') set.add(midi(n) % 12); } };
  for (const l of spec.melody?.lines ?? []) addLine(l);
  for (const l of spec.counter?.lines ?? []) addLine(l);
  for (const n of spec.sparkle?.notes ?? []) set.add(midi(n) % 12);
  return set;
}

/** The step across the loop point, compared with the biggest steps right next to it. A click would be far bigger. */
function seam(a) {
  const n = a.n;
  let near = 1e-9;
  for (let i = 2; i < 200; i++) {
    near = Math.max(near, Math.abs(a.l[i] - a.l[i - 1]), Math.abs(a.r[i] - a.r[i - 1]));
    near = Math.max(near, Math.abs(a.l[n - i] - a.l[n - i - 1]), Math.abs(a.r[n - i] - a.r[n - i - 1]));
  }
  const jump = Math.max(Math.abs(a.l[0] - a.l[n - 1]), Math.abs(a.r[0] - a.r[n - 1]));
  return { jumpRatio: jump / near, jump };
}

const problems = [];
const bad = (file, msg) => { problems.push(`${file}: ${msg}`); };
const rows = [];

function list(kind) {
  return readdirSync(join(audioDir, kind)).filter((f) => f.endsWith('.opus')).map((f) => f.replace('.opus', '')).filter((n) => only.length === 0 || only.some((o) => n.includes(o)));
}

for (const kind of ['sfx', 'bed', 'music']) {
  for (const name of list(kind)) {
    const label = `${kind}/${name}`;
    const opus = join(audioDir, kind, `${name}.opus`);
    const mp3 = join(audioDir, kind, `${name}.mp3`);
    const a = decode(opus);
    const b = decode(mp3);
    const s = basics(a);
    const t = tone(s.mono);
    const L = lufs(opus);
    const seconds = a.n / SR;
    const row = { label, seconds, peak: db(s.peak), rms: db(s.rms), lufs: L.lufs, tp: L.truePeak, centroid: t.centroid, hi8: t.above8k * 100, corr: s.corr };

    if (s.clipped > 0) bad(label, `${s.clipped} clipped samples`);
    if (s.peak > 0.98) bad(label, `peak ${db(s.peak).toFixed(1)} dBFS is too hot`);
    if (s.dc > (kind === 'sfx' ? 0.02 : 0.004)) bad(label, `DC offset ${s.dc.toFixed(4)}`);
    if (Math.abs(a.n - b.n) / SR > 0.08) bad(label, `opus and mp3 lengths differ by ${(Math.abs(a.n - b.n) / SR * 1000).toFixed(0)} ms`);
    if (t.above8k > (kind === 'music' ? 0.03 : 0.08)) bad(label, `${(t.above8k * 100).toFixed(1)}% of the energy is above 8 kHz (harsh)`);
    if (t.below80 > (kind === 'music' ? 0.4 : 0.5)) bad(label, `${(t.below80 * 100).toFixed(0)}% of the energy is under 80 Hz (small speakers will not play it)`);

    if (kind === 'sfx') {
      let first = 0;
      while (first < a.n && Math.abs(a.l[first]) < 0.01) first++;
      row.onsetMs = (first / SR) * 1000;
      if (row.onsetMs > 30) bad(label, `starts ${row.onsetMs.toFixed(0)} ms late`);
      if (seconds > 4) bad(label, `is ${seconds.toFixed(1)} s long`);
      let last = 0;
      for (let i = a.n - Math.round(0.002 * SR); i < a.n; i++) last = Math.max(last, Math.abs(a.l[i]));
      if (last > 0.01) bad(label, 'ends with a click');
    } else {
      const sm = seam(a);
      row.seam = sm.jumpRatio;
      row.jump = db(sm.jump);
      // very quiet material has tiny steps, so the codec's own noise can be a few times bigger; only a step you could hear counts
      if (sm.jumpRatio > 2.5 && sm.jump > 0.004) bad(label, `loop point steps ${sm.jumpRatio.toFixed(1)}x the biggest step beside it, ${db(sm.jump).toFixed(0)} dBFS (a click)`);
      if (kind === 'music') {
        if (Math.abs(L.lufs - -21) > 1.5) bad(label, `loudness ${L.lufs} LUFS is off target`);
        if (t.centroid < 250 || t.centroid > 2600) bad(label, `centroid ${t.centroid.toFixed(0)} Hz sounds ${t.centroid < 250 ? 'dull' : 'shrill'}`);
        if (s.corr < 0.2) bad(label, `left and right barely agree (${s.corr.toFixed(2)}), mono will thin out`);
        const key = keyOf(TRACKS[name]);
        const c = chroma(s.mono);
        const inKey = c.reduce((acc, v, i) => (key.has(i) ? acc + v : acc), 0);
        row.inKey = inKey * 100;
        row.notes = key.size;
        if (inKey < 0.88) bad(label, `only ${(inKey * 100).toFixed(0)}% of the pitch energy is in the notes the score uses`);
      }
    }
    rows.push(row);

    if (kind !== 'sfx') {
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', opus, '-lavfi', 'showspectrumpic=s=960x300:legend=0:scale=log:color=intensity', join(picDir, `${kind}-${name}.png`)]);
    }
  }
}

const f = (v, d = 1, w = 6) => (v === undefined || Number.isNaN(v) ? ''.padStart(w) : v.toFixed(d).padStart(w));
console.log('file                   secs   peak    rms   LUFS   tpeak centroid  >8k%   corr  extra');
for (const r of rows) {
  const extra = r.onsetMs !== undefined ? `onset ${r.onsetMs.toFixed(0)}ms` : `seam x${f(r.seam, 2, 0)} (${f(r.jump, 0, 0)} dBFS)${r.inKey ? ` inKey ${r.inKey.toFixed(0)}% of ${r.notes} notes` : ''}`;
  console.log(`${r.label.padEnd(20)} ${f(r.seconds, 1, 6)} ${f(r.peak)} ${f(r.rms)} ${f(r.lufs)} ${f(r.tp)} ${f(r.centroid, 0, 8)} ${f(r.hi8, 2)} ${f(r.corr, 2)}  ${extra}`);
}
console.log(problems.length ? `\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}` : '\nNo problems found.');
process.exit(problems.length ? 1 : 0);
