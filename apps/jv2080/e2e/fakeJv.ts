// A stand-in JV-2080 for the end-to-end tests, installed in the page before the app loads (after apps/tb3/e2e/
// fakeTb3.ts). It replaces navigator.requestMIDIAccess with one input and one output named `name`. The output records
// every message and keeps the JV's memory by address: DT1s write into it, and an RQ1 is answered with one DT1 of the
// bytes asked for, as the JV answers (a tone's 129 bytes in one message). A program change copies a preset into the
// temporary patch, as the JV loads a patch. With `silent`, nothing is answered (the JV off, or a wrong device ID).
//
// Playwright serialises this function into the page, so it must not use anything from outside it.
export interface FakeJvInit {
  name: string;
  temp: Record<number, number[]>; // the temporary patch's blocks, by their address as one number
  presets?: Record<number, Record<number, number[]>>; // by program number (0–127), as `temp`
  silent?: boolean;
}

export function installFakeJv(init: FakeJvInit) {
  const HEADER = [0xf0, 0x41, 0x10, 0x6a];
  const mem = new Map<number, number>();
  const write = (blocks: Record<number, number[]>) =>
    Object.entries(blocks).forEach(([at, bytes]) => bytes.forEach((b, i) => mem.set(Number(at) + i, b)));
  write(init.temp);
  const toNum = (a: number[]) => (a[0]! << 21) | (a[1]! << 14) | (a[2]! << 7) | a[3]!;
  const toAddr = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
  const checksum = (b: number[]) => (128 - (b.reduce((s, x) => s + x, 0) % 128)) % 128;
  const sent: number[][] = [];
  const programs: number[] = [];
  type Listener = (e: { data: Uint8Array; timeStamp: number }) => void;
  const listeners = new Set<Listener>();
  const state = { silent: init.silent ?? false };

  const port = (id: string, type: string) => ({
    id, name: init.name, manufacturer: "test", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const input = {
    ...port("fake-jv-in", "input"),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const deliver = (bytes: number[]) => {
    const e = { data: Uint8Array.from(bytes), timeStamp: performance.now() };
    input.onmidimessage?.(e);
    listeners.forEach((fn) => fn(e));
  };

  const sysex = (m: number[]) => {
    if (!HEADER.every((b, i) => m[i] === b)) return;
    const at = toNum(m.slice(5, 9));
    if (m[4] === 0x12) m.slice(9, -2).forEach((b, i) => mem.set(at + i, b));
    if (m[4] !== 0x11 || state.silent) return;
    const size = toNum(m.slice(9, 13));
    const body = [...toAddr(at), ...Array.from({ length: size }, (_, i) => mem.get(at + i) ?? 0)];
    setTimeout(() => deliver([...HEADER, 0x12, ...body, checksum(body), 0xf7]), 2);
  };
  const program = (m: number[]) => {
    programs.push(m[1]!);
    const preset = init.presets?.[m[1]!];
    if (preset) write(preset);
  };

  const output = {
    ...port("fake-jv-out", "output"),
    clear: () => undefined,
    send(data: ArrayLike<number>) {
      const m = Array.from(data);
      sent.push(m);
      if (m[0] === 0xf0) sysex(m);
      else if ((m[0]! & 0xf0) === 0xc0) program(m);
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
  // What the tests read: the memory a range at a time, everything sent, the programs chosen.
  const read = (at: number, size: number) => Array.from({ length: size }, (_, i) => mem.get(at + i) ?? 0);
  (window as unknown as { __fakeJv: unknown }).__fakeJv = { read, sent, programs, state };
}
