import { cropOfSeed, itemDef } from '../data/items';
import { CAFE_STOCK, SHOPS, SMITHY_STOCK, TOOL_UPGRADES, storeStock } from '../data/shops';
import type { Upgrade } from '../data/shops';
import { seasonOf } from '../game/clock';
import { GARDEN_ON, GARDEN_STOCK, decorIndexOf } from '../features/garden/catalog';
import { plantAdviceFor, ripensInTime } from '../game/farming';
import { countItem } from '../game/inventory';
import { session } from '../game/session';
import { NEXT_TIER, availableUpgrades, buy, buyBlock, buyPrice, buyUpgrade, canSellHere, collectForge, forgeBlock, sell, sellPrice, startForge, upgradeBlock } from '../game/shop';
import type { ToolId } from '../game/types';
import { tapH } from '../display';
import { bodyOf, cardStyle, chip, footer, frameOf, planTabs, popup, tabStrip } from './chrome';
import type { Area, Chip } from './chrome';
import { COL, iconFor } from './kit';
import { ListPane, planList } from './MenuUI';
import type { Entry, Line } from './MenuUI';
import { Screen, isBack, isLeft, isRight } from './Screens';
import { Bag } from './widgets';

interface Tab {
  name: string;
  entries(): Entry[];
}

const TOOL_NAMES: Record<ToolId, string> = { hoe: 'Hoe', can: 'Watering Can', axe: 'Axe', pick: 'Pickaxe', scythe: 'Scythe', rod: 'Fishing Rod' };
const SHOP_FRAME = { wideH: 260, tallH: 480 } as const;
const UPGRADABLE = ['hoe', 'can', 'axe', 'pick', 'scythe'] as const;

const sfx = (name: string): void => {
  session.events.emit('sfx', name);
};

/** The thing on the shelf: what it costs, what you have, and buttons that look switched off when the purchase cannot happen. */
function stockEntry(it: string): Entry {
  const st = session.state;
  const d = itemDef(it);
  const crop = cropOfSeed(it);
  const price = buyPrice(it);
  const advice = crop ? plantAdviceFor(crop.id, st.day) : decorIndexOf(it) >= 0 ? { text: 'Set it down on open ground at home. Pick it up with the axe or the pickaxe.', warn: false } : null;
  const buyN = (n: number) => (): string => {
    const r = buy(st, it, n);
    sfx(r.ok ? 'buy' : 'nope');
    return r.msg;
  };
  return {
    row: { text: d.name, right: `${price}g`, icon: iconFor(st, it), dim: st.player.gold < price },
    title: d.name,
    icon: iconFor(st, it),
    lines: [{ t: `Costs ${price}g. You have ${countItem(st.player.slots, it)}.`, tint: COL.ink }, d.blurb, ...(advice ? [{ t: advice.text, tint: advice.warn ? COL.berry : COL.dim }] : [])],
    actions: [
      { label: 'Buy', kind: 'leaf', off: buyBlock(st, it, 1) !== null, run: buyN(1) },
      { label: 'Buy 5', kind: 'wood', off: buyBlock(st, it, 5) !== null, run: buyN(5) },
    ],
  };
}

/** The shelves, as far as they are worth stocking: seeds that cannot ripen before the season ends stay in the back. */
function shelfEntries(ids: string[], hideLate: boolean): Entry[] {
  const st = session.state;
  const late = (it: string): boolean => {
    const crop = cropOfSeed(it);
    return hideLate && !!crop && !ripensInTime(crop.id, st.day);
  };
  const out = ids.filter((it) => !late(it)).map(stockEntry);
  if (ids.some(late)) {
    out.push({
      row: { text: 'More seeds soon', dim: true },
      title: 'The rest of the seeds',
      lines: ['Seeds that cannot ripen before the season ends stay in the back. They come out when it is time to plant them.'],
    });
  }
  return out;
}

