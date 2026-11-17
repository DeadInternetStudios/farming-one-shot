import { itemDef } from '../data/items';

export interface Stack {
  id: string;
  n: number;
}
export type Slots = (Stack | null)[];

export function emptySlots(count: number): Slots {
  return Array.from({ length: count }, () => null);
}

/** Puts items into matching stacks first, then empty slots. Returns how many did not fit. */
export function addItem(slots: Slots, id: string, n: number): number {
  const max = itemDef(id).stack;
  let left = n;
  for (const s of slots) {
    if (left <= 0) break;
    if (s && s.id === id && s.n < max) {
      const put = Math.min(max - s.n, left);
      s.n += put;
      left -= put;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i] === null) {
      const put = Math.min(max, left);
      slots[i] = { id, n: put };
      left -= put;
    }
  }
  return left;
}

export function countItem(slots: Slots, id: string): number {
  let c = 0;
  for (const s of slots) if (s && s.id === id) c += s.n;
  return c;
}

export function canAdd(slots: Slots, id: string, n: number): boolean {
  const max = itemDef(id).stack;
  let room = 0;
  for (const s of slots) {
    if (s === null) room += max;
    else if (s.id === id) room += max - s.n;
  }
  return room >= n;
}

/** Removes n of an item, taking from the end of the bag first. Returns false and changes nothing if short. */
export function removeItem(slots: Slots, id: string, n: number): boolean {
  if (countItem(slots, id) < n) return false;
  let left = n;
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const s = slots[i];
    if (s && s.id === id) {
      const take = Math.min(s.n, left);
      s.n -= take;
      left -= take;
      if (s.n === 0) slots[i] = null;
    }
  }
  return true;
}

export function takeFromSlot(slots: Slots, index: number, n = 1): boolean {
  const s = slots[index];
  if (!s || s.n < n) return false;
  s.n -= n;
  if (s.n === 0) slots[index] = null;
  return true;
}
