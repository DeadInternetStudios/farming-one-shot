// Every little sound in the game, built from oscillators and noise. Each entry returns a mono Float32Array.
import { Biquad, SR, adsr, bell, expo, fadeEnds, felt, pluck, reverb, rng } from './dsp.mjs';

const TAU = Math.PI * 2;
const make = (sec, fn) => {
  const n = Math.round(sec * SR);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = fn(i / SR, i);
  return o;
};
/** Mix buffers at offsets (seconds) with gains into a buffer of the given length. */
const layer = (sec, parts) => {
  const out = new Float32Array(Math.round(sec * SR));
  for (const [buf, t = 0, g = 1] of parts) {
    const s = Math.round(t * SR);
    for (let i = 0; i < buf.length && s + i < out.length; i++) out[s + i] += buf[i] * g;
  }
  return out;
};
const noiseFn = (seed) => { const r = rng(seed); return () => r() * 2 - 1; };
const norm = (sig, peak = 0.8) => {
  let p = 0;
  for (const v of sig) p = Math.max(p, Math.abs(v));
  if (p > 0) for (let i = 0; i < sig.length; i++) sig[i] *= peak / p;
  return sig;
};
const sweep = (f0, f1, t, dur) => f0 * (f1 / f0) ** Math.min(1, t / dur);
/** A sine whose pitch glides from f0 to f1. */
const glide = (sec, f0, f1, decay, vol = 1, shape = 'sine') => {
  let ph = 0;
  return make(sec, (t) => {
    ph += sweep(f0, f1, t, sec) / SR;
    const w = shape === 'tri' ? 4 * Math.abs((ph % 1) - 0.5) - 1 : shape === 'square' ? ((ph % 1) < 0.5 ? 0.6 : -0.6) : Math.sin(TAU * ph);
    return w * expo(t, decay) * Math.min(1, t / 0.002) * vol;
  });
};
/** A burst of band-passed noise. */
const burst = (sec, type, f, q, decay, vol = 1, seed = 1) => {
  const nz = noiseFn(seed);
  const flt = new Biquad(type, f, q);
  return make(sec, (t) => flt.process(nz()) * expo(t, decay) * Math.min(1, t / 0.0015) * vol);
};
/** Band-passed noise whose centre sweeps. */
const whoosh = (sec, f0, f1, peakAt = 0.5, vol = 1, seed = 2, q = 1.1) => {
  const nz = noiseFn(seed);
  const flt = new Biquad('bp', f0, q);
  return make(sec, (t, i) => {
    if (i % 32 === 0) {
      const u = t / sec;
      const f = u < peakAt ? f0 * (f1 / f0) ** (u / peakAt) : f1 * (f0 / f1) ** ((u - peakAt) / (1 - peakAt)) * 0.6 + f0 * 0.4;
      flt.set('bp', f, q);
    }
    const u = t / sec;
    return flt.process(nz()) * Math.sin(Math.PI * Math.min(1, u)) ** 1.4 * vol;
  });
};
const chimeNotes = (notes, gap, kind = 'bell', vel = 0.6) =>
  layer(notes.length * gap + 1.8, notes.map((f, i) => [kind === 'bell' ? bell(f, 1.2, vel) : kind === 'felt' ? felt(f, 1, vel) : pluck(f, 0.9, vel), i * gap, 1]));

const F = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568, C4: 261.63, E4: 329.63, G4: 392, A4: 440 };

