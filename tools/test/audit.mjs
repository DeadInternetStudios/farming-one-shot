// Asks the running game where everything on screen is, because a picture of a canvas cannot be read by a page checker.
// `audit(page, scenes)` returns one line for each thing that is wrong:
//   off      something you can see or press sticks out past the edge of the screen
//   overlap  two pieces of text sit on top of each other
//   spill    text runs out of the plate (panel, button, chip) it is written on
// With a pop-up open only the pop-up is looked at, since the world behind it is dimmed and covered.
export async function audit(page, scenes = ['UI'], { everything = false } = {}) {
  return page.evaluate(([keys, all]) => {
    const found = [];
    const game = window.__lh.game();
    const name = (o) => (o.type === 'BitmapText' ? `"${String(o.text).replace(/\s+/g, ' ').slice(0, 28)}"` : `${o.type}${o.frame?.name ? ` ${o.frame.name}` : ''}`);
    const rect = (o) => { const b = o.getBounds(); return { l: b.x, t: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const show = (r) => `${Math.round(r.l)},${Math.round(r.t)} ${Math.round(r.w)}x${Math.round(r.h)}`;
    for (const key of keys) {
      const scene = game.scene.getScene(key);
      if (!scene || !scene.sys.isVisible()) continue;
      const view = scene.cameras.main.worldView;
      const live = [];
      const walk = (list, ok) => {
        for (const o of list) {
          const here = ok && o.visible && o.active !== false && o.alpha > 0.05;
          if (o.list) walk(o.list, here);
          if (here) live.push(o);
        }
      };
      walk(scene.children.list, true);
      const popup = !all && live.some((o) => o.depth >= 40 && (o.type === 'NineSlice' || o.type === 'BitmapText'));
      const layer = popup ? live.filter((o) => o.depth >= 40) : live;
      const texts = layer.filter((o) => o.type === 'BitmapText' && String(o.text).trim() !== '');
      const plates = layer.filter((o) => o.type === 'NineSlice');
      const taps = layer.filter((o) => o.type === 'Zone' && o.input?.enabled);
      const tag = `${key}${popup ? ' pop-up' : ''}`;

      for (const o of [...texts, ...plates, ...taps]) {
        const r = rect(o);
        if (o.type === 'Zone' && r.w >= view.width - 1 && r.h >= view.height - 1) continue;
        if (r.l < -1 || r.t < -1 || r.r > view.width + 1 || r.b > view.height + 1) found.push(`off      ${tag}: ${name(o)} at ${show(r)} on a ${Math.round(view.width)}x${Math.round(view.height)} screen`);
      }

      const boxes = texts.map((o) => ({ o, r: rect(o) }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r, b = boxes[j].r;
          const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l) - 2;
          const iy = Math.min(a.b, b.b) - Math.max(a.t, b.t) - 2;
          if (ix > 0 && iy > 0) found.push(`overlap  ${tag}: ${name(boxes[i].o)} (${show(a)}) and ${name(boxes[j].o)} (${show(b)})`);
        }
      }

      for (const { o, r } of boxes) {
        const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
        let best = null;
        for (const p of plates) {
          const q = rect(p);
          if (cx > q.l && cx < q.r && cy > q.t && cy < q.b && q.w < view.width - 2 && (!best || q.w * q.h < best.w * best.h)) best = q;
        }
        if (best && (r.l < best.l - 1 || r.r > best.r + 1 || r.t < best.t - 1 || r.b > best.b + 1)) found.push(`spill    ${tag}: ${name(o)} (${show(r)}) runs out of its plate (${show(best)})`);
      }
    }
    return [...new Set(found)];
  }, [scenes, everything]);
}

/**
 * Runs `audit` and prints one line for each problem. Returns how many there were.
 * A problem has to show up twice, a moment apart, so a panel that is still sliding into place is not reported.
 */
export async function check(page, label, scenes, opts) {
  let found = await audit(page, scenes, opts);
  if (found.length > 0) {
    await page.waitForTimeout(450);
    const again = new Set(await audit(page, scenes, opts));
    found = found.filter((f) => again.has(f));
  }
  for (const f of found) console.log(`[probe] FAIL ${label}: ${f}`);
  if (found.length === 0) console.log(`[probe] ok   ${label}`);
  return found.length;
}

/** Waits until the interface has been laid out again for a screen of this shape. A slow machine can take seconds to do it. */
export async function settle(page, landscape, scene = 'UI') {
  await page.waitForFunction(([key, wide]) => {
    const v = window.__lh.game().scene.getScene(key).cameras.main.worldView;
    return v.width > v.height === wide;
  }, [scene, landscape], { timeout: 15000 });
  await page.waitForTimeout(900);
}
