// Paper-doll characters. Body is drawn at 16 x 24 inside a 32 x 32 frame, so tools have room to swing.
// Feet touch the ground at frame y = 29. The sprite origin is (16, 30). The frame is 40 tall so tools can swing below the feet.
import { Img, step } from '../px.mjs';
import { R, outlineOf } from '../palette.mjs';

export const FW = 32, FH = 40;
export const OX = 8, OY = 6;

// Hair styles draw a back layer (behind head) and a front layer (over head).
const HAIR = {
  short: {
    back: () => {},
    front(c, h, dir) {
      if (dir === 'down') {
        c.ellipse(8, 6.2, 5.9, 5.3, h[2]);
        c.rect(0, 6, 16, 12, null); // keep only above the brow...
        c.ellipse(8, 6.2, 5.9, 5.3, null, (x, y) => (y <= 5 ? h[2] : undefined));
        for (const x of [3, 4, 11, 12]) { c.set(x, 6, h[2]); c.set(x, 7, h[1]); }
        c.hline(4, 5, 3, h[2]); c.hline(9, 5, 4, h[2]);
        c.set(7, 5, h[1]); c.set(8, 5, h[2]); // parting
        c.hline(5, 2, 6, h[3]); c.hline(4, 3, 3, h[3]);
        c.hline(3, 5, 1, h[1]); c.hline(12, 5, 1, h[1]);
      } else if (dir === 'up') {
        c.ellipse(8, 7, 5.9, 5.6, h[2], (x, y) => (y <= 10 ? h[2] : undefined));
        c.hline(5, 2, 6, h[3]); c.hline(4, 3, 4, h[3]);
        c.hline(3, 10, 10, h[1]); c.hline(4, 9, 8, h[2]);
        for (let x = 4; x < 12; x += 2) c.set(x, 8, h[1]);
      } else {
        c.ellipse(8, 6.5, 5.6, 5.2, null, (x, y) => (y <= 5 || (x <= 7 && y <= 9) ? h[2] : undefined));
        c.hline(5, 2, 5, h[3]); c.hline(4, 3, 3, h[3]);
        c.hline(9, 5, 3, h[2]); c.set(12, 5, h[1]); c.set(11, 6, h[1]);
        c.vline(3, 6, 4, h[1]); c.vline(4, 7, 3, h[1]);
      }
    },
  },
  bob: {
    back(c, h, dir) {
      if (dir === 'down') { c.roundRect(2, 3, 12, 10, 3, h[1]); }
      else if (dir === 'up') { c.roundRect(2, 2, 12, 12, 3, h[2]); }
      else c.roundRect(2, 3, 8, 10, 3, h[1]);
    },
    front(c, h, dir) {
      if (dir === 'down') {
        c.ellipse(8, 6.2, 6, 5.3, null, (x, y) => (y <= 5 ? h[2] : undefined));
        for (const x of [2, 3, 12, 13]) c.vline(x, 5, 6, h[2]);
        c.vline(2, 6, 5, h[1]); c.vline(13, 6, 5, h[1]);
        c.hline(3, 5, 4, h[2]); c.hline(9, 5, 4, h[2]); c.set(6, 6, h[2]); c.set(10, 6, h[2]);
        c.hline(5, 2, 6, h[3]); c.hline(4, 3, 3, h[3]);
      } else if (dir === 'up') {
        c.roundRect(2, 2, 12, 12, 3, h[2]);
        c.hline(5, 3, 6, h[3]); c.hline(4, 4, 3, h[3]);
        c.hline(3, 13, 10, h[1]); c.hline(3, 12, 10, h[1]);
      } else {
        c.ellipse(8, 6.5, 5.6, 5.2, null, (x, y) => (y <= 5 || x <= 7 ? h[2] : undefined));
        c.roundRect(2, 3, 7, 10, 3, h[2]);
        c.hline(5, 2, 5, h[3]); c.hline(4, 3, 3, h[3]);
        c.hline(9, 5, 3, h[2]); c.set(12, 5, h[1]);
        c.vline(2, 8, 5, h[1]); c.hline(3, 12, 5, h[1]);
      }
    },
  },
  long: {
    back(c, h, dir) {
      if (dir === 'down') { c.roundRect(2, 3, 12, 14, 3, h[1]); }
      else if (dir === 'up') { c.roundRect(2, 2, 12, 16, 3, h[2]); c.hline(4, 17, 8, h[1]); }
      else { c.roundRect(2, 3, 8, 15, 3, h[1]); }
    },
    front: (c, h, dir) => HAIR.bob.front(c, h, dir),
  },
  messy: {
    back: () => {},
    front(c, h, dir) {
      HAIR.short.front(c, h, dir);
      if (dir === 'down' || dir === 'up') { c.set(5, 1, h[3]); c.set(7, 0, h[2]); c.set(10, 1, h[2]); c.set(9, 0, h[3]); c.set(12, 3, h[2]); c.set(3, 3, h[2]); }
      else { c.set(6, 1, h[3]); c.set(8, 0, h[2]); c.set(10, 1, h[2]); c.set(4, 2, h[2]); }
    },
  },
  bun: {
    back: () => {},
    front(c, h, dir) {
      HAIR.short.front(c, h, dir);
      if (dir === 'side') c.disc(5, 2.5, 2.4, h[2], (x, y) => h[y < 2 ? 3 : 2]);
      else { c.disc(8, 1.8, 2.6, h[2]); c.set(7, 0, h[3]); c.set(8, 0, h[3]); }
    },
  },
  curly: {
    back(c, h, dir) { c.ellipse(8, 7.5, 7.4, 7, h[1]); },
    front(c, h, dir) {
      if (dir === 'up') { c.ellipse(8, 7.5, 7.4, 7, h[2]); c.hline(5, 2, 6, h[3]); return; }
      c.ellipse(8, 7, 7.4, 6.6, null, (x, y) => (y <= 5 || x <= 2 || x >= 13 || (dir === 'side' && x <= 6) ? h[2] : undefined));
      c.hline(4, 2, 7, h[3]); c.hline(3, 3, 3, h[3]); c.set(11, 3, h[3]);
      for (const [x, y] of [[2, 4], [13, 5], [4, 5], [11, 5], [8, 4]]) c.set(x, y, h[1]);
    },
  },
  ponytail: {
    back(c, h, dir) {
      if (dir === 'down') { c.roundRect(10, 3, 5, 9, 2, h[1]); }
      else if (dir === 'up') { c.roundRect(5, 8, 6, 10, 2, h[2]); c.hline(6, 17, 4, h[1]); }
      else { c.roundRect(1, 5, 5, 11, 2, h[1]); c.vline(1, 12, 4, h[0]); }
    },
    front: (c, h, dir) => HAIR.short.front(c, h, dir),
  },
};

