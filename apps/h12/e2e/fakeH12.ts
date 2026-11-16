// A stand-in for the H12MIDI Pro's Web MIDI ports: eight virtual cables, "H12MIDI-Pro Port 1" to "Port 8", in and
// out. One output (Port 1 by default) answers the hub's SysEx; every message the app sends, on any port, is
// recorded. Self-contained (no imports, no closures over module scope): it is stringified into the page.

export interface FakeH12Init {
  answersOn?: number; // the virtual cable that answers SysEx; 0 = none
  firmware?: number; // major.minor in nibbles: 0x47 = 4.7
  preset?: number; // 0-based
  corruptPreset?: boolean; // the preset answer has a wrong checksum
}

export interface FakeSent {
  port: string;
  data: number[];
}

export function fakeH12Midi(init: FakeH12Init) {
  type Listener = (e: { data: Uint8Array }) => void;
  const HEAD = [0xf0, 0x00, 0x20, 0x63, 0x0f, 0x26];
  const sum = (body: number[]) => body.reduce((a, b) => a + b, 0) & 0x7f;
  const frame = (body: number[]) => [...HEAD, ...body, sum(body), 0xf7];
  const word = (v: number) => [v & 0x0f, (v >>> 4) & 0x7f, (v >>> 11) & 0x7f, (v >>> 18) & 0x7f, (v >>> 25) & 0x7f];
  const byte = (v: number) => [v & 0x0f, (v >> 4) & 0x0f];
  const status = (id: number, payload: number[]) => frame([0x41, id, payload.length, ...payload]);

  const firmware = () => status(0, [...byte(init.firmware ?? 0x47), ...byte(0x26), ...word(1), ...word(2), ...word(3)]);
  const preset = () => frame([0x42, 0x04, 0x01, 0x00, ...word(init.preset ?? 0)]);
  const corrupt = (d: number[]) => [...d.slice(0, -2), (d[d.length - 2]! + 1) & 0x7f, 0xf7];
  const answer = (d: number[]): number[] | undefined => {
    if (d.length < 10 || HEAD.some((b, i) => d[i] !== b)) return undefined;
    if (d[6] === 0x02 && d[7] === 0x04) return init.corruptPreset ? corrupt(preset()) : preset();
    if (d[6] === 0x01 && d[7] === 0x00) return firmware();
    return frame([d[6]! | 0x40, 0x7f]); // the check only reads the firmware status and the preset
  };

  const sent: FakeSent[] = [];
  const port = (id: string, name: string, type: string) => ({
    id, name, manufacturer: "CME", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const inputs = Array.from({ length: 8 }, (_, i) => {
    const listeners = new Set<Listener>();
    const input = {
      ...port(`fake-h12-in-${i + 1}`, `H12MIDI-Pro Port ${i + 1}`, "input"), onmidimessage: null,
      addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
      removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
    };
    return { input, play: (bytes: number[]) => listeners.forEach((fn) => fn({ data: Uint8Array.from(bytes) })) };
  });
  const answersOn = init.answersOn ?? 1;
  const outputs = Array.from({ length: 8 }, (_, i) => ({
    ...port(`fake-h12-out-${i + 1}`, `H12MIDI-Pro Port ${i + 1}`, "output"), clear: () => undefined,
    send(data: ArrayLike<number>) {
      const d = Array.from(data);
      sent.push({ port: this.name, data: d });
      const a = i + 1 === answersOn ? answer(d) : undefined;
      if (a) setTimeout(() => inputs[i]!.play(a), 5);
    },
  }));
  const access = {
    inputs: new Map(inputs.map(({ input }) => [input.id, input])), outputs: new Map(outputs.map((o) => [o.id, o])),
    sysexEnabled: true, onstatechange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => access, configurable: true });
  return { sent };
}

export function fakeMidiScript(init: FakeH12Init): string {
  return `window.__fakeH12 = (${fakeH12Midi.toString()})(${JSON.stringify(init)});`;
}
