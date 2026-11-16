// A stand-in JV-2080 for the end-to-end tests, installed in the page before the app loads (after apps/tb3/e2e/
// fakeTb3.ts). It replaces navigator.requestMIDIAccess with one input and one output named `name`. The output records
// every message and keeps the JV's memory by address: DT1s write into it, and an RQ1 is answered with one DT1 of the
// bytes asked for, as the JV answers (a tone's 129 bytes in one message). A program change copies a preset into the
// temporary patch, as the JV loads a patch. With `silent`, nothing is answered (the JV off, or a wrong device ID).
// A second input, `${name} controller`, stands in for a controller: the tests send CCs from it with __fakeJv.cc().
//
// Playwright serialises this function into the page, so it must not use anything from outside it.
export interface FakeJvInit {
  name: string;
  temp: Record<number, number[]>; // the temporary patch's blocks, by their address as one number
  presets?: Record<number, Record<number, number[]>>; // by program number (0–127), as `temp`
  silent?: boolean;
}

type Message = number[]; // a MIDI message's bytes
type Location = number; // a memory address as one number (7 bits per address byte)

export function installFakeJv(init: FakeJvInit) {
  const HEADER = [0xf0, 0x41, 0x10, 0x6a];
  const mem = new Map<number, number>();
  const write = (blocks: Record<number, number[]>) =>
    Object.entries(blocks).forEach(([at, bytes]) => bytes.forEach((b, i) => mem.set(Number(at) + i, b)));
  write(init.temp);
  const toNum = (a: Message) => (a[0]! << 21) | (a[1]! << 14) | (a[2]! << 7) | a[3]!;
  const toAddr = (n: Location) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
  const checksum = (b: Message) => (128 - (b.reduce((s, x) => s + x, 0) % 128)) % 128;
  const sent: number[][] = [];
  const programs: number[] = [];
  type Listener = (e: { data: Uint8Array; timeStamp: number }) => void;
  const listeners = new Set<Listener>();
  const state = { silent: init.silent ?? false };

  const port = (id: string, type: string, name = init.name) => ({
    id, name, manufacturer: "test", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const input = {
    ...port("fake-jv-in", "input"),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const deliver = (bytes: Message) => {
    const e = { data: Uint8Array.from(bytes), timeStamp: performance.now() };
    input.onmidimessage?.(e);
    listeners.forEach((fn) => fn(e));
  };
  const ctrlListeners = new Set<Listener>();
  const ctrl = {
    ...port("fake-ctrl-in", "input", `${init.name} controller`),
    onmidimessage: null as Listener | null,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && ctrlListeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && ctrlListeners.delete(fn),
  };
  const cc = (channel: number, num: number, value: number) => {
    const e = { data: Uint8Array.from([0xb0 | (channel - 1), num, value]), timeStamp: performance.now() };
    ctrl.onmidimessage?.(e);
    ctrlListeners.forEach((fn) => fn(e));
  };

  const sysex = (m: Message) => {
    if (!HEADER.every((b, i) => m[i] === b)) return;
    const at = toNum(m.slice(5, 9));
    if (m[4] === 0x12) m.slice(9, -2).forEach((b, i) => mem.set(at + i, b));
    if (m[4] !== 0x11 || state.silent) return;
    const size = toNum(m.slice(9, 13));
    const body = [...toAddr(at), ...Array.from({ length: size }, (_, i) => mem.get(at + i) ?? 0)];
    setTimeout(() => deliver([...HEADER, 0x12, ...body, checksum(body), 0xf7]), 2);
  };
  // An edit on the JV's own panel: it changes its memory and sends a DT1 of the change.
  const panel = (at: Location, bytes: number[]) => {
    bytes.forEach((b, i) => mem.set(at + i, b));
    const body = [...toAddr(at), ...bytes];
    deliver([...HEADER, 0x12, ...body, checksum(body), 0xf7]);
  };
  const program = (m: Message) => {
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
    inputs: new Map<string, typeof input>([[input.id, input], [ctrl.id, ctrl]]),
    outputs: new Map([[output.id, output]]),
    sysexEnabled: true,
    onstatechange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => access, configurable: true });
  // What the tests read: the memory a range at a time, everything sent, the programs chosen.
  const read = (at: Location, size: number) => Array.from({ length: size }, (_, i) => mem.get(at + i) ?? 0);
  (window as unknown as { __fakeJv: unknown }).__fakeJv = { read, sent, programs, state, cc, panel };
}
