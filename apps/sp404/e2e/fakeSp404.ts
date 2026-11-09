// A stand-in SP-404 MK2 serial port, built from the Phase 0 captures. It answers status polls (FE), project
// settings (FD) and pad reads (9E) from an in-memory project, applies set-parameter writes (01) and echoes them
// as the device does, and records every frame it's sent.
//
// The e2e harness injects this function into the page as source text, and the unit tests call it directly, so
// it must not use anything from outside its own body.

export interface FakePad {
  pad: number; // bank × 16 + pad
  name: string;
  level?: number;
  pan?: number;
  routing?: number;
  muteGroup?: number;
  attack?: number;
  hold?: number;
  release?: number;
}

export interface FakeSp404Init {
  project: number;
  projectName: string;
  pads: FakePad[];
  bankVolumes?: number[];
}

export interface FakeSent {
  command: number;
  id?: number; // set-parameter id
  target?: number;
  value?: number;
}

export function fakeSp404Port(init: FakeSp404Init) {
  const FIELD_BY_ID: Record<number, [number, string]> = {
    0x69: [3, "level"], 0x6d: [7, "muteGroup"], 0x78: [18, "pan"], 0x7a: [20, "routing"],
    0x7d: [22, "attack"], 0x7e: [23, "hold"], 0x7f: [24, "release"],
  };
  const pads = new Map(init.pads.map((p) => [p.pad, { level: 127, pan: 64, routing: 1, muteGroup: 0, attack: 0,
    hold: 100, release: 0, ...p } as Required<FakePad>]));
  const state = {
    project: init.project, bank: 0, pad: 0, playingFrames: 0xffffffff,
    bankVolumes: init.bankVolumes ? [...init.bankVolumes] : Array<number>(10).fill(127),
  };
  const sent: FakeSent[] = [];
  let push: (bytes: Uint8Array) => void = () => {};

  const longFrame = (payload: Uint8Array) => {
    const out = new Uint8Array(16 + payload.length);
    out.set([0x13, 0xe0, 0x00, 0x05]);
    new DataView(out.buffer).setUint32(12, payload.length, true);
    out.set(payload, 16);
    return out;
  };
  const reply = (payload: Uint8Array) => setTimeout(() => push(longFrame(payload)), 1);

  function statusReply() {
    const p = new Uint8Array(19);
    p.set([0x7e, state.project, 0, state.bank, 0, state.pad]);
    new DataView(p.buffer).setUint32(8, state.playingFrames, true);
    p.set([0x01, 0x00, 0x0b, 0x33], 15);
    return p;
  }

  function settingsReply(project: number) {
    const p = new Uint8Array(147);
    p.set([0x7d, project, 0]);
    const data = new DataView(p.buffer);
    for (let w = 0; w < 5; w++) {
      const even = 127 - (state.bankVolumes[2 * w] ?? 127);
      const odd = 127 - (state.bankVolumes[2 * w + 1] ?? 127);
      data.setUint32(3 + 4 * (23 + w), even | (odd << 16), true);
    }
    p.fill(0x20, 115, 146);
    p.set(Array.from(init.projectName, (c) => c.charCodeAt(0)), 115);
    return p;
  }

  function padReply(pad: number) {
    const p = new Uint8Array(327);
    const data = new DataView(p.buffer);
    p[0] = 0x1e;
    data.setUint16(1, pad, true);
    const d = pads.get(pad);
    if (d) {
      data.setUint32(3, 48000, true);
      for (const [field, key] of Object.values(FIELD_BY_ID)) data.setUint32(3 + 4 * field, d[key as keyof FakePad] as number, true);
      p.set(Array.from(d.name, (c) => c.charCodeAt(0)), 175);
    } else {
      p.fill(0x20, 175, 198);
    }
    return p;
  }

  const isBankVolume = (target: number, id: number) => target === 0xffff && id >= 0x35 && id <= 0x3e;

  function setParam(payload: Uint8Array) {
    const data = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    const id = payload[1]!;
    const target = data.getUint16(3, true);
    const value = data.getInt32(5, true);
    sent.push({ command: 0x01, id, target, value });
    if (isBankVolume(target, id)) state.bankVolumes[id - 0x35] = 127 - value;
    const pad = pads.get(target);
    const field = FIELD_BY_ID[id];
    if (pad && field) (pad as unknown as Record<string, number>)[field[1]] = value;
    reply(payload.slice());
  }

  function handle(payload: Uint8Array) {
    const command = payload[0]!;
    if (command === 0x01) return setParam(payload);
    sent.push({ command });
    if (command === 0xfe) reply(statusReply());
    else if (command === 0xfd) reply(settingsReply(payload[1]!));
    else if (command === 0x9e) reply(padReply(payload[1]! | (payload[2]! << 8)));
  }

  function receive(bytes: Uint8Array) {
    if (bytes[0] === 0x12) handle(bytes.slice(4, 4 + bytes[11]!));
    else if (bytes[0] === 0x13) handle(bytes.slice(16));
  }

  const port = {
    readable: new ReadableStream<Uint8Array>({ start: (c) => void (push = (b) => c.enqueue(b)) }),
    writable: new WritableStream<Uint8Array>({ write: (bytes) => receive(bytes) }),
    open: async () => undefined,
    setSignals: async () => undefined,
    close: async () => undefined,
    getInfo: () => ({ usbVendorId: 0x0582, usbProductId: 0x02e7 }),
  };

  return {
    port,
    sent,
    // Test controls: what the device would do on its own.
    select(bank: number, pad: number, playingFrames = 0xffffffff) {
      Object.assign(state, { bank, pad, playingFrames });
    },
    setProject(project: number) {
      state.project = project;
    },
    pad: (n: number) => pads.get(n),
    bankVolume: (bank: number) => state.bankVolumes[bank],
  };
}

export type FakeSp404 = ReturnType<typeof fakeSp404Port>;

// A stand-in for the SP-404's MIDI output: one input named like the device's, which the tests play notes on.
// Also self-contained, for the same reason as the serial fake.
export function fakeSp404Midi(withInput: boolean) {
  type Listener = (e: { data: Uint8Array }) => void;
  const listeners = new Set<Listener>();
  const input = {
    id: "fake-sp404-in", name: "SP-404MKII", manufacturer: "test", type: "input", state: "connected",
    connection: "open", onmidimessage: null, onstatechange: null,
    open: async () => undefined, close: async () => undefined,
    addEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.add(fn),
    removeEventListener: (t: string, fn: Listener) => t === "midimessage" && listeners.delete(fn),
  };
  const access = {
    inputs: new Map(withInput ? [[input.id, input]] : []), outputs: new Map(), sysexEnabled: true,
    onstatechange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => access, configurable: true });
  return { play: (...bytes: number[]) => listeners.forEach((fn) => fn({ data: Uint8Array.from(bytes) })) };
}

// Page script for Playwright: replaces navigator.serial with one that offers the fake port, and Web MIDI with
// the fake SP-404 MIDI output (or none).
export function fakeSerialScript(init: FakeSp404Init, midiInput = true): string {
  return `(() => {
    const fake = (${fakeSp404Port.toString()})(${JSON.stringify(init)});
    window.__fakeSp404 = fake;
    window.__fakeSp404Midi = (${fakeSp404Midi.toString()})(${midiInput});
    Object.defineProperty(navigator, "serial", { configurable: true, value: {
      requestPort: async () => fake.port,
      getPorts: async () => [fake.port],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } });
  })();`;
}
