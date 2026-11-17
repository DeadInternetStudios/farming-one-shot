// Ten short loops of music, written as chords and melody lines and played by the instruments in dsp.mjs.
import {
  SR, Stereo, bass, bell, brush, chord, felt, flute, hz, kick, midi, noteHz, pad, pluck, reed, reverb, rim, rng, shaker, softclip,
} from './dsp.mjs';

const TAU = Math.PI * 2;

/** Turn 'C5:1 E5:.5 r:.5' into events with a start beat and length. */
function parseLine(line) {
  const out = [];
  let beat = 0;
  for (const tok of line.trim().split(/\s+/)) {
    if (!tok) continue;
    const [n, d = '1'] = tok.split(':');
    const len = Number(d);
    if (n !== 'r') out.push({ note: n, beat, len });
    beat += len;
  }
  return { events: out, beats: beat };
}

const INST = {
  pluck: (f, len, v, seed) => pluck(f, len * 1.5, v),
  felt: (f, len, v) => felt(f, len * 1.4, v),
  bell: (f, len, v) => bell(f, Math.max(1.2, len * 1.3), v),
  flute: (f, len, v, seed) => flute(f, len, v, seed),
  reed: (f, len, v) => reed(f, len, v),
};

/**
 * Render one loop. Two passes are played so the reverb tail from the end of the loop rolls into the start,
 * and the second pass is kept: the file then repeats with no seam.
 */
