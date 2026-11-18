import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** The version and the commit it was built from, so the game can say which build a player is on. */
function build(): { version: string; commit: string } {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
  let commit = '';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // built from a copy with no git history: the version alone has to do
  }
  return { version, commit };
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build()) },
  server: { host: true, strictPort: false },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // the economy tests play thousands of days; a busy machine must not turn them into false failures
    testTimeout: 30_000,
  },
});
