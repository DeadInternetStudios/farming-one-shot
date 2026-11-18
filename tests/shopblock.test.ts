import { describe, expect, it } from 'vitest';
import { TOOL_UPGRADES } from '../src/data/shops';
import { addItem, countItem, emptySlots } from '../src/game/inventory';
import { availableUpgrades, buy, buyBlock, buyPrice, buyUpgrade, forgeBlock, startForge, upgradeBlock } from '../src/game/shop';
import { newGame } from '../src/game/state';

// The shop screens switch a button off when one of these says no, and the game refuses with the same words.
// Both read the same function, so a button that looks ready always works and one that looks off always says why.

describe('a purchase the screen switches off is one the game refuses', () => {
  it('buying: no gold, no room, then yes', () => {
    const st = newGame(1);
    st.player.gold = buyPrice('loaf') - 1;
    expect(buyBlock(st, 'loaf')).toContain(`${buyPrice('loaf')}g`);
    const before = JSON.stringify(st.player);
    expect(buy(st, 'loaf')).toMatchObject({ ok: false, msg: buyBlock(st, 'loaf') });
    expect(JSON.stringify(st.player)).toBe(before);

    st.player.gold = 1000;
    expect(buyBlock(st, 'loaf')).toBeNull();
    const gold = st.player.gold;
    expect(buy(st, 'loaf').ok).toBe(true);
    expect(st.player.gold).toBe(gold - buyPrice('loaf'));
    expect(countItem(st.player.slots, 'loaf')).toBe(1);
  });

  it('buying five asks for five prices', () => {
    const st = newGame(1);
    st.player.gold = buyPrice('loaf') * 4;
    expect(buyBlock(st, 'loaf', 1)).toBeNull();
    expect(buyBlock(st, 'loaf', 5)).toContain(`${buyPrice('loaf') * 5}g`);
  });

  it('a full bag says so, even with gold to spare', () => {
    const st = newGame(1);
    st.player.gold = 9999;
    st.player.slots = emptySlots(st.player.slots.length);
    for (let i = 0; i < st.player.slots.length; i++) st.player.slots[i] = { id: i % 2 ? 'wood' : 'stone', n: 1 };
    st.player.slots[0] = { id: 'hay', n: 1 };
    expect(buyBlock(st, 'loaf')).toBe('Your bag is full.');
    expect(buy(st, 'loaf').ok).toBe(false);
  });
});

describe('an upgrade the screen switches off is one the game refuses', () => {
  it('names the gold, then the materials, then goes through', () => {
    const st = newGame(1);
    st.player.gold = 100;
    expect(upgradeBlock(st, 'coop')).toContain('1200g');
    st.player.gold = 5000;
    expect(upgradeBlock(st, 'coop')).toBe('You need 40 Wood.');
    const gold = st.player.gold;
    expect(buyUpgrade(st, 'coop')).toMatchObject({ ok: false, msg: 'You need 40 Wood.' });
    expect(st.player.gold).toBe(gold);

    addItem(st.player.slots, 'wood', 40);
    addItem(st.player.slots, 'stone', 20);
    expect(upgradeBlock(st, 'coop')).toBeNull();
    expect(buyUpgrade(st, 'coop').ok).toBe(true);
    expect(st.player.gold).toBe(gold - 1200);
    expect(countItem(st.player.slots, 'wood')).toBe(0);
  });

  it('something already owned, or not yet unlocked, is not for sale', () => {
    const st = newGame(1);
    st.player.gold = 99999;
    expect(upgradeBlock(st, 'nothing-like-this')).toBe('That is not for sale.');
    expect(availableUpgrades(st).some((u) => u.id === 'bag-2')).toBe(false);
    expect(upgradeBlock(st, 'bag-2')).toBe('That is not for sale.');
  });
});

describe('a forge job the screen switches off is one the game refuses', () => {
  it('needs the gold and the bars, then takes them', () => {
    const st = newGame(1);
    const c = TOOL_UPGRADES.copper;
    st.player.gold = c.gold - 1;
    expect(forgeBlock(st, 'hoe')).toBe(`You need ${c.gold}g.`);
    st.player.gold = c.gold;
    expect(forgeBlock(st, 'hoe')).toBe(`You need ${c.n} Copper Bar.`);
    expect(startForge(st, 'hoe')).toMatchObject({ ok: false });
    expect(st.forge).toBeFalsy();

    addItem(st.player.slots, c.bar, c.n);
    expect(forgeBlock(st, 'hoe')).toBeNull();
    expect(startForge(st, 'hoe').ok).toBe(true);
    expect(st.player.gold).toBe(0);
    expect(forgeBlock(st, 'axe')).toContain('busy');
  });
});
