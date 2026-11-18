/**
 * Back doors for testing: jump straight into a farm, read the live game state, hand out items.
 * They exist in `npm run dev`, and in a build only when it is made with `VITE_TEST_HOOKS=1`.
 * A shipped build has none, so a link or a pasted console line cannot reach into a player's saved farm.
 */
export const HOOKS: boolean = import.meta.env.DEV || import.meta.env.VITE_TEST_HOOKS === '1';

/** The page's test flags (`play`, `new`, `seed`, `skip`, `debug`). Empty in a shipped build. */
export const hookFlags = (): URLSearchParams => new URLSearchParams(HOOKS ? location.search : '');
