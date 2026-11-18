/** Which build this is, so a bug report can name it. `define` in `vite.config.ts` fills `__BUILD__` in, for the game, the tests and the tools alike. */
declare const __BUILD__: { version: string; commit: string };

export const versionLabel = (): string => `v${__BUILD__.version}${__BUILD__.commit ? ` (${__BUILD__.commit})` : ''}`;

/** Where to write for help. Set `VITE_SUPPORT` when building to print it in the game; empty until someone decides. */
export const SUPPORT: string = ((import.meta.env.VITE_SUPPORT as string | undefined) ?? '').trim();
