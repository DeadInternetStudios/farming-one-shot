// The villagers: a look for each, plus a bust portrait cut from the same body so they always match.
import { R } from '../palette.mjs';
import { drawBody } from './characters.mjs';

export const NPCS = [
  { id: 'mirren', spec: { skin: R.skin2, hair: R.hairAuburn, hairStyle: 'bun', shirt: R.leaf, pants: R.wood, shoes: R.wood } },
  { id: 'bram', spec: { skin: R.skin4, hair: R.hairBlack, hairStyle: 'short', shirt: R.orange, pants: R.stone, shoes: R.ink } },
  { id: 'ida', spec: { skin: R.skin1, hair: R.hairBlonde, hairStyle: 'ponytail', shirt: R.pink, pants: R.wood, shoes: R.wood } },
  { id: 'tam', spec: { skin: R.skin3, hair: R.hairSilver, hairStyle: 'messy', shirt: R.blue, pants: R.wood, shoes: R.wood } },
  { id: 'wren', spec: { skin: R.skin2, hair: R.hairTeal, hairStyle: 'curly', shirt: R.leaf, pants: R.teal, shoes: R.wood } },
  { id: 'olwen', spec: { skin: R.skin1, hair: R.hairSilver, hairStyle: 'long', shirt: R.purple, pants: R.purple, shoes: R.wood } },
];

/** Head and shoulders, three times life size. */
export function portrait(spec) {
  const body = drawBody(spec, 'down', { bob: 0 });
  return body.sub(0, 0, 16, 17).scale(3);
}
