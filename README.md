# Lantern Hollow

A cozy pixel-art farming game for the browser, made with Phaser 4. Grow a wild plot into a lantern-lit valley over one 28-day year, then keep farming in free play.

Every sprite, tile, font, sound effect and tune is drawn or synthesised by the scripts in `tools/`. Nothing is downloaded at run time.

## Run it

You need Node 22.12 or newer (it is built and tested on Node 26) and npm.

```
npm ci
npm run dev
```

Open the address Vite prints. Keyboard: arrows or WASD to move, E or Space to act, Tab or Escape for the menu, number keys to pick a tool. On a phone the controls are on screen.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the game with hot reload. |
| `npm run build` | Type-checks, then builds the game into `dist/`. |
| `npm run preview` | Serves `dist/` the way a host would. |
| `npm test` | Runs the unit tests. |
| `npm run check:economy` | Plays the farm with three kinds of player and fails if the money could dead-end, run away or stall. |
| `npm run sim` | Prints how the money moves for each player. |
| `npm run assets` | Draws every sprite and synthesises every sound again. The results are committed, so you only need this after changing `tools/art` or `tools/audio`. |
| `npm run audio:check` | Checks the synthesised sounds for clipping and silence. |

## Where the farm is saved

In the browser's own storage, under `lantern-hollow:save:v1`. It saves every few seconds, at each door, and each night. Options has "Back up your farm" and "Restore a backup" for moving a farm to a file or to another browser. Only one tab at a time can play a farm.

## Test hooks

`?play=1&new=1&skip=1&debug=1` jumps into a new farm and adds a `window.__lh` helper that tests use. They work in `npm run dev`. A normal build leaves them out, so a link or a console line cannot reach into a saved farm. To test a built game, make it with `VITE_TEST_HOOKS=1 npm run build`.

## Security checks

`npm audit --omit=dev` covers what ships, and it is clean. `npm audit` also lists a picomatch advisory that arrives through vite and vitest. No patched picomatch exists yet (the newest, 4.0.7, is the affected one), the build only gives it fixed patterns, and none of it is in the game people download. Check again when vite or vitest is next updated.

## Licence

None yet. Until the owner picks one, all rights are reserved.
