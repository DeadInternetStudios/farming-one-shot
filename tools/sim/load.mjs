// Loads TypeScript game modules into plain Node through Vite, so the simulators run the same code as the game.
import { createServer } from 'vite';

export async function loadGame(entry) {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: true },
  });
  const mod = await server.ssrLoadModule(entry);
  return { mod, close: () => server.close() };
}