export function renderTrack(spec) {
  let r = rng(spec.seed ?? 7);
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const bars = spec.chords.length;
  const loopSec = bars * bar;
  const total = loopSec * 2 + 4;
  const dry = new Stereo(total);
  const send = new Float32Array(dry.n);
  const energy = {};
  let passStart = 0;
  const put = (sig, t0, gain, pan, wet, part = 'other') => {
    // a note nudged to start before its pass would be cut in half where the loop begins
    const t = Math.max(t0, passStart);
    let e = 0;
    for (let i = 0; i < sig.length; i++) e += sig[i] * sig[i];
    energy[part] = (energy[part] ?? 0) + e * gain * gain;
    dry.add(sig, t, gain, pan);
    const s = Math.round(t * SR);
    const g = gain * wet;
    for (let i = 0; i < sig.length && s + i < send.length; i++) send[s + i] += sig[i] * g;
  };
  const jitter = () => (r() - 0.5) * 0.014;

  for (let pass = 0; pass < 2; pass++) {
    // the same dice both times round, so the notes that ring over the loop point are the ones that really come next
    r = rng(spec.seed ?? 7);
    passStart = pass * loopSec;
    for (let b = 0; b < bars; b++) {
      const t0 = (pass * bars + b) * bar;
      const name = spec.chords[b];
      const notes = chord(name, spec.pad?.oct ?? 4);

      if (spec.pad) {
        for (const m of notes) put(pad(hz(m), bar * (spec.pad.hold ?? 1), spec.pad.vol), t0, 1, (r() - 0.5) * 0.7, spec.pad.send ?? 0.6, 'pad');
      }

      if (spec.bass) {
        const root = chord(name, 2)[0];
        const fifth = root + 7;
        const style = spec.bass.style;
        const v = spec.bass.vol;
        if (style === 'drone') put(bass(hz(root), bar * 1.1, v), t0, 1, 0, 0.3, 'bass');
        else if (style === 'root') put(bass(hz(root), beat * 1.6, v), t0, 1, 0, 0.2, 'bass');
        else if (style === 'oompah') {
          put(bass(hz(root), beat * 0.9, v), t0, 1, -0.05, 0.15, 'bass');
          put(bass(hz(fifth), beat * 0.9, v * 0.85), t0 + beat * 2, 1, -0.05, 0.15, 'bass');
        } else {
          put(bass(hz(root), beat * 1.8, v), t0, 1, 0, 0.2, 'bass');
          put(bass(hz(fifth), beat * 1.4, v * 0.8), t0 + beat * 2, 1, 0, 0.2, 'bass');
          if (style === 'walk') put(bass(hz(root + 12), beat * 0.9, v * 0.6), t0 + beat * 3.5, 1, 0, 0.2, 'bass');
        }
      }

      if (spec.arp) {
        const a = spec.arp;
        const tones = chord(name, a.oct);
        const steps = Math.round(4 / a.step);
        for (let k = 0; k < steps; k++) {
          const idx = a.pattern[k % a.pattern.length];
          const m = tones[idx % tones.length] + 12 * Math.floor(idx / tones.length);
          const t = t0 + k * a.step * beat + jitter() + (k % 2 === 1 && a.swing ? a.step * beat * a.swing : 0);
          const vel = a.vol * (k % 4 === 0 ? 1 : 0.78) * (0.92 + r() * 0.16);
          put(INST[a.inst](hz(m), a.step, vel, k), t, 1, a.pan ?? 0, a.send ?? 0.35, 'arp');
        }
      }

      if (spec.stabs) {
        // off-beat chord stabs for the festival
        const tones = chord(name, 4);
        for (const k of [1, 3]) for (const m of tones) put(INST.reed(hz(m), 0.3, spec.stabs.vol), t0 + k * beat, 1, 0.1, 0.25, 'stabs');
      }

      if (spec.melody) {
        const line = spec.melody.lines[b];
        if (line) {
          const { events } = parseLine(line);
          for (const e of events) {
            const m = noteHz(e.note);
            put(INST[spec.melody.inst](m, e.len * beat, spec.melody.vol * (0.94 + r() * 0.12), b * 7 + Math.round(e.beat * 4)), t0 + e.beat * beat + jitter() * 0.6, 1, spec.melody.pan ?? 0, spec.melody.send ?? 0.5, 'melody');
          }
        }
      }

      if (spec.counter) {
        const line = spec.counter.lines[b];
        if (line) for (const e of parseLine(line).events) put(INST[spec.counter.inst](noteHz(e.note), e.len * beat, spec.counter.vol, 3), t0 + e.beat * beat, 1, spec.counter.pan ?? 0.3, spec.counter.send ?? 0.5, 'counter');
      }

      if (spec.drums) {
        const d = spec.drums;
        for (let k = 0; k < 8; k++) {
          const t = t0 + k * beat * 0.5;
          if (d.shaker) put(shaker(d.shaker * (k % 2 === 0 ? 0.65 : 1) * (0.85 + r() * 0.3), 3 + k), t + (k % 2 ? (d.swing ?? 0) * beat * 0.5 : 0), 1, 0.25, 0.05, 'drums');
        }
        for (const k of [1, 3]) if (d.rim) put(rim(d.rim, 5 + k), t0 + k * beat, 1, -0.2, 0.08, 'drums');
        for (const k of [0, 2]) if (d.kick) put(kick(d.kick), t0 + k * beat, 1, 0, 0.02, 'drums');
        if (d.brush && b % 2 === 0) put(brush(bar * 0.9, d.brush, 9 + b), t0, 1, 0, 0.1, 'drums');
      }

      if (spec.sparkle) {
        const sp = spec.sparkle;
        const scale = sp.notes;
        for (let k = 0; k < sp.perBar; k++) {
          if (r() > (sp.chance ?? 0.7)) continue;
          const n = scale[Math.floor(r() * scale.length)];
          put(bell(noteHz(n), 2.4, sp.vol * (0.7 + r() * 0.5)), t0 + r() * bar * 0.95, 1, (r() - 0.5) * 1.4, sp.send ?? 0.9, 'sparkle');
        }
      }
    }
  }

  const wet = reverb(send, spec.reverb?.size ?? 0.7, spec.reverb?.damp ?? 0.4);
  const wetGain = spec.reverb?.wet ?? 3;
  const s0 = Math.round(loopSec * SR);
  const n = Math.round(loopSec * SR);
  const out = new Stereo(loopSec);
  for (let i = 0; i < n; i++) {
    out.l[i] = dry.l[s0 + i] + wet.l[s0 + i] * wetGain;
    out.r[i] = dry.r[s0 + i] + wet.r[s0 + i] * wetGain;
  }
  // Set the level first, then let only the rare tall peaks bend. Squashing a hot mix would make it crunchy.
  const raw = out.peak();
  out.scale((spec.peak ?? 0.8) / Math.max(1e-6, raw));
  for (let i = 0; i < n; i++) {
    out.l[i] = limit(out.l[i]);
    out.r[i] = limit(out.r[i]);
  }
  out.mixStats = wetShare(dry, wet, wetGain, s0, n);
  const unit = out.peak() > 0 ? (spec.peak ?? 0.8) / Math.max(1e-6, raw) : 1;
  out.parts = Object.fromEntries(Object.entries(energy).map(([k, e]) => [k, 20 * Math.log10(Math.sqrt(e / (2 * n)) * unit + 1e-9)]));
  return out;
}

