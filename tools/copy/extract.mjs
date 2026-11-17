// Pulls every sentence the player can read out of the source into one text file, one per line,
// so a copy linter can score the wording. Usage: node tools/copy/extract.mjs [outDir]
// Writes <outDir>/strings.txt and <outDir>/strings.map.tsv (line number, file, source line).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const out = process.argv[2] ?? join(root, '.100x/copy');
const SKIP_DIRS = new Set(['gen']);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p);
    } else if (p.endsWith('.ts')) {
      files.push(p);
    }
  }
};
walk(join(root, 'src'));

const STRING = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** A sentence a player reads: words, a space, no code shape. */
const readable = (s) => {
  if (s.includes('${') || /^[./#]|\.(png|json|ts|mp3|ogg|wav)$|[{}<>=;]|::|\\u/.test(s)) return false;
  const words = s.trim().split(/\s+/);
  if (words.length < 3) return false;
  if (!/^[A-Z"'(\u2018\u201c]/.test(s.trim()) && !/[.!?]$/.test(s.trim())) return false;
  return words.filter((w) => /[a-z]{2,}/i.test(w)).length >= 3;
};

const rows = [];
for (const file of files.sort()) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(import|export \* from|\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(STRING)) {
      const text = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ');
      if (readable(text)) rows.push({ text, file: relative(root, file), line: i + 1 });
    }
  });
}

const seen = new Set();
const unique = rows.filter((r) => (seen.has(r.text) ? false : seen.add(r.text)));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'strings.txt'), unique.map((r) => r.text).join('\n') + '\n');
writeFileSync(join(out, 'strings.map.tsv'), unique.map((r, i) => `${i + 1}\t${r.file}:${r.line}`).join('\n') + '\n');
console.log(`${unique.length} sentences from ${files.length} files -> ${join(out, 'strings.txt')}`);
