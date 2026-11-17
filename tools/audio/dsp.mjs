// A tiny sound toolkit: oscillators, envelopes, filters, a reverb and a few instruments.
// Everything renders to Float32Array buffers. Nothing here plays sound; the build script writes files.

export const SR = 44100;
const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const dbToGain = (db) => 10 ** (db / 20);

// ---------------------------------------------------------------- notes

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4' -> MIDI 60. Accepts C#4 and Bb3. */
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const hz = (m) => 440 * 2 ** ((m - 69) / 12);
export const noteHz = (name) => hz(midi(name));

const CHORDS = {
  '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7],
  add9: [0, 4, 7, 14], 6: [0, 4, 7, 9], m9: [0, 3, 7, 10, 14], dim: [0, 3, 6], 5: [0, 7],
};
/** 'Am7' -> semitone offsets and the root pitch class, as MIDI numbers around a given octave. */
export function chord(name, octave = 3) {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  if (!m) throw new Error('bad chord ' + name);
  const type = CHORDS[m[2]];
  if (!type) throw new Error('bad chord type ' + name);
  const root = midi(m[1] + octave);
  return type.map((i) => root + i);
}

// ---------------------------------------------------------------- buffers

export class Stereo {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.l = new Float32Array(this.n);
    this.r = new Float32Array(this.n);
  }
  /** Add a mono signal starting at `t` seconds, panned -1 (left) to 1 (right). */
  add(sig, t, gain = 1, pan = 0) {
    const start = Math.round(t * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    const end = Math.min(this.n, start + sig.length);
    for (let i = Math.max(0, start); i < end; i++) {
      const v = sig[i - start];
      this.l[i] += v * gl;
      this.r[i] += v * gr;
    }
  }
  peak() {
    let p = 0;
    for (let i = 0; i < this.n; i++) p = Math.max(p, Math.abs(this.l[i]), Math.abs(this.r[i]));
    return p;
  }
  scale(g) {
    for (let i = 0; i < this.n; i++) { this.l[i] *= g; this.r[i] *= g; }
  }
  slice(from, to) {
    const out = new Stereo((to - from) / SR);
    out.l.set(this.l.subarray(from, to));
    out.r.set(this.r.subarray(from, to));
    return out;
  }
}

// ---------------------------------------------------------------- oscillators

const polyBlep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};

/** One sample of an oscillator at phase 0..1 with step dt. */
export const osc = {
  sine: (p) => Math.sin(p * TAU),
  tri: (p) => 4 * Math.abs(p - 0.5) - 1,
  saw: (p, dt) => 2 * p - 1 - polyBlep(p, dt),
  square: (p, dt, duty = 0.5) => {
    let v = p < duty ? 1 : -1;
    v += polyBlep(p, dt);
    v -= polyBlep((p + 1 - duty) % 1, dt);
    return v;
  },
};

// ---------------------------------------------------------------- envelopes

/** Attack, decay to sustain, hold, then release. All times in seconds. */
export function adsr(t, dur, a, d, s, r) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return mix(1, s, (t - a) / d);
  if (t < dur) return s;
  if (t < dur + r) return s * (1 - (t - dur) / r);
  return 0;
}
/** Exponential fall, for plucks and hits. */
export const expo = (t, rate) => Math.exp(-t * rate);

// ---------------------------------------------------------------- filters

export class Biquad {
  constructor(type, freq, q = 0.707, gainDb = 0) {
    this.set(type, freq, q, gainDb);
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, freq, q = 0.707, gainDb = 0) {
    const w0 = (TAU * clamp(freq, 10, SR * 0.45)) / SR;
    const cos = Math.cos(w0), sin = Math.sin(w0);
    const alpha = sin / (2 * q);
    const A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp': b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'hp': b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'notch': b0 = 1; b1 = -2 * cos; b2 = 1; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'peak': b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; break;
      case 'lowshelf': {
        const sq = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cos + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - sq);
        a0 = (A + 1) + (A - 1) * cos + sq; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - sq;
        break;
      }
      default: throw new Error('filter ' + type);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export function filtered(sig, type, freq, q) {
  const f = new Biquad(type, freq, q);
  const out = new Float32Array(sig.length);
  for (let i = 0; i < sig.length; i++) out[i] = f.process(sig[i]);
  return out;
}

// ---------------------------------------------------------------- reverb

class Comb {
  constructor(len, fb, damp) { this.buf = new Float32Array(len); this.i = 0; this.fb = fb; this.damp = damp; this.s = 0; }
  process(x) {
    const out = this.buf[this.i];
    this.s = out * (1 - this.damp) + this.s * this.damp;
    this.buf[this.i] = x + this.s * this.fb;
    if (++this.i >= this.buf.length) this.i = 0;
    return out;
  }
}
class Allpass {
  constructor(len) { this.buf = new Float32Array(len); this.i = 0; }
  process(x) {
    const b = this.buf[this.i];
    const out = -x + b;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) this.i = 0;
    return out;
  }
}

