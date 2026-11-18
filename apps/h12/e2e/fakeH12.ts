// A stand-in for the H12MIDI Pro's Web MIDI ports: eight virtual cables, "H12MIDI-Pro Port 1" to "Port 8", in and
// out. One output (Port 1 by default) answers the hub's SysEx. The Launchkey's MIDI and DAW ports and the Nome II's
// clock port are there too. The hub keeps the settings target switching reads and writes (routing, mappers, the
// current preset). Every message the app sends, on any port, is recorded. Self-contained (no imports, no closures
// over module scope): it is stringified into the page.

export interface FakeH12Init {
  answersOn?: number; // the virtual cable that answers SysEx; 0 = none
  firmware?: number; // major.minor in nibbles: 0x47 = 4.7
  preset?: number; // 0-based
  corruptPreset?: boolean; // the preset answer has a wrong checksum
  settings?: Record<string, number[]>; // "setting:index" → words; unset mappers read as factory ones, other settings as zeros
  failWrite?: string; // "setting:index" whose write is answered with error 0x7C
}

export interface FakeSent {
  port: string;
  data: number[];
  at?: number; // the send time asked for (Web MIDI timestamp)
}

export function fakeH12Midi(init: FakeH12Init) {
  type Listener = (e: { data: Uint8Array; timeStamp: number }) => void;
  const HEAD = [0xf0, 0x00, 0x20, 0x63, 0x0f, 0x26];
  const sum = (body: number[]) => body.reduce((a, b) => a + b, 0) & 0x7f;
  const frame = (body: number[]) => [...HEAD, ...body, sum(body), 0xf7];
  const word = (v: number) => [v & 0x0f, (v >>> 4) & 0x7f, (v >>> 11) & 0x7f, (v >>> 18) & 0x7f, (v >>> 25) & 0x7f];
  const byte = (v: number) => [v & 0x0f, (v >> 4) & 0x0f];
  const status = (id: number, payload: number[]) => frame([0x41, id, payload.length, ...payload]);

  const unword = (d: number[], at: number) => ((d[at]! & 0x0f) | (d[at + 1]! << 4) | (d[at + 2]! << 11)
    | (d[at + 3]! << 18) | (d[at + 4]! << 25)) >>> 0;
  const settings = new Map<string, number[]>(Object.entries(init.settings ?? {}));
  settings.set("4:0", [init.preset ?? 0]);
  const SIZES: Record<number, number> = { 0: 1, 3: 6, 4: 1 };

  const firmware = () => status(0, [...byte(init.firmware ?? 0x47), ...byte(0x26), ...word(1), ...word(2), ...word(3)]);
  const corrupt = (d: number[]) => [...d.slice(0, -2), (d[d.length - 2]! + 1) & 0x7f, 0xf7];
  // A mapper never written reads as the factory one (5A: firmware 4.x's init byte); other settings as zeros.
  const FACTORY_MAPPER = [0x7f007f00, 0x7f007f00, 0x00f00f0f, 0x5a000187, 0, 0];
  const unset = (id: number) => (id === 3 ? FACTORY_MAPPER : new Array<number>(SIZES[id]!).fill(0));
  const read = (id: number, index: number) => {
    const words = settings.get(`${id}:${index}`) ?? unset(id);
    const a = frame([0x42, id, words.length, index, ...words.flatMap(word)]);
    return id === 4 && init.corruptPreset ? corrupt(a) : a;
  };
  const write = (d: number[]) => {
    const key = `${d[7]}:${d[9]}`;
    if (key === init.failWrite) return frame([0x43, 0x7c]);
    settings.set(key, Array.from({ length: d[8]! }, (_, i) => unword(d, 10 + i * 5)));
    return frame([0x43, d[7]!, 0, d[9]!]);
  };
  // By command: status 0 (firmware), setting reads, and writes (never to the current preset). Anything else is an
  // error, as the H12 answers what it doesn't know.
  const known = (d: number[]) => d[7]! in SIZES;
  const handlers: Record<number, (d: number[]) => number[] | undefined> = {
    0x01: (d) => (d[7] === 0x00 ? firmware() : undefined),
    0x02: (d) => (known(d) ? read(d[7]!, d[9]!) : undefined),
    0x03: (d) => (known(d) && d[7] !== 4 ? write(d) : undefined),
  };
  const isHub = (d: number[]) => d.length >= 10 && HEAD.every((b, i) => d[i] === b);
  const answer = (d: number[]): number[] | undefined => {
    if (!isHub(d)) return undefined;
    return handlers[d[6]!]?.(d) ?? frame([d[6]! | 0x40, 0x7f]);
  };

  const sent: FakeSent[] = [];
  type Named = { id: string; name: string };
  const port = (p: Named, type: "input" | "output") => ({
    ...p, manufacturer: "CME", type, state: "connected", connection: "open", onstatechange: null,
    open: async () => undefined, close: async () => undefined,
  });
  const inputPort = (p: Named) => {
    const listeners = new Set<Listener>();
    const input = {
      ...port(p, "input"), onmidimessage: null,
      addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
      removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
    };
    const play = (bytes: number[]) =>
      listeners.forEach((fn) => fn({ data: Uint8Array.from(bytes), timeStamp: performance.now() }));
    return { input, play };
  };
  // Records what it's sent, with the send time asked for, then hands it on.
  const outputPort = (p: Named, then = (_d: number[]) => undefined as void) => ({
    ...port(p, "output"), clear: () => undefined,
    send(data: ArrayLike<number>, at?: number) {
      const d = Array.from(data);
      sent.push({ port: p.name, data: d, at });
      then(d);
    },
  });

  const cable = (kind: string, i: number) => ({ id: `fake-h12-${kind}-${i + 1}`, name: `H12MIDI-Pro Port ${i + 1}` });
  const h12In = Array.from({ length: 8 }, (_, i) => inputPort(cable("in", i)));
  const answersOn = init.answersOn ?? 1;
  const h12Out = Array.from({ length: 8 }, (_, i) => outputPort(cable("out", i),
    (d) => {
      const a = i + 1 === answersOn ? answer(d) : undefined;
      if (a) setTimeout(() => h12In[i]!.play(a), 5);
    }));
  // The Launchkey's own ports and the Nome II's clock, for the clock test.
  const launchkey = inputPort({ id: "fake-lk-in", name: "Launchkey MK4 49 MIDI Out" });
  const nome = inputPort({ id: "fake-nome-clock", name: "Nome II Clock" });
  const pedal = inputPort({ id: "fake-pedal", name: "DOREMiDi MPC-10-AFC6" });
  const inputs = [...h12In, launchkey, nome, pedal].map((p) => p.input);
  const outputs = [...h12Out, outputPort({ id: "fake-lk-out", name: "Launchkey MK4 49 MIDI In" }),
    outputPort({ id: "fake-lk-daw", name: "Launchkey MK4 49 DAW In" })];
  const access = {
    inputs: new Map(inputs.map((i) => [i.id, i])), outputs: new Map(outputs.map((o) => [o.id, o])),
    sysexEnabled: true, onstatechange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => access, configurable: true });
  const setting = (key: string) => settings.get(key);
  const playH12 = (cable: number, bytes: number[]) => h12In[cable - 1]!.play(bytes);
  return { sent, setting, playNome: nome.play, playLaunchkey: launchkey.play, playPedal: pedal.play, playH12 };
}

export function fakeMidiScript(init: FakeH12Init): string {
  return `window.__fakeH12 = (${fakeH12Midi.toString()})(${JSON.stringify(init)});`;
}
