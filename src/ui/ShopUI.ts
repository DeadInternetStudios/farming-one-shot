import { cropOfSeed, itemDef } from '../data/items';
import { CAFE_STOCK, SHOPS, SMITHY_STOCK, TOOL_UPGRADES, storeStock } from '../data/shops';
import { seasonOf } from '../game/clock';
import { GARDEN_ON, GARDEN_STOCK, decorIndexOf } from '../features/garden/catalog';
import { plantAdvice } from '../game/farming';
import { countItem } from '../game/inventory';
import { session } from '../game/session';
import { NEXT_TIER, availableUpgrades, buy, buyPrice, buyUpgrade, canSellHere, collectForge, sell, sellPrice, startForge } from '../game/shop';
import type { ToolId } from '../game/types';
import { tapH } from '../display';
import { bodyOf, cardHeight, chip, drawCard, footer, popup, tabStrip } from './chrome';
import type { Chip } from './chrome';
import { COL, iconFor } from './kit';
import { Screen, isBack, isConfirm, isDown, isLeft, isRight, isUp } from './Screens';
import { Bag, ListView } from './widgets';
import type { Row } from './widgets';

interface Info {
  icon?: string;
  title: string;
  lines: string[];
}

interface Action {
  label: string;
  kind: 'leaf' | 'wood' | 'berry' | 'sky';
  run: () => string | null;
}

interface Tab {
  name: string;
  rows(): Row[];
  info(i: number): Info | null;
  actions(i: number): Action[];
}

const TOOL_NAMES: Record<ToolId, string> = { hoe: 'Hoe', can: 'Watering Can', axe: 'Axe', pick: 'Pickaxe', scythe: 'Scythe', rod: 'Fishing Rod' };
const NEXT = NEXT_TIER;

/** A shop window: tabs along the top, a list, and a card about whatever is selected. */
export class ShopScreen extends Screen {
  private tabs: Tab[];
  private tab = 0;
  private list: ListView | null = null;
  private msg = '';
  private speak: (m: string, color?: number) => void = () => undefined;
  private gold: Chip | null = null;
  private infoBag!: Bag;

  constructor(host: ConstructorParameters<typeof Screen>[0], private shopId: string, greeting?: string) {
    super(host);
    this.tabs = this.makeTabs();
    this.msg = greeting ?? SHOPS[shopId]?.greeting ?? '';
  }

  // ------------------------------------------------------------------ tabs

