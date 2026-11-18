# Store page

A draft for the page that sells the game. The numbers come from the game's own data and `npm run check:economy`. Where a number is a guess, it says so.

## Name and one line

**Lantern Hollow: a cozy farming tale**

Turn a wild plot into a lantern-lit valley in one 28-day year, then keep farming as long as you like.

## Description

You inherit a patch of wild land at the edge of a quiet valley. Dig, plant, water and wait. Fish at the lake. Cook, craft, and learn what your six neighbours like. Give the valley what it asks for and light its seven lanterns, one by one, until the Lantern Festival lights the whole square.

It is a small game and says so. One year takes about an hour and a half at the standard day length (28 days of 3.3 minutes). That is a figure from the clock, not from a person playing, and sleeping early makes it shorter. When the year is done the valley stays open, with the same shops and crops, and no new goals.

## What is in it

- 16 crops across four seasons, and a winter that still pays
- Fishing with a small timing game, 6 fish
- 9 recipes to craft and cook
- 6 neighbours to befriend, with gifts they love and gifts they do not
- 4 festivals, and a finale
- Garden lanterns, and a postcard of your farm at night
- Left-handed touch controls, calm motion, and a larger-interface option
- Saves in your browser, and a backup file you keep yourself

## What it is not

- It has no second year, no gamepad support and no heart events
- After the finale there are no new goals
- Nobody has played it on a real phone yet, and nobody has heard the sound (see `LISTEN.md`)

## Plays on

Any modern browser with WebGL, with a keyboard or on a phone or tablet by touch. It can be added to the home screen and runs without a connection after the first load.

## Privacy

No accounts, no analytics, and no network requests once it has loaded. The farm stays in your browser.

## How to publish the build

1. `VITE_SUPPORT=you@example.com npm run pack` builds the game and writes `release/lantern-hollow-<version>.zip`. Leave `VITE_SUPPORT` out to leave the address out of the game.
2. On itch.io: a new project, kind **HTML**, upload the zip, and tick **This file will be played in the browser**. Pick a viewport of 1280 by 720 and allow fullscreen. Tick **Mobile friendly**.
3. Paste in the text above, the support page from `SUPPORT.md`, and a screenshot of the festival night.

## Before you charge for it

These are yours to decide or do. None of them can be done from the repository.

- Pick a licence. The README says all rights are reserved until you do.
- Set a price. The last review's read, from played fragments and no full playthrough, was that about $4 feels fair for a small tale and $10 would feel mis-sold.
- Put your support address on the support page.
- Listen to the game once (`LISTEN.md`).
- Play it on one real iPhone and one real Android phone for an hour.
- Have one person play from New Game to the closing card with a clock, and set the length in the description to what they find.
