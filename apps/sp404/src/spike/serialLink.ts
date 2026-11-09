// A link to the SP-404's serial port over a pair of byte streams (Web Serial in the app, fakes in tests).
// It splits what arrives into frames, hands every frame to listeners, and pairs requests with replies.
// Every raw chunk in and out goes to `log` so a session can be replayed as test fixtures.

import { splitFrames, type Frame } from "../core/serialFrames";

export type Direction = "out" | "in";
export type LinkLog = (direction: Direction, bytes: Uint8Array) => void;

export interface ByteStreams {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

interface Pending {
  match: (frame: Frame) => unknown;
  resolve: (value: unknown) => void;
}

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

export class SerialLink {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly listeners = new Set<(frame: Frame) => void>();
  private pending: Pending[] = [];
  private rest: Uint8Array = new Uint8Array(0);
  readonly closed: Promise<void>;

  constructor(streams: ByteStreams, private readonly log: LinkLog = () => {}) {
    this.writer = streams.writable.getWriter();
    this.reader = streams.readable.getReader();
    this.closed = this.readLoop();
  }

  onFrame(listener: (frame: Frame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async send(bytes: Uint8Array): Promise<void> {
    this.log("out", bytes);
    await this.writer.write(bytes);
  }

  // Send `bytes` and wait for the first frame `parse` accepts; undefined after `timeoutMs`.
  async request<T>(bytes: Uint8Array, parse: (frame: Frame) => T | undefined, timeoutMs = 1000): Promise<T | undefined> {
    let entry: Pending | undefined;
    const reply = new Promise<T | undefined>((resolve) => {
      entry = { match: parse, resolve: resolve as (value: unknown) => void };
      this.pending.push(entry);
    });
    const timer = setTimeout(() => this.settle(entry!, undefined), timeoutMs);
    await this.send(bytes);
    return reply.finally(() => clearTimeout(timer));
  }

  async close(): Promise<void> {
    await this.reader.cancel().catch(() => {});
    this.writer.releaseLock();
    await this.closed;
  }

  private settle(entry: Pending, value: unknown): void {
    this.pending = this.pending.filter((p) => p !== entry);
    entry.resolve(value);
  }

  private dispatch(frame: Frame): void {
    for (const listener of this.listeners) listener(frame);
    for (const entry of this.pending) {
      const value = entry.match(frame);
      if (value !== undefined) return this.settle(entry, value);
    }
  }

  private receive(chunk: Uint8Array): void {
    this.log("in", chunk);
    const { frames, rest } = splitFrames(concat(this.rest, chunk));
    this.rest = rest;
    frames.forEach((f) => this.dispatch(f));
  }

  private async readLoop(): Promise<void> {
    for (;;) {
      const { value, done } = await this.reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      if (value) this.receive(value);
    }
    this.pending.forEach((p) => p.resolve(undefined));
    this.pending = [];
  }
}
