import { writePNG } from './png.mjs';
import { sheet } from './atlas.mjs';
import * as U from './gen/ui.mjs';
writePNG('.100x/art/touch-buttons.png', sheet([{ name: 'btn', img: U.actionButton() }, { name: 'menu', img: U.menuButton() }, { name: 'hand', img: U.hand() }], { cols: 3, scale: 8, cellW: 40, cellH: 40 }));
console.log('ok');
