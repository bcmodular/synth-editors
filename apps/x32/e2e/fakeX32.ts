// A fake X32 Rack for the end-to-end tests and for trying the app before the desk arrives (npm run fake:x32): a UDP
// server on this machine that answers reads, takes writes, and sends /xremote notifications the way Maillot's
// "Unofficial X32/M32 OSC Remote Protocol" describes. Seeded with the studio rig (rig.ts).
//
// What the real desk does is still unknown in places (docs/x32-spec.md, day-one questions). Each unknown that the app
// depends on becomes a switch here, so the tests can run the app under every answer.
//
// Loaded by plain Node (runFake.ts) as well as Playwright, so it imports with .ts extensions and uses only erasable
// TypeScript.

import dgram from "node:dgram";
import type { AddressInfo } from "node:net";
import { argFor } from "../src/core/argFor.ts";
import type { Param } from "../src/core/addresses.ts";
import { decodePacket, encodeMessage, int, str, type OscArg, type OscMessage } from "../src/core/osc.ts";
import { defaultDesk } from "./rig.ts";

export interface FakeSwitches {
  maxXremoteClients: number; // how many clients get notifications at once (day-one question)
}

export interface FakeX32Init {
  model?: string;
  firmware?: string;
  values?: Map<string, OscArg>; // the desk's state; default: the studio rig
  switches?: Partial<FakeSwitches>;
  writeDelayMs?: number; // apply writes this late, as the real desk sometimes does (user routing, 22 Nov)
  // `/load ,sii libfx <index> <slot>`: what loading a library preset does to the values; true if it loaded.
  loadFx?: (args: OscArg[], get: (a: string) => number | string | undefined, set: (p: Param, v: number | string) => void) => boolean;
}

export interface FakeReceived extends OscMessage {
  from: number; // the client's port
}

// What a snippet load puts back in the fake: a routing snippet's sends, outputs and names, and inserts and FX.
const SNIPPET_HOLDS = /\/mix\/\d\d\/(on|level)$|^\/outputs\/|\/config\/name$|\/insert\/|^\/fx\//;
const XREMOTE_MS = 10_000; // the desk drops a client after 10 s without /xremote
const DEFAULT_SWITCHES: FakeSwitches = { maxXremoteClients: 4 };

interface Client {
  address: string;
  port: number;
  until: number;
}

export class FakeX32 {
  readonly received: FakeReceived[] = [];
  readonly scenes = new Map<number, Map<string, OscArg>>(); // saved scenes: a copy of the desk
  readonly snippets = new Map<number, Map<string, OscArg>>(); // saved snippets, the same way
  offline = false; // drop everything, as if the network were down

  private readonly socket = dgram.createSocket("udp4");
  private readonly values: Map<string, OscArg>;
  private readonly model: string;
  private readonly firmware: string;
  private readonly writeDelayMs: number;
  private readonly loadFx: FakeX32Init["loadFx"] | null;
  private readonly switches: FakeSwitches;
  private clients: Client[] = [];

  private constructor(init: FakeX32Init) {
    this.switches = { ...DEFAULT_SWITCHES, ...init.switches };
    this.values = init.values ?? defaultDesk();
    this.model = init.model ?? "X32RACK";
    this.firmware = init.firmware ?? "4.06";
    this.writeDelayMs = init.writeDelayMs ?? 0;
    this.loadFx = init.loadFx ?? null;
    this.socket.on("message", (bytes, rinfo) => this.receive(bytes, rinfo));
  }

  static async start(init: FakeX32Init = {}, port = 0): Promise<FakeX32> {
    const fake = new FakeX32(init);
    await new Promise<void>((resolve) => fake.socket.bind(port, "127.0.0.1", resolve));
    return fake;
  }

  get port(): number {
    return (this.socket.address() as AddressInfo).port;
  }

  get host(): string {
    return `127.0.0.1:${this.port}`;
  }

  // Load a saved scene back (as the desk's Scenes page would).
  load(n: number): void {
    const saved = this.scenes.get(n);
    if (!saved) throw new Error(`No scene ${n}`);
    for (const [address, arg] of saved) if (!address.startsWith("/-show/")) this.values.set(address, arg);
  }

  get(address: string): OscArg["value"] | undefined {
    return this.values.get(address)?.value;
  }

  // A change made on the desk itself (X32-Edit, the desk's own screen): stored and sent to every subscribed client (unless the
  // network is down, when the app misses it).
  set(param: Param, value: number | string): void {
    const arg = argFor(param, value);
    this.values.set(param.address, arg);
    this.notify({ address: param.address, args: [arg] }, null);
  }

  // Several changes made on the desk at once.
  setAll(changes: [Param, number | string][]): void {
    for (const [param, value] of changes) this.set(param, value);
  }

  // Messages the app sent, by address, oldest first.
  sent(address: string): FakeReceived[] {
    return this.received.filter((m) => m.address === address);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }

