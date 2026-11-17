import { NPC_BY_ID } from '../data/npcs';
import { RECIPES } from '../data/recipes';
import { SHOPS } from '../data/shops';
import { isOpen } from '../game/shop';
import { session } from '../game/session';
import { canGift, giveGift, talkTo } from '../game/social';
import type { Unlock } from '../data/npcs';
import { Dialogue } from './DialogueUI';
import { FishingScreen } from './FishingUI';
import type { FishRequest } from './FishingUI';
import { MenuScreen, RecipeScreen, ShrineScreen } from './MenuUI';
import { BoardScreen, ChestScreen, FurnaceScreen, GiftScreen } from './PlaceUI';
import type { Host } from './Screens';
import { ShopScreen } from './ShopUI';

/** Everything the world can ask the interface to open. */
export type Interact =
  | { kind: 'talk'; id: string }
  | { kind: 'shop'; id: string }
  | { kind: 'shrine' }
  | { kind: 'cook' }
  | { kind: 'board' }
  | { kind: 'menu'; tab?: 'bag' | 'craft' | 'bundles' | 'friends' | 'options' }
  | { kind: 'chest'; loc: string; key: string }
  | { kind: 'furnace'; loc: string; key: string }
  | ({ kind: 'fish' } & FishRequest);

/** Each villager's voice: the pitch of their speech blips. */
const VOICE: Readonly<Record<string, number>> = { mirren: 1.12, bram: 0.72, ida: 1.0, tam: 0.62, wren: 1.3, olwen: 0.86 };

const say = (msg: string): void => { session.events.emit('toast', msg); };

function announce(u: Unlock): void {
  if (u.recipe) say(`New recipe: ${RECIPES.find((r) => r.id === u.recipe)?.name ?? u.recipe}`);
  if (u.item) session.events.emit('picked', u.item.id, u.item.n);
}

function speak(host: Host, id: string, pages: string[], choices?: { label: string; fn: () => void }[]): void {
  const npc = NPC_BY_ID[id];
  if (!npc) return;
  host.open(new Dialogue(host, { name: npc.name, portrait: `portrait/${id}`, pages, choices, voice: VOICE[id] ?? 1 }));
}

function startGift(host: Host, id: string): void {
  const why = canGift(session.state, id);
  if (why) {
    speak(host, id, [why]);
    return;
  }
  host.open(new GiftScreen(host, id, (slot) => {
    const r = giveGift(session.state, id, slot);
    if (!r.ok) {
      if (r.note) say(r.note);
      return;
    }
    session.events.emit('sfx', r.taste === 'dislike' ? 'nope' : 'give');
    session.events.emit('npc-fx', id, r.taste === 'dislike' ? 'sad' : 'heart');
    session.events.emit('selected');
    for (const u of r.unlocked) announce(u);
    speak(host, id, [r.line, ...r.unlocked.map((u) => u.text)]);
  }));
}

function startTalk(host: Host, id: string): void {
  const st = session.state;
  const t = talkTo(st, id);
  for (const u of t.unlocked) announce(u);
  if (t.spoke) session.events.emit('npc-fx', id, 'heart');
  const shop = Object.values(SHOPS).find((s) => s.keeper === id);
  const choices = [{ label: 'Give a gift', fn: () => startGift(host, id) }];
  if (shop && isOpen(shop.id, st.minute)) choices.push({ label: 'Shop', fn: () => host.open(new ShopScreen(host, shop.id)) });
  choices.push({ label: 'Goodbye', fn: () => undefined });
  speak(host, id, [...t.pages, ...t.unlocked.map((u) => u.text)], choices);
}

function startShop(host: Host, id: string): void {
  const shop = SHOPS[id];
  if (!shop) return;
  if (!isOpen(id, session.state.minute)) {
    say(shop.closedLine);
    return;
  }
  host.open(new ShopScreen(host, id, shop.greeting));
}

export function interact(host: Host, what: Interact, toTitle: () => void): void {
  switch (what.kind) {
    case 'talk': return startTalk(host, what.id);
    case 'shop': return startShop(host, what.id);
    case 'shrine':
      session.state.flags.shrineSeen = true;
      return host.open(new ShrineScreen(host));
    case 'cook': return host.open(new RecipeScreen(host, 'cook', 'The Stove'));
    case 'board': return host.open(new BoardScreen(host));
    case 'chest': return host.open(new ChestScreen(host, what.loc, what.key));
    case 'furnace': return host.open(new FurnaceScreen(host, what.loc, what.key));
    case 'menu': return host.open(new MenuScreen(host, toTitle, what.tab));
    case 'fish': return host.open(new FishingScreen(host, what));
  }
}
