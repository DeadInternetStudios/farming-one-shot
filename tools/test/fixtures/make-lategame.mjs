// Makes lategame.js from midgame.js: the same farm in a year far past the first, with money and totals at the widest the screens could show.
//   node tools/test/fixtures/make-lategame.mjs
// Use it like the midgame one: 100x shots <url> --init-script tools/test/fixtures/lategame.js
import { readFileSync, writeFileSync } from 'node:fs';

const mid = readFileSync('tools/test/fixtures/midgame.js', 'utf8');
const quoted = /localStorage\.setItem\('lantern-hollow:save:v1', ("(?:[^"\\]|\\.)*")\)/.exec(mid);
if (!quoted) throw new Error('midgame.js has no save in it');
const save = JSON.parse(JSON.parse(quoted[1]));

save.day = 99;
save.player.gold = 99_999_999;
for (const k of Object.keys(save.stats)) save.stats[k] = 99_999_999;
save.player.slots = save.player.slots.map((s) => (s ? { ...s, n: s.id.startsWith('seed-') || ['hoe', 'can', 'axe', 'pick', 'scythe', 'rod'].includes(s.id) ? s.n : 99 } : s));

const raw = JSON.stringify(save);
writeFileSync('tools/test/fixtures/lategame.js', `try { if (!sessionStorage.getItem('lh-seeded')) { localStorage.setItem('lantern-hollow:save:v1', ${JSON.stringify(raw)}); sessionStorage.setItem('lh-seeded', '1'); } } catch (e) {}\n`);
console.log(`wrote tools/test/fixtures/lategame.js: day ${save.day}, ${save.player.gold} gold, totals ${save.stats.earned}`);