/** A stereo Freeverb-style room. `size` 0..1 sets the tail, `damp` 0..1 how dark it is. */
export function reverb(input, size = 0.7, damp = 0.4) {
  const combTune = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apTune = [556, 441, 341, 225];
  const spread = 23;
  const fb = 0.7 + size * 0.28;
  const outL = new Float32Array(input.length);
  const outR = new Float32Array(input.length);
  const build = (offset) => ({ combs: combTune.map((t) => new Comb(t + offset, fb, damp)), aps: apTune.map((t) => new Allpass(t + offset)) });
  const L = build(0), R = build(spread);
  for (let i = 0; i < input.length; i++) {
    const x = input[i] * 0.03;
    let l = 0, r = 0;
    for (const c of L.combs) l += c.process(x);
    for (const c of R.combs) r += c.process(x);
    for (const a of L.aps) l = a.process(l);
    for (const a of R.aps) r = a.process(r);
    outL[i] = l;
    outR[i] = r;
  }
  return { l: outL, r: outR };
}

/** A simple feedback echo. */
export function echo(sig, time, feedback, tone = 3000) {
  const d = Math.round(time * SR);
  const out = new Float32Array(sig.length);
  const lp = new Biquad('lp', tone);
  for (let i = 0; i < sig.length; i++) {
    const fed = i >= d ? lp.process(out[i - d]) * feedback : 0;
    out[i] = sig[i] + fed;
  }
  return out;
}

// ---------------------------------------------------------------- shaping

export const softclip = (x) => Math.tanh(x);

export function fadeEnds(sig, inMs = 2, outMs = 8) {
  const a = Math.round((inMs / 1000) * SR), b = Math.round((outMs / 1000) * SR);
  for (let i = 0; i < Math.min(a, sig.length); i++) sig[i] *= i / a;
  for (let i = 0; i < Math.min(b, sig.length); i++) sig[sig.length - 1 - i] *= i / b;
  return sig;
}

// ---------------------------------------------------------------- instruments (each returns a mono Float32Array)

/** Soft plucked string: a few decaying harmonics, bright at the start and mellow after. */
export function pluck(freq, dur = 1.2, vel = 0.8, brightness = 1) {
  const n = Math.round((dur + 0.15) * SR);
  const out = new Float32Array(n);
  const harm = 7;
  for (let k = 1; k <= harm; k++) {
    if (freq * k > SR * 0.42) break;
    const amp = (1 / k ** 1.25) * (k === 1 ? 1 : brightness);
    const rate = 2.2 + k * 2.4 * (1.15 - 0.15 * brightness);
    const ph = (k * 0.37) % 1;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] += Math.sin(TAU * (freq * k * t + ph)) * amp * Math.exp(-t * rate);
    }
  }
  for (let i = 0; i < n; i++) out[i] *= vel * Math.min(1, (i / SR) / 0.004);
  return out;
}

/** A music box or kalimba bell: two sine operators, a bright ping that fades into a pure tone. */
export function bell(freq, dur = 1.6, vel = 0.7, ratio = 3.01, index = 1.6) {
  const n = Math.round((dur + 0.3) * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const mod = Math.sin(TAU * freq * ratio * t) * index * Math.exp(-t * 7);
    const amp = Math.exp(-t * 2.4) * Math.min(1, t / 0.002);
    out[i] = (Math.sin(TAU * freq * t + mod) * 0.85 + Math.sin(TAU * freq * 2 * t) * 0.12 * Math.exp(-t * 5)) * amp * vel;
  }
  return out;
}

/** A felt piano: soft attack, a gentle second and third harmonic, a slow fall. */
export function felt(freq, dur = 1.5, vel = 0.7) {
  const n = Math.round((dur + 0.5) * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.012) * Math.exp(-t * (1.5 + freq / 900));
    out[i] = (Math.sin(TAU * freq * t) + 0.42 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t * 3) + 0.16 * Math.sin(TAU * freq * 3 * t) * Math.exp(-t * 5)) * e * vel * 0.7;
  }
  return out;
}