function sellEntries(shopId: string): Entry[] {
  const st = session.state;
  const out: Entry[] = [];
  st.player.slots.forEach((s, index) => {
    if (!s || !canSellHere(s.id, shopId)) return;
    const d = itemDef(s.id);
    const each = sellPrice(s.id, shopId);
    const sellN = (all: boolean) => (): string | null => {
      const slot = st.player.slots[index];
      const r = sell(st, index, all ? (slot?.n ?? 1) : 1, shopId);
      if (r.ok) sfx('coin');
      return r.msg;
    };
    out.push({
      row: { text: `${d.name}${s.n > 1 ? ` x${s.n}` : ''}`, right: s.n > 1 ? `${each}g ea` : `${each}g`, icon: iconFor(st, s.id) },
      title: d.name,
      icon: iconFor(st, s.id),
      lines: [{ t: `Pays ${each}g each. You have ${s.n}.`, tint: COL.ink }, d.blurb],
      actions: s.n > 1
        ? [{ label: 'Sell 1', kind: 'leaf', run: sellN(false) }, { label: `Sell all ${each * s.n}g`, kind: 'wood', run: sellN(true) }]
        : [{ label: `Sell ${each}g`, kind: 'leaf', run: sellN(false) }],
    });
  });
  if (out.length === 0) out.push({ row: { text: 'Nothing to sell', dim: true, empty: true }, title: 'Nothing to sell', lines: ['Bring crops, fish and forage here when you have some.'] });
  return out;
}

/** What each farm upgrade looks like, from art the game already has. */
const UPGRADE_ICON: Record<string, string> = { 'bag-1': 'ui/tab-bag', 'bag-2': 'ui/tab-bag', coop: 'prop/egg-basket', chick: 'critter/hen-brown-idle', cat: 'critter/cat-sit' };

function upgradeEntries(): Entry[] {
  const st = session.state;
  return availableUpgrades(st).map((u: Upgrade): Entry => ({
    row: { text: u.name, right: `${u.price}g`, dim: st.player.gold < u.price, icon: UPGRADE_ICON[u.id] },
    title: u.name,
    icon: UPGRADE_ICON[u.id],
    lines: [
      { t: `Costs ${u.price}g.`, tint: COL.ink },
      u.blurb,
      ...(u.needs ?? []).map((n): Line => ({ t: itemDef(n.id).name, need: { icon: iconFor(st, n.id), have: countItem(st.player.slots, n.id), n: n.n } })),
    ],
    actions: [{
      label: 'Buy', kind: 'leaf', off: upgradeBlock(st, u.id) !== null, run: () => {
        const r = buyUpgrade(st, u.id);
        sfx(r.ok ? 'buy' : 'nope');
        return r.msg;
      },
    }],
  }));
}

function forgeEntries(): Entry[] {
  const st = session.state;
  if (!st.flags['forge']) return [{ row: { text: 'Tool work', dim: true, empty: true }, title: 'The forge', lines: ['Bram does not take tool work from strangers yet. Be friendly.'] }];
  const out: Entry[] = [];
  if (st.forge) {
    const ready = st.forge.readyDay <= st.day;
    const icon = `item/${st.forge.tool}-${st.forge.tier}`;
    out.push({
      row: { text: `${TOOL_NAMES[st.forge.tool]} (forging)`, right: ready ? 'Ready!' : `Day ${st.forge.readyDay}`, icon },
      title: 'On the anvil',
      icon,
      lines: [ready ? 'Done! Pick it up.' : 'It will be ready soon.'],
      actions: [{
        label: 'Collect', kind: 'leaf', off: !ready, run: () => {
          const r = collectForge(st);
          if (r.ok) sfx('upgrade');
          return r.msg;
        },
      }],
    });
  }
  for (const tool of UPGRADABLE) {
    const tier = st.player.tools[tool];
    const next = NEXT_TIER[tier];
    if (!next || !st.player.slots.some((s) => s?.id === tool)) continue;
    const c = TOOL_UPGRADES[next as keyof typeof TOOL_UPGRADES];
    const icon = `item/${tool}-${tier}`;
    out.push({
      row: { text: `${TOOL_NAMES[tool]} to ${next}`, right: `${c.gold}g`, icon, dim: st.player.gold < c.gold },
      title: `${TOOL_NAMES[tool]} to ${next}`,
      icon,
      lines: [
        { t: `Costs ${c.gold}g.`, tint: COL.ink },
        { t: itemDef(c.bar).name, need: { icon: iconFor(st, c.bar), have: countItem(st.player.slots, c.bar), n: c.n } },
        'It takes two days. You will not have the tool meanwhile.',
      ],
      actions: [{
        label: 'Forge', kind: 'leaf', off: forgeBlock(st, tool) !== null, run: () => {
          const r = startForge(st, tool);
          if (r.ok) sfx('buy');
          return r.msg;
        },
      }],
    });
  }
  if (out.length === 0) out.push({ row: { text: 'Nothing to upgrade', dim: true, empty: true }, title: 'Nothing to upgrade', lines: ['Every tool in your bag is as good as it gets.'] });
  return out;
}

