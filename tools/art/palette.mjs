// The one palette for Lantern Hollow. Golden-hour storybook: warm lights, plum shadows.
// Every ramp runs dark to light, hue shifts cool in the shade and warm in the light.
// All art is drawn from these ramps only. Lighting and night grading happen in the game.

const h = (s) => parseInt(s.replace('#', ''), 16);
const ramp = (...a) => a.map(h);

export const R = {
  ink:     ramp('#1a1423', '#2b2136', '#443654', '#6b5a7d', '#9b8ba8', '#cdc3d2'),
  cream:   ramp('#d9c7a3', '#efe2c7', '#f8f0dd', '#fffaf0'),
  grass:   ramp('#20423b', '#2f5f43', '#467f45', '#659e47', '#8bb94f', '#b9d56a', '#e0eb97'),
  grassSummer: ramp('#1a3f36', '#285b3c', '#3d7a3f', '#5b9a42', '#80b64c', '#aed166', '#d8e892'),
  grassFall:   ramp('#3a3a28', '#5a5a2c', '#82792f', '#a89a3c', '#cbb04c', '#e6cc6c', '#f4e69a'),
  leaf:    ramp('#173a35', '#1f5240', '#2d6e45', '#43894a', '#62a553', '#8cc263', '#bfe08a'),
  autumn:  ramp('#5a2430', '#8c3a2f', '#bf5a2e', '#e08a36', '#f2b44a', '#f9d97a'),
  blossom: ramp('#6e2f55', '#a24a74', '#d3739a', '#ee9dba', '#f8c6d6', '#fde9ef'),
  dirt:    ramp('#2d1b24', '#4a2c2d', '#6c4234', '#8f5e3f', '#b5834f', '#d6aa72', '#ecc995'),
  wet:     ramp('#22141c', '#38222a', '#523229', '#6e442f', '#8a5a3a'),
  wood:    ramp('#33201f', '#573229', '#7a4a31', '#a1683a', '#c98d4c', '#e8b36b', '#f6d69a'),
  stone:   ramp('#272538', '#3f3d57', '#5d5b78', '#807d96', '#a9a6b8', '#d3d0dc', '#efedf3'),
  water:   ramp('#12304a', '#194d6b', '#237090', '#3a97ad', '#6cc0c4', '#a9e3dc', '#e6f7ee'),
  sand:    ramp('#b08a58', '#d1ab6e', '#e8c98b', '#f4e2ae', '#fff2cc'),
  red:     ramp('#4f1d2c', '#7e2b3a', '#ae3f45', '#d65f52', '#f08a69', '#f9b790'),
  teal:    ramp('#1f3047', '#2f4a6b', '#446b8f', '#6a97b3', '#9ac4d0'),
  purple:  ramp('#3b2754', '#5b3c7a', '#7f5aa0', '#a584c2', '#cdb2e0'),
  yellow:  ramp('#8a5a12', '#c78a1a', '#eab52f', '#f7d65a', '#fff0a0'),
  orange:  ramp('#7a2e1d', '#b4482a', '#e0692f', '#f58f3f', '#ffb866'),
  blue:    ramp('#1d2b5c', '#2f4d93', '#4a78c4', '#78a6e0', '#b0d0f2'),
  pink:    ramp('#7a2a4b', '#b04667', '#e0708a', '#f59bac', '#fbc9d0'),
  glow:    ramp('#d9731f', '#ffa63a', '#ffc95e', '#ffe39a', '#fff5cf'),
  snow:    ramp('#8da3c4', '#b9cbe4', '#dce8f6', '#f4f8fd', '#ffffff'),
  skin1:   ramp('#b9715a', '#d98f72', '#efb08c', '#fbd1b0', '#fde6cf'),
  skin2:   ramp('#a3624a', '#c68360', '#e0a27a', '#f2c196', '#f8d7b3'),
  skin3:   ramp('#7a4a38', '#9a6446', '#bb8259', '#d9a173', '#e8bb91'),
  skin4:   ramp('#51302a', '#714432', '#93603f', '#b47d55', '#cc996e'),
  hairBlack:  ramp('#1a1423', '#2b2136', '#443654', '#5f4c70'),
  hairBrown:  ramp('#2b1a1a', '#4a2a22', '#6e4430', '#94603d'),
  hairAuburn: ramp('#4a1f24', '#7a3128', '#a8502d', '#d07a3c'),
  hairBlonde: ramp('#7c5524', '#b07f2e', '#d9aa43', '#f2d06c'),
  hairSilver: ramp('#4f4a63', '#7f7a94', '#aaa6bb', '#d6d3e0'),
  hairPink:   ramp('#6e2a57', '#a04578', '#d06fa0', '#ee9cc0'),
  hairTeal:   ramp('#17454f', '#25727a', '#3fa4a0', '#74d0c0'),
};

// Short colour names used all over the generators, always from a ramp above.
export const K = {
  ink: R.ink[0],
  shade: R.ink[1],
  white: R.cream[3],
  clear: null,
};

// Which ramp a colour belongs to, so an outline can be the same hue but dark.
const colorToRamp = new Map();
for (const [name, r] of Object.entries(R)) {
  r.forEach((c, i) => { if (!colorToRamp.has(c)) colorToRamp.set(c, { name, i, ramp: r }); });
}

// A dark colour in the same family as c. Falls back to deep plum.
export function outlineOf(c, depth = 0) {
  const e = colorToRamp.get(c);
  if (!e) return R.ink[0];
  if (e.name === 'ink') return R.ink[0];
  if (e.name === 'cream') return R.dirt[1];
  const idx = Math.max(0, Math.min(depth, e.ramp.length - 1));
  return e.ramp[idx];
}

export function rampOf(c) {
  return colorToRamp.get(c) || null;
}

export function allColors() {
  const s = new Set();
  Object.values(R).forEach((r) => r.forEach((c) => s.add(c)));
  return [...s];
}

export function toCss(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