  private makeTabs(): Tab[] {
    const st = session.state;
    const id = this.shopId;
    const stockTab = (name: string, ids: () => string[]): Tab => ({
      name,
      rows: () => ids().map((i) => ({ text: itemDef(i).name, right: `${buyPrice(i)}g`, icon: iconFor(st, i), dim: st.player.gold < buyPrice(i) })),
      info: (i) => {
        const it = ids()[i];
        if (!it) return null;
        const d = itemDef(it);
        const crop = cropOfSeed(it);
        const when = crop ? [plantAdvice(crop.id, st.day)] : decorIndexOf(it) >= 0 ? ['Set it down on open ground at home. Pick it up with the axe or the pickaxe.'] : [];
        return { icon: iconFor(st, it), title: d.name, lines: [d.blurb, ...when, `Costs ${buyPrice(it)}g.`, `You have ${countItem(st.player.slots, it)}.`] };
      },
      actions: (i) => {
        const it = ids()[i];
        if (!it) return [];
        const one = (n: number): string | null => {
          const r = buy(st, it, n);
          if (r.ok) session.events.emit('sfx', 'buy');
          else session.events.emit('sfx', 'nope');
          return r.msg;
        };
        return [{ label: 'Buy', kind: 'leaf', run: () => one(1) }, { label: 'Buy 5', kind: 'wood', run: () => one(5) }];
      },
    });

    const sellTab: Tab = {
      name: 'Sell',
      rows: () => {
        const rows: Row[] = [];
        st.player.slots.forEach((s) => {
          if (s && canSellHere(s.id, id)) rows.push({ text: `${itemDef(s.id).name}${s.n > 1 ? ` x${s.n}` : ''}`, right: `${sellPrice(s.id, id)}g`, icon: iconFor(st, s.id) });
        });
        if (rows.length === 0) rows.push({ text: 'Nothing to sell', dim: true });
        return rows;
      },
      info: (i) => {
        const slot = this.sellSlots()[i];
        if (!slot) return null;
        const d = itemDef(slot.id);
        return { icon: iconFor(st, slot.id), title: d.name, lines: [d.blurb, `Pays ${sellPrice(slot.id, id)}g each.`, `You have ${slot.n}.`] };
      },
      actions: (i) => {
        const idx = this.sellSlots()[i]?.index;
        if (idx === undefined) return [];
        const doSell = (all: boolean): string | null => {
          const slot = st.player.slots[idx];
          const r = sell(st, idx, all ? (slot?.n ?? 1) : 1, id);
          if (r.ok) session.events.emit('sfx', 'coin');
          return r.msg;
        };
        return [{ label: 'Sell 1', kind: 'leaf', run: () => doSell(false) }, { label: 'Sell all', kind: 'wood', run: () => doSell(true) }];
      },
    };

    if (id === 'store') {
      const upgrades = (): ReturnType<typeof availableUpgrades> => availableUpgrades(st);
      const upTab: Tab = {
        name: 'Farm',
        rows: () => upgrades().map((u) => ({ text: u.name, right: `${u.price}g`, dim: st.player.gold < u.price })),
        info: (i) => {
          const u = upgrades()[i];
          if (!u) return null;
          const needs = (u.needs ?? []).map((n) => `${n.n} ${itemDef(n.id).name} (you have ${countItem(st.player.slots, n.id)})`);
          return { title: u.name, lines: [u.blurb, `Costs ${u.price}g.`, ...needs] };
        },
        actions: (i) => {
          const u = upgrades()[i];
          if (!u) return [];
          return [{
            label: 'Buy', kind: 'leaf', run: () => {
              const r = buyUpgrade(st, u.id);
              session.events.emit('sfx', r.ok ? 'buy' : 'nope');
              return r.msg;
            },
          }];
        },
      };
      const garden = GARDEN_ON ? [stockTab('Garden', () => [...GARDEN_STOCK])] : [];
      return [stockTab('Buy', () => storeStock(seasonOf(st.day), st.flags)), upTab, ...garden, sellTab];
    }
    if (id === 'cafe') return [stockTab('Buy', () => [...CAFE_STOCK]), sellTab];
    const tools: Tab = {
      name: 'Tools',
      rows: () => {
        const rows: Row[] = [];
        const job = st.flags['forge'] ? st.forge : null;
        if (st.forge) rows.push({ text: `${TOOL_NAMES[st.forge.tool]} (forging)`, right: st.forge.readyDay <= st.day ? 'Ready!' : `Day ${st.forge.readyDay}`, icon: `item/${st.forge.tool}-${st.forge.tier}` });
        void job;
        for (const t of ['hoe', 'can', 'axe', 'pick', 'scythe'] as const) {
          const tier = st.player.tools[t];
          const next = NEXT[tier];
          if (!next || !st.player.slots.some((s) => s?.id === t)) continue;
          rows.push({ text: `${TOOL_NAMES[t]} to ${next}`, right: `${TOOL_UPGRADES[next as keyof typeof TOOL_UPGRADES].gold}g`, icon: `item/${t}-${tier}` });
        }
        if (rows.length === 0) rows.push({ text: 'Nothing to upgrade', dim: true });
        return rows;
      },
      info: (i) => {
        if (!st.flags['forge']) return { title: 'The forge', lines: ['Bram does not take tool work from strangers yet. Be friendly.'] };
        const r = this.toolRows()[i];
        if (!r) return null;
        if (r.kind === 'job') return { title: 'On the anvil', lines: [st.forge && st.forge.readyDay <= st.day ? 'Done! Pick it up.' : 'It will be ready soon.'] };
        const c = TOOL_UPGRADES[r.next as keyof typeof TOOL_UPGRADES];
        return { icon: `item/${r.tool}-${r.tier}`, title: `${TOOL_NAMES[r.tool as ToolId]} to ${r.next}`, lines: [`${c.n} ${itemDef(c.bar).name} and ${c.gold}g.`, `You have ${countItem(st.player.slots, c.bar)} bars.`, 'It takes two days. You will not have the tool meanwhile.'] };
      },
      actions: (i) => {
        if (!st.flags['forge']) return [];
        const r = this.toolRows()[i];
        if (!r) return [];
        if (r.kind === 'job') {
          return [{
            label: 'Collect', kind: 'leaf', run: () => {
              const res = collectForge(st);
              if (res.ok) session.events.emit('sfx', 'upgrade');
              return res.msg;
            },
          }];
        }
        return [{
          label: 'Forge', kind: 'leaf', run: () => {
            const res = startForge(st, r.tool as ToolId);
            if (res.ok) session.events.emit('sfx', 'buy');
            return res.msg;
          },
        }];
      },
    };
    return [stockTab('Buy', () => [...SMITHY_STOCK]), sellTab, tools];
  }

  private sellSlots(): { id: string; n: number; index: number }[] {
    const out: { id: string; n: number; index: number }[] = [];
    session.state.player.slots.forEach((s, index) => {
      if (s && canSellHere(s.id, this.shopId)) out.push({ id: s.id, n: s.n, index });
    });
    return out;
  }