const SHIRT = (c, sh, y0, dir) => {
  // torso 8 wide, 6 tall at y0
  const x0 = dir === 'side' ? 5 : 4, w = dir === 'side' ? 6 : 8;
  for (let y = 0; y < 6; y++) for (let x = 0; x < w; x++) {
    const light = x === 0 ? 3 : x < w - 2 ? 2 : 1;
    c.set(x0 + x, y0 + y, y === 5 ? sh[1] : sh[light]);
  }
};

// pose: { bob, armL, armR, legL, legR } in pixels. Side view uses dx for stride.
export function drawBody(spec, dir, pose = {}) {
  const c = new Img(16, 24);
  const sk = spec.skin, h = spec.hair, sh = spec.shirt, pn = spec.pants, shoe = spec.shoes ?? R.wood;
  const bob = pose.bob ?? 0;
  const style = HAIR[spec.hairStyle ?? 'short'];
  const body = new Img(16, 24);

  // legs
  if (dir === 'side') {
    const lf = pose.legF ?? 0, lb = pose.legB ?? 0;
    // back leg then front leg
    for (let y = 0; y < 4; y++) { body.hline(6 + lb, 18 + y - (lb !== 0 ? 0 : 0), 3, pn[1]); }
    body.hline(6 + lb + 0, 22, 4, shoe[2]); body.hline(6 + lb, 23, 4, shoe[1]);
    for (let y = 0; y < 4; y++) { body.hline(6 + lf, 18 + y, 3, pn[2]); body.set(6 + lf, 18 + y, pn[3]); }
    body.hline(6 + lf + 0, 22, 4, shoe[3]); body.hline(6 + lf, 23, 4, shoe[1]);
  } else {
    const lL = pose.legL ?? 0, lR = pose.legR ?? 0;
    for (const [x0, up] of [[4, lL], [9, lR]]) {
      const len = 4 - (up > 0 ? up : 0);
      for (let y = 0; y < len; y++) for (let x = 0; x < 3; x++) body.set(x0 + x, 18 + y, pn[x === 0 ? 3 : x === 2 ? 1 : 2]);
      const fy = 22 - (up > 0 ? up : 0);
      body.hline(x0, fy, 3, shoe[3]); body.hline(x0, fy + 1, 3, shoe[1]);
    }
  }

  // torso
  SHIRT(body, sh, 12, dir);
  // belt line / hem
  if (dir !== 'side') { body.hline(4, 17, 8, pn[1]); }
  else body.hline(5, 17, 6, pn[1]);

  // arms
  const armCol = (x, y, w, h2) => { for (let j = 0; j < h2; j++) for (let i = 0; i < w; i++) body.set(x + i, y + j, sh[i === 0 ? 3 : 1 + (i === w - 1 ? 0 : 1)]); };
  if (dir === 'side') {
    const ax = 7 + (pose.armX ?? 0);
    for (let j = 0; j < 4; j++) { body.set(ax, 13 + j + (pose.armDy ?? 0), sh[3]); body.set(ax + 1, 13 + j + (pose.armDy ?? 0), sh[2]); }
    body.set(ax, 17 + (pose.armDy ?? 0), sk[3]); body.set(ax + 1, 17 + (pose.armDy ?? 0), sk[2]);
  } else {
    const aL = pose.armL ?? 0, aR = pose.armR ?? 0;
    for (const [x, d] of [[2, aL], [12, aR]]) {
      for (let j = 0; j < 4; j++) { body.set(x, 13 + j + d, sh[3]); body.set(x + 1, 13 + j + d, sh[1]); }
      body.set(x, 17 + d, sk[3]); body.set(x + 1, 17 + d, sk[2]);
    }
  }

  // move the whole body by the bob
  const bodyShift = new Img(16, 24);
  bodyShift.blit(body, 0, bob);

  // assemble: back hair, body, head, face, front hair
  if (style.back) style.back(c, h, dir);
  c.blit(bodyShift, 0, 0);
  // head
  const head = new Img(16, 24);
  if (dir === 'side') head.ellipse(8, 7, 5, 5, sk[3]);
  else head.ellipse(8, 7, 5.5, 5, sk[3]);
  head.ellipse(8, 7, dir === 'side' ? 5 : 5.5, 5, null, (x, y) => (y >= 11 || (dir !== 'side' && x >= 12) || (dir === 'side' && x >= 12 && y > 8) ? sk[2] : x <= 4 && y >= 5 && y <= 8 ? sk[4] : undefined));
  if (dir === 'down') {
    head.rect(5, 7, 1, 2, h[0] === R.hairBlack[0] ? R.ink[0] : R.ink[1]);
    head.rect(10, 7, 1, 2, R.ink[1]);
    head.set(5, 7, R.ink[0]); head.set(10, 7, R.ink[0]);
    head.over(4, 9, R.pink[3], 130); head.over(11, 9, R.pink[3], 130);
    head.set(7, 10, sk[1]); head.set(8, 10, sk[1]);
  } else if (dir === 'side') {
    head.rect(10, 7, 1, 2, R.ink[1]); head.set(10, 7, R.ink[0]);
    head.over(11, 9, R.pink[3], 130);
    head.set(13, 8, sk[3]); head.set(13, 9, sk[2]);
    head.set(11, 10, sk[1]);
  }
  c.blit(head, 0, bob > 0 ? 1 : bob < 0 ? -1 : 0);
  const hairLayer = new Img(16, 24);
  style.front(hairLayer, h, dir);
  c.blit(hairLayer, 0, bob > 0 ? 1 : bob < 0 ? -1 : 0);
  if (spec.hat === 'straw') drawStrawHat(c, dir, bob);
  c.outline((col) => outlineOf(col, 0));
  return c;
}

