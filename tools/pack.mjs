// Zips the built game into release/ for a host that takes a folder of web files (itch.io's "HTML" kind plays index.html from the zip root).
//   npm run pack            builds first, then zips
// It refuses a build that carries the test back door, because that is the one thing a paid build must not have.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const fail = (why) => {
  console.error(`pack: ${why}`);
  process.exit(1);
};

if (!existsSync(join(dist, 'index.html'))) fail('there is no dist/index.html. Run `npm run build` first.');
const scripts = join(dist, 'assets');
const leaky = readdirSync(scripts).filter((f) => f.endsWith('.js') && readFileSync(join(scripts, f), 'utf8').includes('__lh'));
if (leaky.length > 0) fail(`${leaky.join(', ')} carries the test hooks (was it built with VITE_TEST_HOOKS=1?). Build again without it.`);

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `lantern-hollow-${version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: dist });

const listing = execFileSync('unzip', ['-Z1', out], { encoding: 'utf8' }).split('\n').filter(Boolean);
if (!listing.includes('index.html')) fail('index.html is not at the top of the zip');
console.log(`pack: ${out}`);
console.log(`pack: ${listing.length} files, ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB, index.html at the top, no test hooks`);
