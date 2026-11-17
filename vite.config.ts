import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
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