function drawStrawHat(c, dir, bob) {
  const y = 3 + (bob > 0 ? 1 : bob < 0 ? -1 : 0);
  const s = R.sand;
  // brim
  c.ellipse(8, y + 2, 8, 2.6, s[2]);
  c.ellipse(8, y + 2, 8, 2.6, null, (px, py, nx, ny) => (ny > 0.35 ? s[1] : ny < -0.5 ? s[3] : undefined));
  // crown
  c.ellipse(8, y - 0.5, 4.4, 3.2, s[3]);
  c.ellipse(8, y - 0.5, 4.4, 3.2, null, (px, py, nx, ny) => (ny > 0.4 ? s[2] : ny < -0.4 ? s[4] : undefined));
  c.hline(4, y + 1, 8, R.red[3]);
  c.hline(4, y + 2 - 0, 0, null);
  for (let x = 1; x < 15; x += 3) c.set(x, y + 3, s[0]);
}

// ---------- tools ----------
export const TIERS = {
  basic: { metal: R.stone, handle: R.wood },
  copper: { metal: R.orange, handle: R.wood },
  silver: { metal: R.stone.slice().map((_, i) => R.snow[Math.min(4, i)]), handle: R.wood },
  gold: { metal: R.yellow, handle: R.wood },
};

// draw a tool with its grip at (hx, hy) pointing at angle (deg, 0 = right, 90 = down).
export function drawTool(img, tool, hx, hy, angle, tier = 'basic') {
  const t = TIERS[tier];
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const px = -dy, py = dx; // perpendicular
  const P = (d, s = 0) => [Math.round(hx + dx * d + px * s), Math.round(hy + dy * d + py * s)];
  const line = (d0, d1, s, col) => { const [x0, y0] = P(d0, s), [x1, y1] = P(d1, s); img.line(x0, y0, x1, y1, col); };
  const m = t.metal, w = t.handle;
  if (tool === 'hoe') {
    line(-2, 10, 0, w[3]); line(-2, 10, 1, w[2]);
    line(9, 11, -1, m[4]); line(10, 12, 0, m[3]); line(10, 12, 1, m[3]);
    const [bx, by] = P(11, 0);
    for (let s = -3; s <= 3; s++) { const [x, y] = P(11, s); img.set(x, y, s < 0 ? m[4] : m[3]); }
    for (let s = -2; s <= 3; s++) { const [x, y] = P(12, s); img.set(x, y, m[2]); }
  } else if (tool === 'axe') {
    line(-2, 10, 0, w[3]); line(-2, 10, 1, w[2]);
    for (let d = 7; d <= 11; d++) for (let s = -3; s <= 1; s++) { const [x, y] = P(d, s); img.set(x, y, s <= -2 ? m[4] : s < 0 ? m[3] : m[2]); }
    const [x, y] = P(11, -3); img.set(x, y, m[5]);
  } else if (tool === 'pick') {
    line(-2, 11, 0, w[3]); line(-2, 11, 1, w[2]);
    for (let s = -5; s <= 5; s++) {
      const bend = Math.abs(s) > 3 ? 1 : 0;
      const [x, y] = P(10 - bend, s); img.set(x, y, s <= 0 ? m[4] : m[3]);
      const [x2, y2] = P(11 - bend, s); img.set(x2, y2, m[2]);
    }
  } else if (tool === 'can') {
    // squat can with a spout; angle controls the tilt
    const [x, y] = P(5, 0);
    const w2 = R.teal;
    const body = new Img(10, 10);
    body.roundRect(0, 1, 7, 7, 2, w2[3]);
    body.vline(1, 2, 5, w2[4]); body.hline(1, 7, 6, w2[1]);
    body.vline(5, 2, 5, w2[2]);
    const tilt = Math.max(0, Math.min(5, Math.round(angle / 14)));
    body.line(6, 3, 9, 0 + tilt, w2[3]); body.line(6, 4, 9, 1 + tilt, w2[2]);
    body.set(9, tilt, w2[4]);
    body.line(1, 1, 3, -0, w2[4]);
    body.outline(() => w2[0]);
    img.blit(body, x - 4, y - 5);
  } else if (tool === 'rod') {
    // a slim pole: thick at the grip, thin at the tip, with a little reel
    line(-3, 6, 0, w[3]); line(-3, 6, 1, w[2]);
    line(7, 13, 0, w[3]);
    const [rx, ry] = P(2, 2); img.set(rx, ry, R.stone[4]); img.set(rx + 1, ry, R.stone[3]);
    const [tx, ty] = P(13, 0); img.set(tx, ty, R.red[3]);
  } else if (tool === 'scythe') {
    line(-2, 12, 0, w[3]); line(-2, 12, 1, w[2]);
    for (let s = 0; s <= 9; s++) { const [x, y] = P(11 - Math.round(Math.sin(s / 9 * 1.6) * 3), s - 1); img.set(x, y, s < 5 ? m[4] : m[3]); const [x2, y2] = P(12 - Math.round(Math.sin(s / 9 * 1.6) * 3), s - 1); img.set(x2, y2, m[2]); }
  }
}