export const SFX = {
  tick: () => make(0.03, (t) => (Math.sin(TAU * 1900 * t) * 0.8 + noiseFn(4)() * 0.15) * expo(t, 160)),
  open: () => layer(0.2, [[glide(0.12, 500, 900, 22, 0.7), 0, 1], [burst(0.1, 'bp', 3000, 1, 40, 0.25, 8), 0, 1]]),
  close: () => layer(0.2, [[glide(0.12, 900, 480, 22, 0.7), 0, 1]]),
  shutter: () => layer(0.6, [
    [burst(0.03, 'bp', 3400, 1.3, 140, 0.9, 31), 0, 1],
    [glide(0.05, 1500, 650, 80, 0.5), 0, 1],
    [burst(0.05, 'bp', 2000, 1.2, 90, 0.7, 32), 0.075, 1],
    [glide(0.06, 900, 480, 60, 0.4), 0.075, 1],
    [bell(1568, 0.4, 0.5, 3, 0.8), 0.14, 0.45],
  ]),
  nope: () => layer(0.3, [[glide(0.12, 240, 190, 14, 0.9, 'tri'), 0, 1], [glide(0.16, 190, 140, 11, 0.9, 'tri'), 0.1, 1]]),
  pickup: () => layer(0.3, [[bell(880, 0.25, 0.6, 2.4, 0.9), 0, 1], [bell(1320, 0.3, 0.6, 2.4, 0.9), 0.06, 1]]),
  hoe: () => layer(0.3, [[glide(0.12, 130, 60, 26, 1), 0, 1], [burst(0.1, 'lp', 1400, 0.7, 30, 0.7, 3), 0, 1], [burst(0.12, 'bp', 2600, 1.2, 40, 0.28, 5), 0.05, 1]]),
  water: () => {
    const nz = noiseFn(12);
    const f = new Biquad('bp', 1900, 0.9);
    const g = new Biquad('lp', 5200);
    return make(0.6, (t) => g.process(f.process(nz())) * adsr(t, 0.5, 0.05, 0.1, 0.8, 0.12) * (0.75 + 0.25 * Math.sin(TAU * 31 * t)) * 0.9);
  },
  'water-dry': () => layer(0.25, [[burst(0.12, 'lp', 900, 0.8, 24, 0.5, 6), 0, 1], [glide(0.1, 240, 150, 30, 0.4), 0, 1]]),
  refill: () => {
    const r = rng(21);
    const parts = [];
    for (let k = 0; k < 9; k++) parts.push([glide(0.07, 380 + r() * 300 + k * 70, 700 + r() * 500 + k * 70, 34, 0.45), k * 0.055, 1]);
    parts.push([burst(0.55, 'bp', 1500, 0.7, 5, 0.18, 22), 0, 1]);
    return layer(0.62, parts);
  },
  plant: () => layer(0.2, [[burst(0.07, 'lp', 700, 0.8, 50, 0.8, 7), 0, 1], [glide(0.09, 190, 120, 34, 0.6), 0, 1]]),
  harvest: () => layer(0.5, [[glide(0.08, 380, 900, 28, 0.7), 0, 1], [bell(1318, 0.35, 0.6, 2.9, 0.8), 0.05, 1], [bell(1760, 0.3, 0.4, 2.9, 0.8), 0.1, 1], [burst(0.1, 'hp', 6000, 0.7, 40, 0.1, 9), 0.06, 1]]),
  chop: () => layer(0.25, [[glide(0.14, 210, 105, 22, 1), 0, 1], [burst(0.05, 'bp', 950, 2.2, 90, 0.9, 10), 0, 1], [burst(0.04, 'hp', 3500, 0.8, 120, 0.2, 31), 0, 1]]),
  'chop-done': () => layer(0.6, [[burst(0.09, 'hp', 1600, 0.8, 55, 0.7, 11), 0, 1], [glide(0.32, 120, 62, 9, 1), 0, 1], [glide(0.14, 200, 100, 22, 0.8), 0.01, 1], [burst(0.35, 'bp', 700, 0.6, 9, 0.35, 13), 0.03, 1]]),
  'tree-fall': () => layer(1.1, [
    [whoosh(0.6, 250, 1300, 0.7, 0.55, 14), 0, 1],
    [burst(0.4, 'hp', 2800, 0.6, 9, 0.35, 15), 0.02, 1],
    [burst(0.3, 'bp', 700, 1.1, 12, 0.5, 18), 0.46, 1],
    [glide(0.4, 150, 66, 7, 0.9), 0.52, 1],
    [burst(0.3, 'bp', 320, 0.7, 9, 0.9, 16), 0.52, 1],
  ]),
  mine: () => layer(0.45, [[bell(2350, 0.3, 0.55, 2.76, 0.7), 0, 1], [burst(0.04, 'hp', 3800, 0.7, 150, 0.7, 17), 0, 1], [glide(0.1, 150, 90, 30, 0.8), 0, 1]]),
  'mine-break': () => {
    const nz = noiseFn(18);
    const f = new Biquad('lp', 3200);
    const crumble = make(0.5, (t, i) => {
      if (i % 64 === 0) f.set('lp', 3000 * Math.exp(-t * 4.5) + 260, 0.8);
      const grain = Math.sin(TAU * 38 * t + Math.sin(t * 90) * 2) > 0.2 ? 1 : 0.35;
      return f.process(nz()) * expo(t, 6.5) * grain;
    });
    return layer(0.7, [[crumble, 0, 0.9], [glide(0.2, 110, 55, 14, 0.9), 0, 1], [bell(2349, 0.25, 0.35, 2.76, 0.7), 0.0, 1], [bell(1568, 0.3, 0.3, 2.76, 0.7), 0.09, 1]]);
  },
  cut: () => whoosh(0.2, 1400, 3400, 0.42, 0.6, 19, 0.9),
  eat: () => layer(0.4, [0, 0.085, 0.17].map((t, k) => [burst(0.05, 'bp', 1700 + k * 220, 1.4, 70, 0.8, 23 + k), t, 1]).concat([[glide(0.3, 190, 140, 12, 0.35), 0.0, 1]])),
  buy: () => layer(0.6, [[bell(2093, 0.3, 0.55, 3.5, 1.1), 0, 1], [bell(2637, 0.35, 0.55, 3.5, 1.1), 0.08, 1], [burst(0.03, 'hp', 5000, 0.8, 200, 0.4, 24), 0, 1], [burst(0.03, 'hp', 5000, 0.8, 200, 0.3, 25), 0.08, 1]]),
  coin: () => layer(0.5, [[bell(1976, 0.25, 0.6, 3.5, 1.1), 0, 1], [bell(2637, 0.35, 0.55, 3.5, 1.1), 0.06, 1]]),
  give: () => chimeNotes([F.C5, F.E5, F.G5, F.C6], 0.085, 'bell', 0.55),
  lantern: () => {
    const notes = [F.C5, F.D5, F.E5, F.G5, F.A5, F.C6, F.E6];
    const dry = layer(2.6, notes.map((f, i) => [bell(f, 1.6, 0.55, 3.0, 1.3), i * 0.11, 1]));
    const wet = reverb(dry, 0.82, 0.35);
    return layer(2.6, [[dry, 0, 0.75], [wet.l, 0, 5], [wet.r, 0, 5]]);
  },
  upgrade: () => {
    const notes = [F.C5, F.E5, F.G5, F.C6];
    const dry = layer(1.6, notes.map((f, i) => [pluck(f, 0.8, 0.7), i * 0.1, 1]).concat([[bell(F.C6, 1.2, 0.5), 0.34, 1], [bell(F.E6, 1.2, 0.4), 0.4, 1], [bell(F.G6, 1.3, 0.35), 0.46, 1]]));
    return dry;
  },
  ship: () => layer(0.8, [[glide(0.18, 120, 70, 16, 1), 0, 1], [burst(0.1, 'lp', 600, 0.8, 30, 0.5, 26), 0, 1], [bell(1568, 0.25, 0.4, 3.5, 1), 0.16, 1], [bell(2093, 0.25, 0.4, 3.5, 1), 0.25, 1], [bell(2637, 0.3, 0.4, 3.5, 1), 0.34, 1]]),
  place: () => layer(0.3, [[glide(0.14, 320, 110, 24, 1), 0, 1], [burst(0.06, 'lp', 900, 0.8, 45, 0.5, 27), 0, 1]]),
  craft: () => layer(0.5, [[bell(1500, 0.2, 0.6, 2.4, 0.6), 0, 1], [burst(0.04, 'hp', 3000, 0.8, 140, 0.5, 28), 0, 1], [glide(0.08, 170, 100, 40, 0.8), 0, 1], [bell(1700, 0.25, 0.6, 2.4, 0.6), 0.13, 1], [burst(0.04, 'hp', 3000, 0.8, 140, 0.5, 29), 0.13, 1], [glide(0.08, 190, 110, 40, 0.8), 0.13, 1]]),
  cook: () => layer(1, [[burst(0.8, 'hp', 4500, 0.6, 2.2, 0.35, 30), 0, 1], [bell(1760, 0.6, 0.5, 3.1, 0.8), 0.52, 1]]),
  fire: () => {
    const nz = noiseFn(33);
    const lp = new Biquad('lp', 1800);
    const r = rng(34);
    let pop = 0;
    return make(0.9, (t) => {
      if (r() < 0.004) pop = 1;
      pop *= 0.9;
      return (lp.process(nz()) * 0.35 + nz() * pop * 0.5) * adsr(t, 0.8, 0.05, 0.1, 0.8, 0.15);
    });
  },
  cast: () => layer(0.4, [[whoosh(0.3, 500, 2600, 0.55, 0.9, 35, 1.4), 0, 1], [glide(0.18, 900, 1800, 18, 0.12), 0.03, 1]]),
  splash: () => {
    const r = rng(36);
    const drops = [];
    for (let k = 0; k < 7; k++) drops.push([glide(0.06, 900 + r() * 1400, 1500 + r() * 1800, 40, 0.18), 0.04 + r() * 0.25, 1]);
    return layer(0.6, [[burst(0.4, 'lp', 2800, 0.7, 9, 0.8, 37), 0, 1], [burst(0.12, 'bp', 1200, 0.8, 20, 0.5, 38), 0, 1], ...drops]);
  },
  bite: () => layer(0.5, [[glide(0.1, 520, 840, 16, 0.8), 0, 1], [glide(0.12, 520, 900, 14, 0.8), 0.13, 1], [burst(0.1, 'lp', 1500, 0.8, 30, 0.35, 39), 0, 1]]),
  hook: () => layer(0.25, [[burst(0.03, 'hp', 3000, 0.7, 180, 0.8, 40), 0, 1], [glide(0.1, 1300, 380, 22, 0.7, 'tri'), 0, 1]]),
  catch: () => chimeNotes([F.E5, F.G5, F.C6], 0.075, 'pluck', 0.6),
  fanfare: () => {
    const notes = [F.C5, F.E5, F.G5, F.C6];
    const dry = layer(2.2, [...notes.map((f, i) => [pluck(f, 0.7, 0.7), i * 0.09, 1]), [bell(F.E6, 1.4, 0.55), 0.38, 1], [bell(F.G5, 1.4, 0.4), 0.38, 1], [bell(F.C6, 1.5, 0.4), 0.38, 1]]);
    const wet = reverb(dry, 0.7, 0.4);
    return layer(2.2, [[dry, 0, 0.8], [wet.l, 0, 4], [wet.r, 0, 4]]);
  },
  thunder: () => {
    const nz = noiseFn(41);
    const sub = new Biquad('lp', 110, 0.8);
    const low = new Biquad('bp', 180, 0.6);
    const mid = new Biquad('bp', 420, 0.7);
    const r = rng(42);
    let roll = 0.5;
    return make(3.2, (t, i) => {
      if (i % 2000 === 0) roll = 0.35 + r() * 0.65;
      const env = adsr(t, 1.5, 0.06, 0.8, 0.55, 1.6);
      const body = (sub.process(nz()) * 1.6 + low.process(nz()) * 2.6 + mid.process(nz()) * 1.2 * Math.exp(-t * 1.2)) * roll * env;
      const crack = nz() * (t < 0.05 ? 1 - t / 0.05 : 0) * 0.45;
      return body + crack;
    });
  },
  blip: () => make(0.07, (t) => (Math.sin(TAU * 520 * t) * 0.8 + (4 * Math.abs((520 * t) % 1 - 0.5) - 1) * 0.25) * adsr(t, 0.045, 0.004, 0.02, 0.6, 0.02) * 0.9),
  door: () => layer(0.5, [[burst(0.05, 'bp', 700, 2, 70, 0.8, 43), 0, 1], [glide(0.18, 170, 260, 11, 0.4, 'tri'), 0.03, 1], [burst(0.05, 'bp', 1100, 2, 70, 0.6, 44), 0.22, 1], [glide(0.1, 130, 90, 30, 0.7), 0.22, 1]]),
  travel: () => whoosh(0.3, 600, 1700, 0.5, 0.35, 45, 0.8),
  sleep: () => chimeNotes([F.G5, F.E5, F.C5, F.G4], 0.3, 'bell', 0.35),
  morning: () => {
    const dry = layer(2, [[felt(F.C5, 1.2, 0.5), 0, 1], [felt(F.E5, 1.2, 0.5), 0.18, 1], [felt(F.G5, 1.4, 0.5), 0.36, 1], [bell(F.C6, 1.4, 0.35), 0.54, 1]]);
    const wet = reverb(dry, 0.7, 0.45);
    return layer(2, [[dry, 0, 0.9], [wet.l, 0, 3.5], [wet.r, 0, 3.5]]);
  },
  heart: () => layer(0.6, [[bell(F.G5, 0.4, 0.5, 3, 1), 0, 1], [bell(F.B5, 0.5, 0.5, 3, 1), 0.11, 1]]),
  'furnace-done': () => layer(0.9, [[bell(1568, 0.7, 0.55, 3.2, 0.9), 0, 1], [bell(2093, 0.7, 0.45, 3.2, 0.9), 0.14, 1], [glide(0.18, 110, 60, 14, 0.6), 0, 1]]),
  gift: () => layer(0.5, [[burst(0.08, 'hp', 4000, 0.8, 60, 0.3, 46), 0, 1], [pluck(F.G5, 0.4, 0.6), 0.05, 1], [pluck(F.C6, 0.5, 0.6), 0.12, 1]]),
  // a thin whistle up, a soft thump, then glitter falling
  firework: () => {
    const r = rng(61);
    const crackle = [];
    for (let k = 0; k < 14; k++) crackle.push([burst(0.03, 'hp', 3200 + r() * 2500, 0.8, 140, 0.16 + r() * 0.1, 70 + k), 0.58 + r() * 0.8, 1]);
    const dry = layer(1.9, [
      [glide(0.45, 520, 1900, 7, 0.2), 0, 1],
      [glide(0.2, 130, 52, 11, 1), 0.46, 1],
      [burst(0.12, 'bp', 1300, 0.8, 24, 0.45, 60), 0.46, 1],
      [bell(F.G6, 0.9, 0.16, 3, 1), 0.5, 1],
      [bell(F.E6, 0.9, 0.12, 3, 1), 0.62, 1],
      ...crackle,
    ]);
    const wet = reverb(dry, 0.75, 0.4);
    return layer(1.9, [[dry, 0, 0.9], [wet.l, 0, 3], [wet.r, 0, 3]]);
  },
};

