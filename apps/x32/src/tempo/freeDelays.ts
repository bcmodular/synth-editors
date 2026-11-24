// Which delays run free of the tempo bridge (docs/x32-spec.md, "Tempo bridge"): a per-slot switch in the Tempo panel,
// kept in this browser's storage. The desk has nowhere to keep it, and it's a preference, not part of the rig.

const KEY = "x32.tempo.free";
const listeners = new Set<() => void>();

function load(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

let free = load();

export const freeDelays = (): number[] => free;

export function setFree(slot: number, on: boolean): void {
  free = on ? [...new Set([...free, slot])].sort() : free.filter((n) => n !== slot);
  try {
    localStorage.setItem(KEY, JSON.stringify(free));
  } catch {
    // no storage: the choice lasts until the app closes
  }
  for (const l of listeners) l();
}

export function onFreeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