/** A shop window: tabs along the top, a list, and a card about whatever is selected. */
export class ShopScreen extends Screen {
  private tabs: Tab[];
  private tab = 0;
  private pane: ListPane | null = null;
  private msg = '';
  private gold: Chip | null = null;

  constructor(host: ConstructorParameters<typeof Screen>[0], private shopId: string, greeting?: string) {
    super(host);
    this.tabs = this.makeTabs();
    this.msg = greeting ?? SHOPS[shopId]?.greeting ?? '';
  }

  private makeTabs(): Tab[] {
    const id = this.shopId;
    const sell: Tab = { name: 'Sell', entries: () => sellEntries(id) };
    if (id === 'store') {
      const garden: Tab[] = GARDEN_ON ? [{ name: 'Garden', entries: () => shelfEntries([...GARDEN_STOCK], false) }] : [];
      return [
        { name: 'Buy', entries: () => shelfEntries(storeStock(seasonOf(session.state.day), session.state.flags), true) },
        { name: 'Farm', entries: upgradeEntries },
        ...garden,
        sell,
      ];
    }
    if (id === 'cafe') return [{ name: 'Buy', entries: () => shelfEntries([...CAFE_STOCK], false) }, sell];
    return [{ name: 'Buy', entries: () => shelfEntries([...SMITHY_STOCK], false) }, sell, { name: 'Tools', entries: forgeEntries }];
  }

  build(): void {
    const { l, bag } = this;
    this.dim(0.45);
    const shop = SHOPS[this.shopId];
    const f = frameOf(l, SHOP_FRAME);
    const specs = this.tabs.map((t, i) => ({ id: String(i), label: t.name }));
    const tabs = planTabs(this.scene, l, f.inner, specs);
    const row = tapH(l);
    const style = cardStyle(l, f.wide);
    // each tab is as tall as its content; the frame hangs from the top the tallest tab would give it, so the tabs never move
    const room: Area = { x: 0, y: 0, w: f.inner, h: f.maxBody - 2 - tabs.h - 5 };
    const needs = this.tabs.map((t) => planList(this.scene, room, f.wide, t.entries(), row, style).need);
    const chrome = 2 + tabs.h + 5;
    const p = popup(bag, l, { title: shop?.name ?? 'Shop', ...SHOP_FRAME, body: chrome + (needs[this.tab] as number), hold: chrome + Math.max(...needs), close: () => this.close() });
    if (!p.wide && shop?.short) p.title.setText(shop.short);
    this.gold = chip(bag, p, 'ui/coin', 10, COL.berry, `${session.state.player.gold}g`);
    const strip = tabStrip(bag, p, p.top + 2, tabs, specs, String(this.tab), (id) => this.setTab(Number(id)));
    const speak = footer(bag, p, COL.dim);
    speak(this.msg, COL.dim);
    this.markPage();
    const body = this.own(new Bag(this.scene, bag.depth));
    const tab = this.tabs[this.tab] as Tab;
    this.pane = this.own(new ListPane(body, this.scene, bodyOf(p, strip.bottom + 5), p.wide, () => tab.entries(), () => this.gold?.set(`${session.state.player.gold}g`), row, style));
    this.pane.say = (m, color) => { this.msg = m; speak(m, color ?? COL.ink); };
  }

  private setTab(i: number): void {
    this.tab = i;
    this.msg = '';
    this.relayout(true);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else if (isLeft(code)) this.setTab((this.tab + this.tabs.length - 1) % this.tabs.length);
    else if (isRight(code) || code === 'Tab') { ev.preventDefault(); this.setTab((this.tab + 1) % this.tabs.length); }
    else this.pane?.key(code, ev);
  }
}
