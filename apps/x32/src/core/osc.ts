// OSC 1.0 messages and bundles as the X32 uses them (big-endian, every field padded to 4 bytes). No imports, so the
// fake desk can load it under plain Node.

export type OscArg =
  | { type: "i"; value: number }
  | { type: "f"; value: number }
  | { type: "s"; value: string }
  | { type: "b"; value: Uint8Array };

export interface OscMessage {
  address: string;
  args: OscArg[];
}

export const int = (value: number): OscArg => ({ type: "i", value });
export const float = (value: number): OscArg => ({ type: "f", value });
export const str = (value: string): OscArg => ({ type: "s", value });
export const blob = (value: Uint8Array): OscArg => ({ type: "b", value });

const BUNDLE = "#bundle";
const pad4 = (n: number) => (n + 3) & ~3;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// A string with its terminating zero, padded to 4 bytes.
function oscString(text: string): Uint8Array {
  const bytes = encoder.encode(text);
  const out = new Uint8Array(pad4(bytes.length + 1));
  out.set(bytes);
  return out;
}

type NumberArg = Extract<OscArg, { type: "i" | "f" }>;

function number32(arg: NumberArg): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  if (arg.type === "i") view.setInt32(0, arg.value);
  else view.setFloat32(0, arg.value);
  return out;
}

function oscBlob(value: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + pad4(value.length));
  new DataView(out.buffer).setInt32(0, value.length);
  out.set(value, 4);
  return out;
}

function encodeArg(arg: OscArg): Uint8Array {
  switch (arg.type) {
    case "i":
    case "f":
      return number32(arg);
    case "s":
      return oscString(arg.value);
    case "b":
      return oscBlob(arg.value);
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function encodeMessage(address: string, args: OscArg[] = []): Uint8Array {
  const tags = "," + args.map((a) => a.type).join("");
  return concat([oscString(address), oscString(tags), ...args.map(encodeArg)]);
}

// A bundle of messages, to be acted on at once (time tag 1 = immediately).
export function encodeBundle(messages: OscMessage[]): Uint8Array {
  const timeTag = new Uint8Array(8);
  timeTag[7] = 1;
  const elements = messages.map((m) => oscBlob(encodeMessage(m.address, m.args)));
  return concat([oscString(BUNDLE), timeTag, ...elements]);
}

class Reader {
  private at = 0;
  private readonly bytes: Uint8Array;
  private readonly view: DataView;

  // No parameter properties: Node's type stripping (the fake desk) doesn't allow them.
  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get done(): boolean {
    return this.at >= this.bytes.length;
  }

  string(): string {
    const end = this.bytes.indexOf(0, this.at);
    if (end < 0) throw new Error("OSC string has no terminating zero");
    const text = decoder.decode(this.bytes.subarray(this.at, end));
    this.at = pad4(end + 1);
    return text;
  }

  int(): number {
    this.need(4);
    const v = this.view.getInt32(this.at);
    this.at += 4;
    return v;
  }

  float(): number {
    this.need(4);
    const v = this.view.getFloat32(this.at);
    this.at += 4;
    return v;
  }

  blob(): Uint8Array {
    const length = this.int();
    this.need(length);
    const v = this.bytes.slice(this.at, this.at + length);
    this.at += pad4(length);
    return v;
  }

  skipTimeTag(): void {
    this.need(8);
    this.at += 8;
  }

  private need(n: number): void {
    if (this.at + n > this.bytes.length) throw new Error("OSC packet is truncated");
  }
}

const READ_ARG: Record<string, (r: Reader) => OscArg> = {
  i: (r) => int(r.int()),
  f: (r) => float(r.float()),
  s: (r) => str(r.string()),
  b: (r) => blob(r.blob()),
};

function readArgs(r: Reader): OscArg[] {
  // A message with no type tag string at all is allowed by OSC 1.0 (no arguments).
  const tags = r.done ? "," : r.string();
  if (!tags.startsWith(",")) throw new Error(`OSC type tags must start with ",": ${tags}`);
  return [...tags.slice(1)].map((t) => {
    const read = READ_ARG[t];
    if (!read) throw new Error(`Unsupported OSC type tag "${t}"`);
    return read(r);
  });
}

function readBundle(r: Reader): OscMessage[] {
  r.skipTimeTag();
  const out: OscMessage[] = [];
  while (!r.done) out.push(...decodePacket(r.blob()));
  return out;
}

// Every message in a packet, bundles flattened in order.
export function decodePacket(bytes: Uint8Array): OscMessage[] {
  const r = new Reader(bytes);
  const address = r.string();
  return address === BUNDLE ? readBundle(r) : [{ address, args: readArgs(r) }];
}
