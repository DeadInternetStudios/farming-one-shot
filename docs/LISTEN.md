# Listening check

Every sound and tune in the game is made by code (`tools/audio`), and nobody has heard any of it. `npm run audio:check` proves there is no clipping and no silence. It cannot say whether the tunes are pleasant. One person with headphones can, in about twenty minutes.

Start the game (`npm run dev`), open the address it prints with `?play=1&new=1`, and set Music and Sounds to about 6 in Options.

## Tunes

Let each play for a full loop, about 40 seconds, and listen for the seam where it starts again.

- Title screen
- Farm by day. Walk around for three minutes. Is it still pleasant, or does it start to nag?
- Inside the house
- Night on the farm (press `P` for a postcard once lanterns are lit, or wait for evening)
- The Lantern Festival (the last evening of the year)

## The five sounds you will hear the most

Do each fifty times in a row. The question is whether you would want to turn it off.

- Swinging the hoe
- Watering
- Planting a seed
- Picking something up
- Coins

## Fishing

Cast, wait for the bite, and win one fight. Is the tick that tells you the fish is in the green clear and kind?

## What to write down

For each: keep, fix, or cut, and one line why. The tunes and effects live in `tools/audio`. `npm run assets` makes them again.