  private toolRows(): ({ kind: 'job' } | { kind: 'up'; tool: string; tier: string; next: string })[] {
    const st = session.state;
    const out: ({ kind: 'job' } | { kind: 'up'; tool: string; tier: string; next: string })[] = [];
    if (st.forge) out.push({ kind: 'job' });
    for (const t of ['hoe', 'can', 'axe', 'pick', 'scythe'] as const) {
      const tier = st.player.tools[t];
      const next = NEXT[tier];
      if (!next || !st.player.slots.some((s) => s?.id === t)) continue;
      out.push({ kind: 'up', tool: t, tier, next });
    }
    return out;
  }

  // ------------------------------------------------------------------ drawing

  build(): void {
    const { l, bag } = this;
    this.dim(0.45);
    const shop = SHOPS[this.shopId];
    const p = popup(bag, l, { title: shop?.name ?? 'Shop', wideH: 214, tallH: 340, close: () => this.close() });
    if (!p.wide && shop?.short) p.title.setText(shop.short);
    this.gold = chip(bag, p, 'ui/coin', 10, COL.berry, `${session.state.player.gold}g`);
    const specs = this.tabs.map((t, i) => ({ id: String(i), label: t.name }));
    const strip = tabStrip(bag, l, p, p.top + 2, specs, String(this.tab), (id) => this.setTab(Number(id)));
    const area = bodyOf(p, strip.bottom + 5);
    const row = tapH(l);
    const listW = p.wide ? Math.floor(area.w * 0.5) - 6 : area.w;
    const cardH = p.wide ? 0 : this.tallestCard(area.w, row);
    const count = (this.tabs[this.tab] as Tab).rows().length;
    const listH = p.wide ? area.h : Math.max(1, Math.min(count, Math.max(3, Math.floor((area.h - 8 - cardH) / row)))) * row;
    this.list = this.own(new ListView(bag, area.x, area.y, listW, listH, row, (i) => this.pickRow(i), () => this.paintInfo(), false));
    this.infoBag = this.own(new Bag(this.scene, bag.depth));
    this.dynBox = p.wide
      ? { x: area.x + listW + 10, y: area.y, w: area.w - listW - 10, h: area.h }
      : { x: area.x, y: area.y + listH + 8, w: area.w, h: Math.min(area.h - listH - 8, cardH) };
    this.speak = footer(bag, p, COL.dim);
    this.speak(this.msg, COL.dim);
    this.refreshList(true);
  }

  private dynBox = { x: 0, y: 0, w: 0, h: 0 };

  /** The height of the tallest card on this tab, so a stacked list can leave exactly that much room. */
  private tallestCard(w: number, btnH: number): number {
    const t = this.tabs[this.tab] as Tab;
    let tall = 0;
    for (let i = 0; i < t.rows().length; i++) {
      const info = t.info(i);
      if (info) tall = Math.max(tall, cardHeight(this.scene, w, { ...info, actions: t.actions(i) }, btnH));
    }
    return tall;
  }

  private setTab(i: number): void {
    this.tab = i;
    this.msg = '';
    this.relayout();
  }

  private refreshList(reset = false): void {
    const t = this.tabs[this.tab] as Tab;
    this.list?.setRows(t.rows(), !reset);
    this.paintInfo();
    this.gold?.set(`${session.state.player.gold}g`);
  }

  private paintInfo(): void {
    const b = this.infoBag;
    b.destroy();
    const t = this.tabs[this.tab] as Tab;
    const sel = this.list?.sel ?? 0;
    const info = t.info(sel);
    if (!info) return;
    const acts = t.actions(sel);
    drawCard(b, this.dynBox, { ...info, actions: acts }, tapH(this.l), (i) => { const a = acts[i]; if (a) this.run(a); });
  }

  private run(a: Action): void {
    const m = a.run();
    if (m) this.say(m);
    this.refreshList();
  }

  private say(m: string): void {
    this.msg = m;
    this.speak(m, COL.ink);
  }

  private pickRow(i: number): void {
    const t = this.tabs[this.tab] as Tab;
    const acts = t.actions(i);
    const a = acts[0];
    if (a) this.run(a);
  }

  override onKey(code: string, ev: KeyboardEvent): void {
    if (isBack(code)) this.close();
    else if (isUp(code)) { this.list?.move(-1); this.paintInfo(); }
    else if (isDown(code)) { this.list?.move(1); this.paintInfo(); }
    else if (isLeft(code)) this.setTab((this.tab + this.tabs.length - 1) % this.tabs.length);
    else if (isRight(code) || code === 'Tab') { ev.preventDefault(); this.setTab((this.tab + 1) % this.tabs.length); }
    else if (isConfirm(code)) {
      const t = this.tabs[this.tab] as Tab;
      const acts = t.actions(this.list?.sel ?? 0);
      const a = ev.shiftKey ? acts[1] ?? acts[0] : acts[0];
      if (a) this.run(a);
    }
  }
}
