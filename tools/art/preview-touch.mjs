import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import * as U from './gen/ui.mjs';
writePNG('.100x/art/touch.png', sheet([{ name: 'btn', img: U.actionButton() }, { name: 'hand', img: U.hand() }], { cols: 2, scale: 8, cellW: 40, cellH: 40 }));
console.log('ok');