// ---------- poses ----------
export const WALK = [
  { bob: 0, legL: 0, legR: 1, armL: 0, armR: 0 },
  { bob: -1, legL: 0, legR: 0, armL: 1, armR: -1 },
  { bob: 0, legL: 1, legR: 0, armL: 0, armR: 0 },
  { bob: -1, legL: 0, legR: 0, armL: -1, armR: 1 },
];
export const WALK_SIDE = [
  { bob: 0, legF: 2, legB: -2, armX: -2 },
  { bob: -1, legF: 0, legB: 0, armX: 0 },
  { bob: 0, legF: -2, legB: 2, armX: 2 },
  { bob: -1, legF: 0, legB: 0, armX: 0 },
];

// Whole frame (32 x 32) for a pose.
export function frame(spec, dir, pose) {
  const f = new Img(FW, FH);
  f.blit(drawBody(spec, dir, pose), OX, OY);
  return f;
}

// ---------- tool swings ----------
// Hands in body-local coords. Side faces right (flip for left). The tool sits behind the body when facing up.
const SWING = {
  side: [
    { pose: { armX: -2, armDy: -4 }, hand: [5.5, 13], angle: -128 },
    { pose: { armX: 0, armDy: -3 }, hand: [7.5, 14], angle: -72 },
    { pose: { armX: 2, armDy: 0 }, hand: [9.5, 17], angle: 6 },
    { pose: { armX: 3, armDy: 1 }, hand: [10.5, 18], angle: 52 },
  ],
  down: [
    { pose: { armR: -4 }, hand: [12.5, 13], angle: -112 },
    { pose: { armR: -3 }, hand: [12.5, 14], angle: -70 },
    { pose: { armR: 1 }, hand: [12.5, 18], angle: 24 },
    { pose: { armR: 2 }, hand: [12.5, 19], angle: 66 },
  ],
  up: [
    { pose: { armR: -4 }, hand: [12.5, 13], angle: -110 },
    { pose: { armR: -3 }, hand: [12.5, 14], angle: -84 },
    { pose: { armR: -1 }, hand: [12.5, 16], angle: -72 },
    { pose: { armR: 0 }, hand: [12.5, 17], angle: -66 },
  ],
};
export const TOOLS = ['hoe', 'axe', 'pick', 'can', 'scythe'];

