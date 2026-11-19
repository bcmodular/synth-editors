// Talking to the desk over OSC: requests matched to their answers, timeouts, /xremote renewal (the desk drops a client
// after 10 s without one) and a heartbeat that says whether the desk is reachable. Bytes go through an injected
// transport: the Electron UDP relay in the app, a scripted one in tests.

import type { Param } from "./addresses";
import { INFO, XREMOTE } from "./addresses";
import { argFor } from "./argFor";
import type { DeskValue } from "./cache";
import { decodePacket, encodeMessage, type OscArg, type OscMessage } from "./osc";

export interface Transport {
  send(bytes: Uint8Array): void;
  onMessage(listener: (bytes: Uint8Array) => void): () => void;
}

export interface DeskInfo {
  version: string; // OSC server version
  server: string;
  model: string; // "X32RACK"
  firmware: string; // "4.06"
}

export type LinkState = "connecting" | "connected" | "unreachable";

export interface ClientOptions {
  timeoutMs?: number; // how long to wait for an answer
  renewMs?: number; // /xremote renewal and heartbeat
}

export const DEFAULT_TIMEOUT_MS = 1000;
export const RENEW_MS = 8000;

export class DeskTimeout extends Error {
  constructor(address: string) {
    super(`The desk didn't answer ${address}`);
    this.name = "DeskTimeout";
  }
}

interface Pending {
  match: (m: OscMessage) => boolean;
  resolve: (m: OscMessage) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const infoFrom = (m: OscMessage): DeskInfo => {
  const [version = "", server = "", model = "", firmware = ""] = m.args.map((a) => String(a.value));
  return { version, server, model, firmware };
};

export class DeskClient {
  private readonly transport: Transport;
  private readonly timeoutMs: number;
  private readonly renewMs: number;
  private pending: Pending[] = [];
  private readonly messageListeners = new Set<(m: OscMessage) => void>();
  private readonly linkListeners = new Set<(state: LinkState, info: DeskInfo | null) => void>();
  private unsubscribe: (() => void) | null = null;
  private renewTimer: ReturnType<typeof setInterval> | null = null;
  private state: LinkState = "connecting";
  private lastInfo: DeskInfo | null = null;

  constructor(transport: Transport, options: ClientOptions = {}) {
    this.transport = transport;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.renewMs = options.renewMs ?? RENEW_MS;
  }

  get link(): LinkState {
    return this.state;
  }

  get info(): DeskInfo | null {
    return this.lastInfo;
  }

  // Start listening, subscribe to notifications and check the desk is there; then keep both going.
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.onMessage((bytes) => this.receive(bytes));
    void this.heartbeat();
    this.renewTimer = setInterval(() => void this.heartbeat(), this.renewMs);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.renewTimer) clearInterval(this.renewTimer);
    this.renewTimer = null;
    for (const p of this.pending.splice(0)) {
      clearTimeout(p.timer);
      p.reject(new Error("Disconnected"));
    }
  }

  // Send a message and wait for the first answer that matches (by default, one with the same address).
  request(address: string, args: OscArg[] = [], match = (m: OscMessage) => m.address === address): Promise<OscMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = this.pending.filter((p) => p !== entry);
        reject(new DeskTimeout(address));
      }, this.timeoutMs);
      const entry: Pending = { match, resolve, reject, timer };
      this.pending.push(entry);
      this.send(address, args);
    });
  }

  async read(param: Param): Promise<DeskValue> {
    const answer = await this.request(param.address);
    const arg = answer.args[0];
    if (!arg || arg.type === "b") throw new Error(`The desk's answer to ${param.address} has no value`);
    return arg.value;
  }

  // Fire and forget; callers read back (the applier does).
  write(param: Param, value: DeskValue): void {
    this.send(param.address, [argFor(param, value)]);
  }

  // Every message from the desk, answers included (the cache takes them all).
  onMessage(listener: (m: OscMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onLink(listener: (state: LinkState, info: DeskInfo | null) => void): () => void {
    this.linkListeners.add(listener);
    return () => this.linkListeners.delete(listener);
  }

  private send(address: string, args: OscArg[] = []): void {
    this.transport.send(encodeMessage(address, args));
  }

  private receive(bytes: Uint8Array): void {
    let messages: OscMessage[];
    try {
      messages = decodePacket(bytes);
    } catch {
      return; // not OSC we understand; the desk never sends any
    }
    for (const m of messages) this.deliver(m);
  }

  private deliver(m: OscMessage): void {
    const i = this.pending.findIndex((p) => p.match(m));
    if (i >= 0) {
      const [p] = this.pending.splice(i, 1);
      clearTimeout(p!.timer);
      p!.resolve(m);
    }
    for (const l of this.messageListeners) l(m);
  }

  private async heartbeat(): Promise<void> {
    this.send(XREMOTE);
    try {
      this.lastInfo = infoFrom(await this.request(INFO));
      this.setLink("connected");
    } catch (e) {
      if (e instanceof DeskTimeout) this.setLink("unreachable");
    }
  }

  private setLink(state: LinkState): void {
    if (state === this.state) return;
    this.state = state;
    for (const l of this.linkListeners) l(state, this.lastInfo);
  }
}