/** Sound beds that loop. They are long, quiet and steady. */
export const BEDS = {
  'amb-rain': () => {
    const nz = noiseFn(51);
    const hp = new Biquad('hp', 600);
    const lp = new Biquad('lp', 7500);
    const sig = make(10.8, (t) => lp.process(hp.process(nz())) * 0.55 * (0.88 + 0.12 * Math.sin(TAU * 0.3 * t)));
    const r = rng(52);
    for (let k = 0; k < 90; k++) {
      const t0 = r() * 10.4;
      const f = 2400 + r() * 2400;
      const d = glide(0.03, f, f * 0.7, 90, 0.1 + r() * 0.1);
      for (let i = 0; i < d.length; i++) sig[Math.round(t0 * SR) + i] += d[i];
    }
    return loopify(sig, 0.8);
  },
  'amb-wind': () => {
    const nz = noiseFn(53);
    const lp = new Biquad('lp', 600, 0.9);
    return loopify(make(12, (t, i) => {
      if (i % 64 === 0) lp.set('lp', 380 + 420 * (0.5 + 0.5 * Math.sin(TAU * 0.11 * t) * Math.sin(TAU * 0.07 * t + 1)), 1.4);
      return lp.process(nz()) * (0.6 + 0.4 * Math.sin(TAU * 0.13 * t + 2));
    }), 1);
  },
  'amb-crickets': () => {
    const r = rng(54);
    const sig = new Float32Array(Math.round(8.8 * SR));
    for (let c = 0; c < 4; c++) {
      const base = 4200 + c * 230;
      const period = 0.31 + c * 0.037;
      const start = r() * period;
      for (let t = start; t < 8.8 - 0.2; t += period) {
        const chirps = 3;
        for (let k = 0; k < chirps; k++) {
          const t0 = t + k * 0.045;
          const n = Math.round(0.03 * SR);
          for (let i = 0; i < n; i++) {
            const idx = Math.round(t0 * SR) + i;
            if (idx >= sig.length) break;
            const u = i / n;
            sig[idx] += Math.sin(TAU * base * (i / SR)) * Math.sin(Math.PI * u) * 0.12;
          }
        }
      }
    }
    return loopify(sig, 0.4);
  },
  'amb-birds': () => {
    const r = rng(55);
    const sig = new Float32Array(Math.round(12.5 * SR));
    for (let k = 0; k < 9; k++) {
      const t0 = 0.3 + r() * 11;
      const base = 2400 + r() * 1800;
      const notes = 2 + Math.floor(r() * 3);
      for (let j = 0; j < notes; j++) {
        const n = Math.round(0.09 * SR);
        const start = Math.round((t0 + j * 0.12) * SR);
        let ph = 0;
        for (let i = 0; i < n; i++) {
          const u = i / n;
          ph += (base * (1 + 0.5 * Math.sin(u * 3.1 + j)) * (1 + 0.3 * u)) / SR;
          if (start + i < sig.length) sig[start + i] += Math.sin(TAU * ph) * Math.sin(Math.PI * u) ** 1.5 * 0.1;
        }
      }
    }
    return loopify(sig, 0.5);
  },
  'amb-cave': () => {
    const r = rng(56);
    const nz = noiseFn(57);
    const lp = new Biquad('lp', 420, 0.8);
    const hp = new Biquad('hp', 90, 0.7);
    const drone = make(12.4, (t) => hp.process(lp.process(nz())) * 0.9 + Math.sin(TAU * 110 * t) * 0.07 + Math.sin(TAU * 164.8 * t) * 0.045 * (0.6 + 0.4 * Math.sin(TAU * 0.2 * t)) + Math.sin(TAU * 220 * t) * 0.025 * (0.5 + 0.5 * Math.sin(TAU * 0.13 * t)));
    const drips = new Float32Array(drone.length);
    for (let k = 0; k < 5; k++) {
      const t0 = 0.6 + r() * 11;
      const f = 1200 + r() * 900;
      const d = glide(0.12, f, f * 1.6, 28, 0.25);
      for (let i = 0; i < d.length; i++) drips[Math.round(t0 * SR) + i] += d[i];
    }
    const mixed = drone.map((v, i) => v + drips[i]);
    const wet = reverb(drips, 0.85, 0.5);
    for (let i = 0; i < mixed.length; i++) mixed[i] += (wet.l[i] + wet.r[i]) * 2.2;
    return loopify(mixed, 1);
  },
  'amb-water': () => {
    const nz = noiseFn(58);
    const lp = new Biquad('lp', 900, 0.8);
    return loopify(make(10.5, (t, i) => {
      if (i % 64 === 0) lp.set('lp', 500 + 420 * (0.5 + 0.5 * Math.sin(TAU * 0.35 * t)), 0.9);
      return lp.process(nz()) * (0.55 + 0.45 * Math.sin(TAU * 0.35 * t + 0.5));
    }), 0.5);
  },
};

