// What the app knows about the desk: address → value, filled by reads and kept current by /xremote notifications.
// It is the app's only desk state (docs/x32-spec.md, "What the app reads from the desk").

import type { OscMessage } from "./osc";

export type DeskValue = number | string;
export type CacheListener = (address: string, value: DeskValue) => void;

const NOT_VALUES = new Set(["/info", "/status"]);

// The value a message carries, if it's a value at all.
function singleValue(message: OscMessage): DeskValue | undefined {
  if (!message.address.startsWith("/") || NOT_VALUES.has(message.address)) return undefined;
  if (message.args.length !== 1) return undefined;
  const arg = message.args[0]!;
  return arg.type === "b" ? undefined : arg.value;
}

export class DeskCache {
  private readonly values = new Map<string, DeskValue>();
  private readonly listeners = new Set<CacheListener>();

  get(address: string): DeskValue | undefined {
    return this.values.get(address);
  }

  get size(): number {
    return this.values.size;
  }

  set(address: string, value: DeskValue): void {
    if (this.values.get(address) === value) return;
    this.values.set(address, value);
    for (const l of this.listeners) l(address, value);
  }

  // A value message from the desk (a read's answer or a notification): one numeric or string argument. Anything else
  // (/info, /node, blobs) isn't a single value and is left alone. Returns whether it was taken.
  take(message: OscMessage): boolean {
    const value = singleValue(message);
    if (value === undefined) return false;
    this.set(message.address, value);
    return true;
  }

  onChange(listener: CacheListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.values.clear();
  }

  entries(): [string, DeskValue][] {
    return [...this.values];
  }
}
