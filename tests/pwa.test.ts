import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (p: string): Buffer => readFileSync(join(root, p));
const text = (p: string): string => read(p).toString('utf8');

/** Width and height from a PNG's header. */
function pngSize(p: string): { w: number; h: number } {
  const b = read(p);
  expect(b.subarray(1, 4).toString('ascii'), `${p} is a PNG`).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('the installable app', () => {
  const manifest = JSON.parse(text('public/manifest.webmanifest')) as {
    name: string; start_url: string; scope: string; display: string; background_color: string; theme_color: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };

  it('has a manifest browsers will accept', () => {
    expect(manifest.name).toBe('Lantern Hollow');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(['standalone', 'fullscreen']).toContain(manifest.display);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(text('index.html')).toContain(`content="${manifest.theme_color}"`);
  });

  it('ships icons at the sizes the manifest promises, plain and maskable', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(join('public', icon.src)), icon.src).toEqual({ w, h });
      expect(icon.purpose).toContain('maskable');
    }
    expect(pngSize('public/icons/apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
    expect(pngSize('public/icons/favicon-32.png')).toEqual({ w: 32, h: 32 });
  });

  it('is linked from the page with relative paths, so it works from any folder', () => {
    const html = text('index.html');
    for (const href of ['manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/favicon-32.png']) expect(html).toContain(`href="${href}"`);
    expect(text('src/features/pwa/offline.ts')).toContain("register('./sw.js')");
  });
});

describe('the offline worker', () => {
  const src = text('public/sw.js');
  const hashed = new RegExp((/const HASHED = \/(.+)\/;/.exec(src) as RegExpExecArray)[1] as string);

  it('treats built files as unchanging and everything else as something that can change', () => {
    for (const f of ['/assets/index-CgPY1bml.js', '/assets/phaser-C831z-fk.js', '/play/assets/index-AC_iz1Lj.js']) expect(hashed.test(f), f).toBe(true);
    for (const f of ['/assets/atlas.png', '/assets/atlas.json', '/assets/audio/music-day.ogg', '/index.html', '/sw.js', '/manifest.webmanifest']) expect(hashed.test(f), f).toBe(false);
  });

  it('only keeps whole answers and never gets in the way of partial ones', () => {
    expect(src).toContain('res.status === 200');
    expect(src).toContain("req.headers.has('range')");
    expect(src).toContain("url.origin !== self.location.origin");
  });

  it('is plain JavaScript that parses', () => {
    expect(() => new Function(src)).not.toThrow();
  });
});
