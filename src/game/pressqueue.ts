/**
 * Presses made while the farmer is mid-swing. A swing takes about half a second, and a player who is watering a row does not wait for it:
 * the press is kept and made the moment the swing ends. A few are kept, in the order they came, and one that has waited too long is let go,
 * because the farmer has probably moved on in the player's mind.
 */
export class PressQueue<T> {
  private kept: { at: T | undefined; until: number }[] = [];

  constructor(
    private readonly max = 3,
    private readonly keepMs = 1500,
  ) {}

  /** Keeps a press, unless the queue is full. `at` is where it was aimed, or undefined for "in front of me". */
  push(at: T | undefined, now: number): void {
    if (this.kept.length < this.max) this.kept.push({ at, until: now + this.keepMs });
  }

  /** The next press that is still worth making, or null. Presses that waited too long are dropped on the way. */
  next(now: number): { at: T | undefined } | null {
    for (let p = this.kept.shift(); p; p = this.kept.shift()) if (now <= p.until) return { at: p.at };
    return null;
  }

  clear(): void {
    this.kept = [];
  }

  get size(): number {
    return this.kept.length;
  }
}
