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
}

export interface FakeReceived extends OscMessage {
  from: number; // the client's port
}

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
  offline = false; // drop everything, as if the network were down

  private readonly socket = dgram.createSocket("udp4");
  private readonly values: Map<string, OscArg>;
  private readonly model: string;
  private readonly firmware: string;
  private readonly switches: FakeSwitches;
  private clients: Client[] = [];

  private constructor(init: FakeX32Init) {
    this.switches = { ...DEFAULT_SWITCHES, ...init.switches };
    this.values = init.values ?? defaultDesk();
    this.model = init.model ?? "X32RACK";
    this.firmware = init.firmware ?? "4.06";
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

  // A change made on the desk itself (the X-Touch, X32-Edit): stored and sent to every subscribed client (unless the
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

  private answer(m: OscMessage, from: dgram.RemoteInfo): void {
    if (m.address === "/xremote") return this.subscribe(from);
    if (m.address === "/info") return this.reply(from, "/info", [str("V2.07"), str("osc-server"), str(this.model), str(this.firmware)]);
    if (m.address === "/status") return this.reply(from, "/status", [str("active"), str("127.0.0.1"), str(this.model)]);
    if (m.address === "/save") return this.save(m, from);
    const current = this.values.get(m.address);
    if (!current) return; // the desk ignores addresses it doesn't have
    if (m.args.length === 0) return this.reply(from, m.address, [current]);
    this.write(m, from);
  }

  // `/save ,siss scene <n> <name> <note>`: keeps a copy of the desk as it is, and answers `/save ,si scene 1`.
  private save(m: OscMessage, from: dgram.RemoteInfo): void {
    const [kind, n, name] = m.args.map((a) => a.value);
    if (kind !== "scene" || typeof n !== "number") return this.reply(from, "/save", [str(String(kind)), int(0)]);
    const slot = String(n).padStart(3, "0");
    this.values.set(`/-show/showfile/scene/${slot}/name`, str(String(name ?? "")));
    this.values.set(`/-show/showfile/scene/${slot}/hasdata`, int(1));
    this.scenes.set(n, new Map(this.values));
    this.reply(from, "/save", [str("scene"), int(1)]);
  }

  private write(m: OscMessage, from: dgram.RemoteInfo): void {
    const [arg] = m.args;
    if (!arg) return;
    this.values.set(m.address, arg);
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
