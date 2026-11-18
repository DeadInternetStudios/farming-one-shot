// UI pieces: nine-slice panels, slots, buttons, icons. Storybook parchment, wood and plum.
import { Img } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';
import { Rng } from '../rng.mjs';

function rounded(img, x, y, w, h, r, c) { return img.roundRect(x, y, w, h, r, c); }

// 24 x 24 parchment panel on a wood frame. Nine-slice border 8.
export function panel() {
  const img = new Img(24, 24);
  rounded(img, 0, 0, 24, 24, 5, R.ink[0]);
  rounded(img, 1, 1, 22, 22, 4, R.wood[1]);
  rounded(img, 1, 1, 22, 21, 4, R.wood[3]);
  img.hline(3, 1, 18, R.wood[5]);                       // top highlight
  rounded(img, 3, 3, 18, 18, 2, R.dirt[1]);
  rounded(img, 4, 4, 16, 16, 2, R.cream[1]);
  img.hline(4, 4, 16, R.cream[3]); img.vline(4, 4, 16, R.cream[2]);
  img.hline(5, 19, 14, R.cream[0]); img.vline(19, 5, 14, R.cream[0]);
  // paper grain only inside the four corners, so nine-slice stretching never smears it
  const rng = new Rng(4);
  for (const [cx, cy] of [[4, 4], [16, 4], [4, 16], [16, 16]]) {
    for (let i = 0; i < 3; i++) { const x = cx + rng.int(0, 3), y = cy + rng.int(0, 3); if (img.col(x, y) === R.cream[1]) img.set(x, y, R.cream[2]); }
  }
  // corner studs
  for (const [x, y] of [[2, 2], [21, 2], [2, 21], [21, 21]]) img.set(x, y, R.yellow[2]);
  return img;
}

// Darker pill panel used for the HUD over the world. 16 x 16, border 6.
export function panelDark() {
  const img = new Img(16, 16);
  rounded(img, 0, 0, 16, 16, 5, R.ink[0]);
  rounded(img, 1, 1, 14, 14, 4, R.ink[2]);
  rounded(img, 2, 2, 12, 12, 3, R.ink[1]);
  img.hline(4, 2, 8, R.ink[3]);
  return img;
}

// 20 x 20 inventory slot: sunken, warm.
export function slot() {
  const img = new Img(20, 20);
  rounded(img, 0, 0, 20, 20, 3, R.ink[0]);
  rounded(img, 1, 1, 18, 18, 2, R.dirt[2]);
  rounded(img, 2, 2, 16, 16, 2, R.dirt[1]);
  img.hline(2, 2, 16, R.dirt[0]); img.vline(2, 2, 16, R.dirt[0]);
  img.hline(3, 17, 15, R.dirt[2]);
  return img;
}

// 24 x 24 gold selector frame.
export function slotSelected() {
  const img = new Img(24, 24);
  img.frame(0, 0, 24, 24, R.ink[0]);
  img.frame(1, 1, 22, 22, R.yellow[3]);
  img.frame(2, 2, 20, 20, R.yellow[1]);
  for (const [x, y] of [[0, 0], [23, 0], [0, 23], [23, 23]]) img.set(x, y, null);
  for (const [x, y] of [[1, 1], [22, 1], [1, 22], [22, 22]]) img.set(x, y, R.yellow[4]);
  return img;
}

// Rounded buttons: 16 x 16, border 6. kind: leaf | wood | berry
export function button(kind = 'leaf', state = 'up') {
  const r = { leaf: R.leaf, wood: R.wood, berry: R.red, sky: R.teal }[kind];
  const img = new Img(16, 16);
  const down = state === 'down', hover = state === 'hover';
  rounded(img, 0, 0, 16, 16, 5, R.ink[0]);
  rounded(img, 1, down ? 2 : 1, 14, down ? 13 : 14, 4, r[1]);
  rounded(img, 1, down ? 2 : 1, 14, down ? 12 : 13, 4, hover ? r[4] : r[3]);
  if (!down) img.hline(3, 2, 10, hover ? r[5] ?? r[4] : r[4]);
  return img;
}

// Switched off: a flat plate that sits into the parchment, with none of the colour or shine of a live button.
export function disabledButton() {
  const img = new Img(16, 16);
  rounded(img, 0, 0, 16, 16, 5, 0xb9a889);
  rounded(img, 1, 1, 14, 14, 4, R.cream[0]);
  return img;
}