  private receive(bytes: Buffer, rinfo: dgram.RemoteInfo): void {
    if (this.offline) return;
    for (const m of decodePacket(new Uint8Array(bytes))) {
      this.received.push({ ...m, from: rinfo.port });
      this.answer(m, rinfo);
    }
  }

  // Messages that aren't values, by address.
  private readonly commands: Record<string, (m: OscMessage, from: dgram.RemoteInfo) => void> = {
    "/xremote": (_m, from) => this.subscribe(from),
    "/info": (_m, from) => this.reply(from, "/info", [str("V2.07"), str("osc-server"), str(this.model), str(this.firmware)]),
    "/xinfo": (_m, from) => this.reply(from, "/xinfo", [str("127.0.0.1"), str("FAKE-X32"), str(this.model), str(this.firmware)]),
    "/status": (_m, from) => this.reply(from, "/status", [str("active"), str("127.0.0.1"), str(this.model)]),
    "/save": (m, from) => this.save(m, from),
    "/load": (m, from) => (m.args[0]?.value === "libfx" ? this.loadLibrary(m, from) : this.loadShow(m, from)),
  };

  private answer(m: OscMessage, from: dgram.RemoteInfo): void {
    const command = this.commands[m.address];
    if (command) return command(m, from);
    const current = this.values.get(m.address);
    if (!current) return; // the desk ignores addresses it doesn't have
    if (m.args.length === 0) return this.reply(from, m.address, [current]);
    this.write(m, from);
  }

  // `/save ,siss scene <n> <name> <note>`: keeps a copy of the desk as it is, and answers `/save ,si scene 1`.
  // `/save ,sis snippet <n> <name>` keeps a copy too; loading it puts back what a routing snippet holds.
  private save(m: OscMessage, from: dgram.RemoteInfo): void {
    const [kind, n, name] = m.args.map((a) => a.value);
    const shows = kind === "scene" ? this.scenes : kind === "snippet" ? this.snippets : null;
    if (!shows || typeof n !== "number") return this.reply(from, "/save", [str(String(kind)), int(0)]);
    const slot = String(n).padStart(3, "0");
    this.values.set(`/-show/showfile/${kind}/${slot}/name`, str(String(name ?? "")));
    this.values.set(`/-show/showfile/${kind}/${slot}/hasdata`, int(1));
    shows.set(n, new Map(this.values));
    this.reply(from, "/save", [str(String(kind)), int(1)]);
  }

  // `/load ,si scene|snippet <n>`: puts the saved copy back (a snippet: its sends, outputs, names, inserts and FX).
  private loadShow(m: OscMessage, from: dgram.RemoteInfo): void {
    const [kind, n] = m.args.map((a) => a.value);
    const saved = (kind === "scene" ? this.scenes : this.snippets).get(Number(n));
    const held = (a: string) => kind === "scene" || SNIPPET_HOLDS.test(a);
    if (saved) for (const [address, arg] of saved) if (!address.startsWith("/-show/") && held(address)) this.values.set(address, arg);
    this.reply(from, "/load", [str(String(kind)), int(saved ? 1 : 0)]);
  }

  // A library load changes the slot as the desk would (through set, so other clients hear of it) and answers 1 or 0.
  private loadLibrary(m: OscMessage, from: dgram.RemoteInfo): void {
    const get = (a: string) => this.get(a) as number | string | undefined;
    const ok = m.args[0]?.value === "libfx" && !!this.loadFx?.(m.args, get, (p, v) => this.set(p, v));
    this.reply(from, "/load", [str(String(m.args[0]?.value ?? "")), int(ok ? 1 : 0)]);
  }

  private write(m: OscMessage, from: dgram.RemoteInfo): void {
    const [arg] = m.args;
    if (!arg) return;
    if (this.writeDelayMs) setTimeout(() => this.values.set(m.address, arg), this.writeDelayMs);
    else this.values.set(m.address, arg);
    this.notify({ address: m.address, args: [arg] }, from.port);
  }

  private subscribe(from: dgram.RemoteInfo): void {
    const now = Date.now();
    this.clients = this.clients.filter((c) => c.until > now && c.port !== from.port);
    if (this.clients.length >= this.switches.maxXremoteClients) return;
    this.clients.push({ address: from.address, port: from.port, until: now + XREMOTE_MS });
  }

  // Tell every subscribed client except the one that made the change.
  private notify(m: OscMessage, exceptPort: number | null): void {
    if (this.offline) return;
    const now = Date.now();
    for (const c of this.clients) {
      if (c.until > now && c.port !== exceptPort) this.socket.send(encodeMessage(m.address, m.args), c.port, c.address);
    }
  }

  private reply(to: dgram.RemoteInfo, address: string, args: OscArg[]): void {
    this.socket.send(encodeMessage(address, args), to.port, to.address);
  }
}