/** Make a signal loop without a click: the tail crossfades into the head, and the extra is trimmed. */
function loopify(sig, fadeSeconds) {
  const fade = Math.round(fadeSeconds * SR);
  const n = sig.length - fade;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sig[i];
  for (let i = 0; i < fade; i++) {
    const u = i / fade;
    const a = Math.cos((u * Math.PI) / 2), b = Math.sin((u * Math.PI) / 2);
    out[i] = sig[i] * b + sig[n + i] * a;
  }
  return out;
}

/** How loud each effect should be, as a peak from 0 to 1. Tiny UI sounds stay quiet. */
export const LEVELS = {
  tick: 0.3, open: 0.35, close: 0.3, nope: 0.5, pickup: 0.55, hoe: 0.8, water: 0.55, 'water-dry': 0.4, refill: 0.5, plant: 0.55, harvest: 0.65,
  chop: 0.8, 'chop-done': 0.85, 'tree-fall': 0.8, mine: 0.65, 'mine-break': 0.75, cut: 0.5, eat: 0.55, buy: 0.6, coin: 0.55, give: 0.6, lantern: 0.7,
  upgrade: 0.7, ship: 0.7, place: 0.65, craft: 0.65, cook: 0.55, fire: 0.45, cast: 0.5, splash: 0.65, bite: 0.6, hook: 0.55, catch: 0.65, fanfare: 0.75,
  thunder: 0.85, shutter: 0.7, blip: 0.35, door: 0.6, travel: 0.3, sleep: 0.5, morning: 0.6, heart: 0.5, 'furnace-done': 0.6, gift: 0.5, firework: 0.55,
};

/** Where each sound is rolled off at the top, in Hz, so nothing hisses on headphones. Noisy sounds are rolled off lower. */
const HIGH_CUT = { cook: 5200, fire: 5000, cut: 6500, travel: 7000, cast: 7500, 'amb-rain': 6000, 'amb-crickets': 6500, 'amb-birds': 7000 };
const DEFAULT_CUT = 10500;

function roundOff(sig, cut) {
  const a = new Biquad('lp', cut, 0.6);
  const b = new Biquad('lp', cut, 0.8);
  for (let i = 0; i < sig.length; i++) sig[i] = b.process(a.process(sig[i]));
  return sig;
}

export function renderSfx(name) {
  const make = SFX[name];
  if (!make) throw new Error('no sound ' + name);
  const sig = roundOff(make(), HIGH_CUT[name] ?? DEFAULT_CUT);
  fadeEnds(sig, 1, 6);
  return norm(sig, LEVELS[name] ?? 0.6);
}

export function renderBed(name) {
  const sig = BEDS[name]();
  return norm(roundOff(sig, HIGH_CUT[name] ?? DEFAULT_CUT), 0.5);
}