const KNEE = 0.7;
const limit = (x) => {
  const a = Math.abs(x);
  return a <= KNEE ? x : Math.sign(x) * (KNEE + (1 - KNEE) * softclip((a - KNEE) / (1 - KNEE)));
};

/** How much of the sound is the room and how much is the notes, as a ratio of energy. */
function wetShare(dry, wet, gain, s0, n) {
  let d = 0, w = 0;
  for (let i = 0; i < n; i += 4) {
    d += dry.l[s0 + i] ** 2;
    w += (wet.l[s0 + i] * gain) ** 2;
  }
  return { dryRms: Math.sqrt(d / (n / 4)), wetRms: Math.sqrt(w / (n / 4)) };
}

const SCALES = {
  D: ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6'],
  C: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6'],
  Am: ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
  A: ['A4', 'B4', 'C#5', 'E5', 'F#5', 'A5', 'B5'],
  Dm: ['D5', 'F5', 'G5', 'A5', 'C6', 'D6'],
};

export const TRACKS = {
  title: {
    bpm: 72, seed: 11,
    chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A', 'Em', 'A', 'D', 'Bm', 'G', 'A', 'D', 'D'],
    pad: { vol: 0.2, send: 0.7 },
    bass: { style: 'rf', vol: 0.34 },
    arp: { inst: 'felt', pattern: [0, 1, 2, 1, 3, 2, 1, 2], step: 0.5, oct: 4, vol: 0.2, pan: -0.25, send: 0.6 },
    melody: {
      inst: 'bell', vol: 0.5, pan: 0.15, send: 0.8,
      lines: [
        'F#5:1.5 E5:.5 D5:1 r:1', 'D5:1 E5:1 F#5:1 A5:1', 'B5:2 A5:1 F#5:1', 'E5:3 r:1',
        'F#5:1.5 E5:.5 D5:1 A4:1', 'B4:1 D5:1 F#5:2', 'G5:1.5 F#5:.5 E5:1 D5:1', 'E5:1 C#5:1 A4:2',
        'G5:2 E5:1 B4:1', 'A5:1.5 G5:.5 E5:1 C#5:1', 'D5:1 F#5:1 A5:2', 'B5:1.5 A5:.5 F#5:2',
        'G5:1 B5:1 D6:2', 'C#6:1 B5:.5 A5:.5 E5:2', 'D6:2 A5:1 F#5:1', 'D5:4',
      ],
    },
    reverb: { size: 0.82, damp: 0.35, wet: 0.8 }, peak: 0.78,
  },
  farm: {
    bpm: 96, seed: 21,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'C', 'C'],
    pad: { vol: 0.3, send: 0.5 },
    bass: { style: 'rf', vol: 0.4 },
    arp: { inst: 'pluck', pattern: [0, 2, 1, 2, 0, 2, 1, 2], step: 0.5, oct: 3, vol: 0.34, pan: -0.3, send: 0.3, swing: 0.1 },
    melody: {
      inst: 'flute', vol: 0.46, pan: 0.15, send: 0.55,
      lines: [
        'E5:1 G5:.5 E5:.5 D5:1 C5:1', 'C5:1 D5:.5 E5:.5 A5:2', 'A5:1 G5:.5 F5:.5 E5:1 C5:1', 'D5:2 B4:1 G4:1',
        'E5:1 G5:.5 E5:.5 D5:1 C5:1', 'E5:1 D5:.5 C5:.5 A4:2', 'F5:1.5 A5:.5 G5:1 E5:1', 'D5:3 r:1',
        'G5:1 E5:1 C5:1 E5:1', 'G5:1 B5:.5 G5:.5 E5:2', 'A5:1 C6:1 A5:1 F5:1', 'G5:1 F5:.5 E5:.5 D5:2',
        'D5:1 F5:1 A5:2', 'B5:1.5 A5:.5 G5:2', 'E5:2 C5:1 E5:1', 'C5:3 r:1',
      ],
    },
    drums: { shaker: 0.5, rim: 0.3, swing: 0.1 },
    reverb: { size: 0.6, damp: 0.5, wet: 0.78 }, peak: 0.8,
  },
  home: {
    bpm: 66, seed: 31,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'Gm', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'F'],
    pad: { vol: 0.17, send: 0.6 },
    bass: { style: 'root', vol: 0.3 },
    arp: { inst: 'felt', pattern: [0, 1, 2, 1], step: 1, oct: 3, vol: 0.2, pan: -0.2, send: 0.5 },
    melody: {
      inst: 'felt', vol: 0.4, pan: 0.1, send: 0.7,
      lines: [
        'A5:1 C6:1 A5:1 F5:1', 'D5:2 F5:1 A5:1', 'Bb5:1.5 A5:.5 F5:2', 'G5:1 E5:1 C5:2',
        'A5:1 C6:1 D6:1 C6:1', 'A5:2 F5:2', 'D6:1.5 C6:.5 Bb5:2', 'C6:1 G5:1 E5:2',
        'D5:1 G5:1 Bb5:2', 'A5:1 G5:1 E5:2', 'F5:1 A5:1 C6:2', 'D6:2 A5:2',
        'D6:1 C6:1 Bb5:1 A5:1', 'G5:3 E5:1', 'A5:2 F5:2', 'F5:4',
      ],
    },
    drums: { brush: 0.12 },
    reverb: { size: 0.65, damp: 0.5, wet: 0.88 }, peak: 0.74,
  },
  village: {
    bpm: 104, seed: 41,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D', 'Am', 'D', 'G', 'Em', 'C', 'D', 'G', 'G'],
    pad: { vol: 0.22, send: 0.5 },
    bass: { style: 'walk', vol: 0.42 },
    arp: { inst: 'pluck', pattern: [0, 2, 1, 2], step: 0.5, oct: 3, vol: 0.3, pan: -0.35, send: 0.3, swing: 0.12 },
    melody: {
      inst: 'bell', vol: 0.5, pan: 0.2, send: 0.5,
      lines: [
        'B4:.5 D5:.5 G5:1 F#5:.5 E5:.5 D5:1', 'E5:1 G5:.5 B5:.5 A5:1 G5:1', 'E5:.5 G5:.5 C6:1 B5:.5 A5:.5 G5:1', 'F#5:1 A5:1 D6:2',
        'B5:1 A5:.5 G5:.5 D5:2', 'B4:.5 E5:.5 G5:1 E5:2', 'G5:1 E5:.5 G5:.5 C6:2', 'A5:1 F#5:1 D5:2',
        'C6:1 B5:.5 A5:.5 E5:2', 'D5:.5 F#5:.5 A5:1 D6:2', 'B5:1 G5:1 D5:2', 'E5:1 G5:.5 B5:.5 G5:2',
        'C6:1 G5:1 E5:1 G5:1', 'A5:1 F#5:.5 A5:.5 D6:2', 'G5:1 B5:1 D6:2', 'G5:3 r:1',
      ],
    },
    drums: { shaker: 0.22, rim: 0.2, kick: 0.3, swing: 0.12 },
    reverb: { size: 0.55, damp: 0.5, wet: 0.88 }, peak: 0.82,
  },
  forest: {
    bpm: 70, seed: 51,
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'Bb', 'C', 'Dm', 'Bb', 'A', 'Dm'],
    pad: { vol: 0.3, send: 0.8 },
    bass: { style: 'drone', vol: 0.7 },
    arp: { inst: 'pluck', pattern: [0, 2, 1, 2, 3, 2, 1, 2], step: 1, oct: 3, vol: 0.38, pan: 0.3, send: 0.7 },
    melody: {
      inst: 'flute', vol: 0.44, pan: -0.1, send: 0.8,
      lines: [
        'A4:2 D5:1 F5:1', 'D5:1.5 C5:.5 Bb4:2', 'C5:1 F5:1 A5:2', 'G5:2 E5:1 C5:1',
        'D5:2 A4:2', 'Bb4:1 D5:1 F5:2', 'A5:1.5 G5:.5 F5:2', 'E5:2 G5:2',
        'D5:1 G5:1 Bb5:2', 'A5:2 F5:1 D5:1', 'D5:1 F5:1 Bb5:2', 'G5:3 r:1',
        'F5:1 A5:1 D6:2', 'Bb5:2 F5:2', 'E5:1 A5:1 C#6:2', 'D5:4',
      ],
    },
    sparkle: { notes: SCALES.Dm, perBar: 2, chance: 0.55, vol: 0.28 },
    reverb: { size: 0.88, damp: 0.4, wet: 0.91 }, peak: 0.72,
  },
  lake: {
    bpm: 64, seed: 61,
    chords: ['A', 'F#m', 'D', 'E', 'A', 'F#m', 'D', 'E', 'Bm', 'E', 'A', 'F#m', 'D', 'E', 'A', 'A'],
    pad: { vol: 0.16, send: 0.7 },
    bass: { style: 'root', vol: 0.28 },
    arp: { inst: 'bell', pattern: [0, 1, 2, 3, 2, 1], step: 0.667, oct: 4, vol: 0.14, pan: -0.3, send: 0.8 },
    melody: {
      inst: 'felt', vol: 0.4, pan: 0.15, send: 0.75,
      lines: [
        'C#6:2 B5:1 A5:1', 'A5:1 F#5:1 C#5:2', 'D5:1 F#5:1 A5:2', 'B5:2 G#5:1 E5:1',
        'C#6:1.5 E6:.5 C#6:2', 'A5:1 C#6:1 F#5:2', 'F#5:2 A5:1 D6:1', 'C#6:1 B5:1 G#5:2',
        'D6:1 B5:1 F#5:2', 'E5:1 G#5:1 B5:2', 'C#6:2 A5:2', 'A5:1 F#5:1 C#6:2',
        'A5:1.5 F#5:.5 D5:2', 'G#5:2 B5:2', 'E6:2 C#6:1 A5:1', 'A5:4',
      ],
    },
    reverb: { size: 0.86, damp: 0.35, wet: 0.7 }, peak: 0.72,
  },
  mine: {
    bpm: 60, seed: 71,
    chords: ['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E', 'Am', 'F', 'G', 'Am'],
    pad: { vol: 0.15, send: 0.9 },
    bass: { style: 'drone', vol: 0.4 },
    melody: {
      inst: 'bell', vol: 0.34, pan: 0, send: 1,
      lines: [
        'r:2 E5:2', 'A5:3 r:1', 'C5:2 r:1 A4:1', 'F5:3 r:1', 'D5:1 r:1 A5:2', 'F5:2 E5:2',
        'G#4:2 B4:2', 'E5:4', 'C5:1 E5:1 A5:2', 'A5:2 C6:2', 'B5:2 D6:2', 'A5:4',
      ],
    },
    sparkle: { notes: SCALES.Am, perBar: 2, chance: 0.5, vol: 0.12 },
    reverb: { size: 0.93, damp: 0.5, wet: 0.97 }, peak: 0.7,
  },
  night: {
    bpm: 58, seed: 81,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'Em', 'C', 'G', 'G'],
    pad: { vol: 0.2, send: 0.8 },
    bass: { style: 'root', vol: 0.24 },
    arp: { inst: 'bell', pattern: [0, 2, 1, 2], step: 1, oct: 4, vol: 0.15, pan: -0.2, send: 0.8 },
    melody: {
      inst: 'bell', vol: 0.42, pan: 0.15, send: 0.9,
      lines: [
        'D6:2 B5:1 G5:1', 'G5:1 B5:1 E6:2', 'E6:1.5 D6:.5 C6:2', 'A5:2 F#5:2',
        'B5:1 D6:1 G6:2', 'E6:2 B5:2', 'C6:1 E6:1 A5:2', 'F#5:1 A5:1 D6:2',
        'B5:2 G5:2', 'G5:1 C6:1 E6:2', 'D6:2 B5:1 G5:1', 'G5:4',
      ],
    },
    reverb: { size: 0.9, damp: 0.4, wet: 0.76 }, peak: 0.68,
  },
  festival: {
    bpm: 120, seed: 91,
    chords: ['D', 'D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D'],
    bass: { style: 'oompah', vol: 0.45 },
    stabs: { vol: 0.13 },
    arp: { inst: 'pluck', pattern: [0, 1, 2, 1], step: 0.5, oct: 4, vol: 0.2, pan: -0.35, send: 0.25 },
    melody: {
      inst: 'reed', vol: 0.3, pan: 0.15, send: 0.35,
      lines: [
        'F#5:.5 A5:.5 D6:1 A5:1 F#5:1', 'E5:.5 F#5:.5 A5:1 F#5:2', 'G5:.5 B5:.5 D6:1 B5:1 G5:1', 'A5:.5 C#6:.5 E6:1 C#6:2',
        'D6:1 A5:.5 F#5:.5 A5:2', 'B5:1 D6:1 B5:2', 'B5:.5 A5:.5 G5:1 B5:2', 'C#6:1 E6:1 A5:2',
        'F#5:.5 A5:.5 D6:1 A5:1 F#5:1', 'E5:.5 F#5:.5 A5:1 D6:2', 'D6:1 B5:1 G5:2', 'E6:1 C#6:1 A5:2',
        'B5:1 D6:.5 B5:.5 F#5:2', 'G5:1 B5:1 D6:2', 'C#6:1 B5:.5 A5:.5 E5:2', 'D6:3 r:1',
      ],
    },
    drums: { shaker: 0.26, rim: 0.28, kick: 0.4, swing: 0.05 },
    sparkle: { notes: SCALES.D, perBar: 3, chance: 0.5, vol: 0.1, send: 0.4 },
    reverb: { size: 0.5, damp: 0.5, wet: 0.95 }, peak: 0.84,
  },
  lantern: {
    bpm: 68, seed: 101,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'Am', 'F', 'C', 'G', 'F', 'G', 'C', 'C'],
    pad: { vol: 0.24, send: 0.8 },
    bass: { style: 'rf', vol: 0.34 },
    arp: { inst: 'felt', pattern: [0, 1, 2, 1, 3, 2, 1, 2], step: 0.5, oct: 4, vol: 0.2, pan: -0.25, send: 0.6 },
    melody: {
      inst: 'bell', vol: 0.5, pan: 0.15, send: 0.85,
      lines: [
        'E5:2 G5:1 C6:1', 'B5:2 G5:1 D5:1', 'C6:1.5 B5:.5 A5:2', 'A5:1 C6:1 F6:2',
        'E6:2 C6:1 G5:1', 'D6:2 B5:1 G5:1', 'A5:1 C6:1 E6:2', 'G5:3 E5:1',
        'E5:1 A5:1 C6:2', 'F5:1 A5:1 C6:1 A5:1', 'G5:1 E6:1 G6:2', 'D6:2 B5:2',
        'C6:1 A5:1 F5:2', 'B5:2 D6:2', 'E6:2 C6:2', 'C6:4',
      ],
    },
    counter: {
      inst: 'felt', vol: 0.18, pan: -0.3, send: 0.7,
      lines: ['C4:4', 'B3:4', 'A3:4', 'A3:4', 'C4:4', 'B3:4', 'A3:4', 'G3:4', 'A3:4', 'A3:4', 'G3:4', 'B3:4', 'A3:4', 'B3:4', 'C4:4', 'C4:4'],
    },
    reverb: { size: 0.88, damp: 0.35, wet: 0.8 }, peak: 0.78,
  },
};

export { TAU, midi };
