// A stand-in TB-3 for the end-to-end tests, installed in the page before the app loads. It replaces
// navigator.requestMIDIAccess with one input and one output named `name`. The output records every
// message, applies DT1 writes to an in-memory copy of the 11 patch blocks and answers RQ1 requests
// from it, as the TB-3 does, so the tests can read back what it "holds".
//
// Playwright serialises this function into the page, so it must not use anything from outside it.
export function installFakeTb3(init: { name: string; blocks: Record<string, number[]> }) {
  const HEADER = [0xf0, 0x41, 0x10, 0x00, 0x00, 0x7b];
  const mem = new Map(Object.entries(init.blocks).map(([k, v]) => [k, [...v]]));
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  const blockKey = (a: number[]) => `${hex(a[0]!)}${hex(a[1]!)}${hex(a[2]!)}00`;
  const checksum = (b: number[]) => (128 - (b.reduce((s, x) => s + x, 0) % 128)) % 128;
  const sent: number[][] = [];
  type Listener = (e: { data: Uint8Array }) => void;
  const listeners = new Set<Listener>();

  const port = (id: string, type: string) => ({
    id,
    name: init.name,
    manufacturer: "test",
    type,
    state: "connected",
    connection: "open",
    onstatechange: null,
    open: async () => undefined,
    close: async () => undefined,
  });

  const input = {
    ...port("fake-tb3-in", "input"),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const deliver = (bytes: number[]) => {
    const e = { data: Uint8Array.from(bytes) };
    input.onmidimessage?.(e);
    listeners.forEach((fn) => fn(e));
  };

  const output = {
    ...port("fake-tb3-out", "output"),
    clear: () => undefined,
    send(data: ArrayLike<number>) {
      const m = Array.from(data);
      sent.push(m);
      if (!HEADER.every((b, i) => m[i] === b)) return;
      const addr = m.slice(7, 11);
      const block = mem.get(blockKey(addr));
      if (!block) return;
      const at = addr[3]!;
      if (m[6] === 0x12) {
        m.slice(11, -2).forEach((b, i) => (block[at + i] = b));
      } else if (m[6] === 0x11) {
        const size = (m[11]! << 21) | (m[12]! << 14) | (m[13]! << 7) | m[14]!;
        const body = [...addr, ...block.slice(at, at + size)];
        setTimeout(() => deliver([...HEADER, 0x12, ...body, checksum(body), 0xf7]), 2);
      }
    },
  };

  const access = {
    inputs: new Map([[input.id, input]]),
    outputs: new Map([[output.id, output]]),
    sysexEnabled: true,
    onstatechange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => access, configurable: true });
  (window as unknown as { __fakeTb3: unknown }).__fakeTb3 = { sent };
}