/** A breathy flute: sine with a little vibrato and filtered breath noise. */
export function flute(freq, dur = 1, vel = 0.6, seed = 1) {
  const r = rng(seed);
  const n = Math.round((dur + 0.25) * SR);
  const out = new Float32Array(n);
  const lp = new Biquad('bp', freq * 2, 1.2);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vib = 1 + Math.sin(TAU * 5.1 * t) * 0.004 * Math.min(1, t / 0.4);
    ph += (freq * vib) / SR;
    const e = adsr(t, dur, 0.06, 0.1, 0.8, 0.18);
    const breath = lp.process(r() * 2 - 1) * 0.35 * Math.min(1, t / 0.03) * Math.exp(-t * 1.2);
    out[i] = (Math.sin(TAU * ph) + 0.18 * Math.sin(TAU * ph * 2) + 0.05 * Math.sin(TAU * ph * 3) + breath) * e * vel;
  }
  return out;
}

/** A slow warm pad: three detuned saws through a low pass. */
export function pad(freq, dur = 3, vel = 0.4) {
  const n = Math.round((dur + 1.2) * SR);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', Math.min(1400, freq * 3.2), 0.6);
  const detune = [-0.0045, 0, 0.0052];
  const ph = [0.1, 0.5, 0.8];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (let k = 0; k < 3; k++) {
      const f = freq * (1 + detune[k]);
      const dt = f / SR;
      ph[k] = (ph[k] + dt) % 1;
      s += osc.saw(ph[k], dt);
    }
    out[i] = lp.process(s / 3) * adsr(t, dur, 0.7, 0.4, 0.85, 1.2) * vel;
  }
  return out;
}

/** A round bass note. */
export function bass(freq, dur = 0.6, vel = 0.7) {
  const n = Math.round((dur + 0.15) * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.008) * Math.exp(-t * 2.6) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.15));
    out[i] = (Math.sin(TAU * freq * t) + 0.3 * Math.sin(TAU * freq * 2 * t)) * e * vel;
  }
  return out;
}

/** An accordion-ish reed for festivals: a pair of slightly detuned pulse waves. */
export function reed(freq, dur = 0.6, vel = 0.4) {
  const n = Math.round((dur + 0.12) * SR);
  const out = new Float32Array(n);
  const lp = new Biquad('lp', 2400, 0.7);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const d1 = freq / SR, d2 = (freq * 1.006) / SR;
    p1 = (p1 + d1) % 1; p2 = (p2 + d2) % 1;
    const s = osc.square(p1, d1, 0.35) + osc.square(p2, d2, 0.4);
    out[i] = lp.process(s * 0.5) * adsr(t, dur, 0.03, 0.08, 0.75, 0.1) * vel;
  }
  return out;
}

// ---------------------------------------------------------------- percussion

export function shaker(vel = 0.4, seed = 3, len = 0.07) {
  const r = rng(seed);
  const n = Math.round(len * SR);
  const hp = new Biquad('hp', 6500);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = hp.process(r() * 2 - 1) * Math.exp(-(i / SR) * 45) * vel;
  return out;
}
export function kick(vel = 0.8) {
  const n = Math.round(0.28 * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (50 + 90 * Math.exp(-t * 28)) / SR;
    out[i] = Math.sin(TAU * ph) * Math.exp(-t * 11) * Math.min(1, t / 0.002) * vel;
  }
  return out;
}
export function rim(vel = 0.5, seed = 5) {
  const r = rng(seed);
  const n = Math.round(0.09 * SR);
  const bp = new Biquad('bp', 1800, 3);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (bp.process(r() * 2 - 1) * 0.8 + Math.sin(TAU * 820 * t) * 0.4) * Math.exp(-t * 60) * vel;
  }
  return out;
}
export function brush(dur = 0.4, vel = 0.3, seed = 9) {
  const r = rng(seed);
  const n = Math.round(dur * SR);
  const bp = new Biquad('bp', 4200, 0.7);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR / dur;
    out[i] = bp.process(r() * 2 - 1) * Math.sin(Math.PI * Math.min(1, t)) ** 1.5 * vel;
  }
  return out;
}

/** Pink-ish noise for rain, wind and water beds. */
export function pinkNoise(seconds, seed = 11) {
  const r = rng(seed);
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}
