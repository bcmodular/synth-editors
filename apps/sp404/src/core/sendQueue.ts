// A coalescing send queue: while a fader is dragged it can ask for dozens of writes a second, but only the
// latest value for each target matters. Items wait under a key; a newer item with the same key replaces the
// waiting one in place, so writes go out in first-asked order with no stale values.

export class SendQueue<T> {
  private readonly waiting = new Map<string, T>();

  get size(): number {
    return this.waiting.size;
  }

  put(key: string, item: T): void {
    this.waiting.set(key, item);
  }

  // The oldest waiting item, removed from the queue.
  take(): T | undefined {
    const next = this.waiting.entries().next();
    if (next.done) return undefined;
    const [key, item] = next.value;
    this.waiting.delete(key);
    return item;
  }

  clear(): void {
    this.waiting.clear();
  }
}