export function coin() {
  const i = new Img(10, 10);
  i.shaded(5, 5, 4.4, 4.4, R.yellow, { light: [-0.5, -0.8] });
  i.disc(5, 5, 1.8, R.yellow[2]); i.set(4, 4, R.yellow[4]);
  i.outline((c) => outlineOf(c));
  return i;
}

export function bolt() {
  const i = new Img(9, 11);
  i.poly([[5, 0], [1, 6], [4, 6], [3, 11], [8, 4], [5, 4]], R.yellow[3]);
  i.set(4, 2, R.yellow[4]); i.set(3, 4, R.yellow[4]);
  i.outline((c) => outlineOf(c));
  return i;
}

export function heart(fill = 'full') {
  const i = new Img(9, 8);
  const pts = [[1, 0], [2, 0], [3, 0], [5, 0], [6, 0], [7, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [3, 5], [4, 5], [5, 5], [4, 6]];
  for (const [x, y] of pts) {
    let c = R.red[3];
    if (fill === 'empty') c = R.ink[3];
    else if (fill === 'half' && x > 4) c = R.ink[3];
    else if (y === 0 || (y === 1 && x < 3)) c = R.red[4];
    else if (y >= 4) c = R.red[2];
    i.set(x, y, c);
  }
  if (fill !== 'empty') i.set(1, 1, R.cream[3]);
  i.outline((c) => outlineOf(c));
  return i;
}

export function arrowDown() {
  const i = new Img(9, 6);
  i.poly([[0, 0], [9, 0], [4.5, 6]], R.cream[3]);
  i.outline(() => R.ink[0]);
  return i;
}

export function arrowRight() {
  const i = new Img(6, 9);
  i.poly([[0, 0], [6, 4.5], [0, 9]], R.cream[3]);
  i.outline(() => R.ink[0]);
  return i;
}

export function check() {
  const i = new Img(10, 8);
  i.line(1, 4, 3, 6, R.leaf[4]); i.line(3, 6, 8, 1, R.leaf[4]); i.line(1, 3, 3, 5, R.leaf[3]); i.line(3, 5, 8, 0, R.leaf[3]);
  return i;
}

export function seasonIcon(season) {
  const i = new Img(11, 11);
  if (season === 'spring') {
    for (const [x, y] of [[5, 2], [8, 4], [7, 8], [3, 8], [2, 4]]) i.disc(x, y, 1.8, R.blossom[3]);
    i.disc(5, 5, 1.4, R.yellow[3]);
  } else if (season === 'summer') {
    // a melon wedge: the clock already shows a sun for clear weather, and a second one beside it read as two
    i.blit(Img.ascii([
      '.RRRRRRRRR.',
      '.RKRRRRRKR.',
      '.WRRRKRRRW.',
      '..GWRRRWG..',
      '...GWWWG...',
      '....GGG....',
    ], { R: R.red[3], K: R.ink[0], W: R.cream[3], G: R.leaf[3] }), 0, 2);
  } else if (season === 'fall') {
    i.poly([[5, 0], [9, 4], [8, 8], [5, 10], [2, 8], [1, 4]], R.autumn[3]);
    i.vline(5, 3, 8, R.autumn[1]); i.set(4, 4, R.autumn[4]); i.set(6, 6, R.autumn[2]);
  } else {
    i.vline(5, 0, 11, R.snow[3]); i.hline(0, 5, 11, R.snow[3]); i.line(1, 1, 9, 9, R.snow[3]); i.line(9, 1, 1, 9, R.snow[3]);
    i.set(5, 5, R.snow[4]);
  }
  i.outline((c) => outlineOf(c));
  return i;
}

/** A cat's face, for the shop: the sitting cat is too small to read as a cat at the size of a list row. */
export function catIcon() {
  return Img.ascii([
    '................',
    '..oo........oo..',
    '.oooo......oooo.',
    '.opooo....ooopo.',
    '.oooooooooooooo.',
    '.oooooooooooooo.',
    '.oOooooOOooooOo.',
    '.ooowEoooowEooo.',
    '.oooEEooooEEooo.',
    '.ooooollllooooo.',
    '.ooooolpplooooo.',
    '.ooooollllooooo.',
    '..oooooooooooo..',
    '...oooooooooo...',
    '................',
    '................',
  ], { o: R.orange[3], O: R.orange[1], p: R.pink[3], l: R.cream[3], E: R.ink[0], w: R.cream[3] }).outline((c) => outlineOf(c));
}

/** A hen house, for the shop: the egg basket it stood in for said nothing about a coop. */
export function coopIcon() {
  return Img.ascii([
    '................',
    '.......rr.......',
    '......rrrr......',
    '.....rrrrrr.....',
    '....rrrrrrrr....',
    '...rrrrrrrrrr...',
    '..rrrrrrrrrrrr..',
    '.RRRRRRRRRRRRRR.',
    '..wwvwwvwwvwwv..',
    '..wwvwwvwwvwwv..',
    '..wwwwwkkwwwww..',
    '..wwwwkkkkwwww..',
    '..wwwwkkkkwwww..',
    '..wwwwkkkkwwww..',
    '..bbbbbbbbbbbb..',
    '................',
  ], { r: R.red[3], R: R.red[1], w: R.wood[4], v: R.wood[3], k: R.ink[0], b: R.wood[2] }).outline((c) => outlineOf(c));
}

export function weatherIcon(kind) {
  const i = new Img(14, 12);
  const cloud = (c = R.snow) => { i.disc(5, 6, 3.2, c[3]); i.disc(9, 6, 3.6, c[3]); i.rect(3, 6, 9, 4, c[3]); i.hline(3, 9, 9, c[1]); i.set(5, 4, c[4]); };
  if (kind === 'sun') { i.disc(7, 6, 3.6, R.yellow[3]); i.set(5, 4, R.yellow[4]); for (const [x, y] of [[7, 0], [7, 11], [1, 6], [13, 6], [3, 1], [11, 1], [3, 11], [11, 11]]) i.set(x, y, R.yellow[2]); }
  else if (kind === 'cloud') cloud();
  else if (kind === 'rain') { cloud(R.stone); for (const [x, y] of [[4, 10], [7, 11], [10, 10]]) { i.set(x, y, R.water[4]); i.set(x - 1, y + 1, R.water[3]); } }
  else if (kind === 'storm') { cloud(R.ink); i.poly([[7, 7], [4, 11], [6, 11], [5, 12], [9, 8], [7, 8]], R.yellow[4]); }
  else if (kind === 'snow') { cloud(R.snow); for (const [x, y] of [[4, 10], [7, 11], [10, 10]]) i.set(x, y, R.cream[3]); }
  else if (kind === 'moon') {
    // a crescent with one star beside it
    i.disc(5.5, 6, 5, R.yellow[4]);
    i.disc(8.4, 4.6, 4.3, null);
    for (const [x, y] of [[2, 7], [3, 9], [4, 10]]) i.set(x, y, R.yellow[3]);
    i.set(2, 4, R.cream[3]);
    for (const [x, y] of [[11, 7], [10, 7], [12, 7], [11, 6], [11, 8]]) i.set(x, y, R.cream[3]);
  }
  i.outline((c) => outlineOf(c));
  return i;
}

// Touch controls
export function stickBase() {
  const i = new Img(56, 56);
  i.disc(28, 28, 27, R.ink[0]);
  i.disc(28, 28, 26, R.ink[2]);
  i.disc(28, 28, 22, R.ink[1]);
  for (let a = 0; a < 4; a++) { const t = (a / 4) * Math.PI * 2; const x = 28 + Math.cos(t) * 20, y = 28 + Math.sin(t) * 20; i.set(Math.round(x), Math.round(y), R.ink[4]); i.set(Math.round(x + Math.cos(t)), Math.round(y + Math.sin(t)), R.ink[3]); }
  return i;
}
export function stickKnob() {
  const i = new Img(26, 26);
  i.shaded(13, 13, 12, 12, R.cream, { light: [-0.5, -0.8] });
  i.outline(() => R.ink[0]);
  return i;
}
// The touch action button: a cream ring so it stands out on grass, and a green dish for the item in your hand.
export function actionButton() {
  const i = new Img(36, 36);
  i.disc(18, 18, 17.5, R.ink[0]);
  i.disc(18, 18, 16.5, R.cream[3]);
  i.disc(18, 18, 15.5, R.cream[1]);
  i.disc(18, 18, 14.5, R.ink[0]);
  i.shaded(18, 18, 13.5, 13.5, R.leaf, { light: [-0.4, -0.9] });
  return i;
}

// A little pointing hand for the action button when nothing is in your hand.
export function hand() {
  const i = Img.ascii([
    '....ss....',
    '....ss....',
    '....ss....',
    '....ssss..',
    '....ssssss',
    's...ssssss',
    'ss.sssssss',
    'ssssssssss',
    '.sssssssss',
    '..ssssssss',
    '..ssssssss',
    '...ssssss.',
  ], { s: R.skin1[4] });
  for (const [x, y] of [[6, 3], [6, 4], [8, 4], [7, 5], [9, 5]]) i.set(x, y, R.skin1[3]);
  for (let x = 3; x < 9; x++) i.set(x, 11, R.skin1[2]);
  i.set(1, 6, R.skin1[3]); i.set(2, 7, R.skin1[3]);
  return i.pad(1, 1, 1, 1).outline(() => R.ink[0]);
}

// Menu tab icons, 12 x 12, drawn from letter maps. They sit on wood and on leaf green, so they are light on a dark edge.
const TAB_MAPS = {
  bag: [
    '....kkkk....',
    '...kLLLLk...',
    '...kLkkLk...',
    '..kkkkkkkk..',
    '.kbbbbbbbbk.',
    'kbbbbbbbbbbk',
    'kbbbYYYYbbbk',
    'kbbbYGGYbbbk',
    'kbbbbbbbbbbk',
    'kddddddddddk',
    '.kddddddddk.',
    '..kkkkkkkk..',
  ],
  lantern: [
    '.....kk.....',
    '....kccek...',
    '...kkkkkk...',
    '..kRRRRRRk..',
    '.kRHrrrrRRk.',
    '.kRryyyyrRk.',
    '.kRryyyyrRk.',
    '.kRRrrrrRRk.',
    '..kRRRRRRk..',
    '...kkkkkk...',
    '....kddk....',
    '.....kk.....',
  ],
  // a hammer: a broad stone head on a wooden handle, as chunky as its neighbours
  craft: [
    '.kkkkkkkkkk.',
    'kSSSSSSSSSSk',
    'kSssssssssdk',
    'kssssssssddk',
    'kddddddddddk',
    '.kkkkwwkkkk.',
    '....kwwk....',
    '....kwwk....',
    '....kwWk....',
    '....kwWk....',
    '....kWWk....',
    '.....kk.....',
  ],
  friends: [
    '............',
    '..kkk..kkk..',
    '.kRRRkkRRRk.',
    'kRHHRRRRRRRk',
    'kRHRRRRRRRRk',
    'kRRRRRRRRRRk',
    '.kRRRRRRRRk.',
    '..kRRRRRRk..',
    '...kRRRRk...',
    '....kRRk....',
    '.....kk.....',
    '............',
  ],
};

export function tabIcon(kind) {
  const i = new Img(12, 12);
  if (kind === 'options') {
    // a cog: a ring with eight teeth and a hole
    const c = 5.5;
    for (const [x, y, w, h] of [[5, 1, 2, 2], [5, 9, 2, 2], [1, 5, 2, 2], [9, 5, 2, 2], [2, 2, 2, 2], [8, 2, 2, 2], [2, 8, 2, 2], [8, 8, 2, 2]]) i.rect(x, y, w, h, R.stone[5]);
    i.disc(c, c, 3.9, R.stone[5]);
    i.disc(c, c, 3.2, R.stone[6]);
    i.set(3, 3, R.cream[3]); i.set(4, 2, R.cream[3]); i.set(2, 4, R.cream[3]); i.set(5, 2, R.cream[3]);
    i.disc(c, c, 1.8, null);
    i.outline(() => R.ink[0]);
    return i;
  }
  const colors = {
    k: R.ink[0], L: R.wood[3], b: R.wood[5], d: R.wood[3], Y: R.yellow[4], G: R.yellow[3],
    S: R.stone[6], s: R.stone[5], w: R.wood[4], W: R.wood[2],
    c: R.wood[3], e: R.wood[2], R: R.red[3], H: R.pink[3], r: R.red[4], y: R.yellow[4],
  };
  if (kind === 'friends') { colors.R = R.red[3]; colors.H = R.pink[4]; }
  if (kind === 'craft') colors.d = R.stone[3];
  if (kind === 'lantern') { colors.R = R.orange[3]; colors.H = R.orange[4]; colors.r = R.orange[4]; colors.y = R.yellow[4]; colors.d = R.red[3]; }
  TAB_MAPS[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') i.set(x, y, colors[ch] ?? R.ink[0]); }));
  return i;
}