/** The rod swings back, forward, out, and then rests pointing over the water. */
const ROD_ANGLES = {
  side: [-150, -95, -40, -28],
  down: [-130, -70, 10, 38],
  up: [-125, -100, -75, -62],
};
/** Where the tip of the resting rod sits, in pixels from the feet, for a sprite facing right (mirror x for left). */
export function rodTip(dir) {
  const S = SWING[dir][3];
  const a = (ROD_ANGLES[dir][3] * Math.PI) / 180;
  return { x: Math.round(OX + S.hand[0] + Math.cos(a) * 13 - 16), y: Math.round(OY + S.hand[1] + Math.sin(a) * 13 - 30) };
}

export function toolFrame(spec, dir, t, tool, tier = 'basic') {
  const f = new Img(FW, FH);
  const S = SWING[dir][t];
  const body = drawBody(spec, dir, S.pose);
  const ti = new Img(FW, FH);
  // the watering can tilts forward as the swing goes on; every other tool follows the swing angle
  const angle = tool === 'can' ? (dir === 'up' ? 0 : [0, 14, 42, 70][t]) : tool === 'rod' ? ROD_ANGLES[dir][t] : S.angle;
  drawTool(ti, tool, OX + S.hand[0], OY + S.hand[1], angle, tier);
  ti.outline((c) => outlineOf(c));
  if (dir === 'up') { f.blit(ti, 0, 0); f.blit(body, OX, OY); } else { f.blit(body, OX, OY); f.blit(ti, 0, 0); }
  return f;
}

export function idleFrame(spec, dir) { return frame(spec, dir, { bob: 0 }); }
