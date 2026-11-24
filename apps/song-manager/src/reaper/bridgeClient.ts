// Talks to the Song Manager bridge script in Reaper through the web interface's ExtState routes.
// See apps/song-manager/reaper/SongManager/bridge.lua for the keys.

import type { BridgeState, Command, CommandResult } from "./types.ts";
import { base64url, extState, getExtState, parseResponse, setExtState } from "./webInterface.ts";

export interface BridgeOptions {
  url: string; // the web interface, e.g. http://localhost:8080
  auth?: string; // "user:password" if the web interface has one
  fetch?: typeof fetch;
  section?: string;
  timeoutMs?: number; // how long send() waits for a result
  pollMs?: number; // how often send() looks for it
  sleep?: (ms: number) => Promise<void>;
}

export interface Snapshot {
  seq: string;
  state: BridgeState;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class BridgeError extends Error {}

export class ReaperBridge {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private readonly section: string;
  private readonly timeoutMs: number;
  private readonly pollMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private nextId = 1;
  private readonly idPrefix = Date.now().toString(36);

  constructor(options: BridgeOptions) {
    this.url = options.url.replace(/\/+$/, "");
    this.headers = options.auth ? { Authorization: `Basic ${btoa(options.auth)}` } : {};
    this.fetchFn = options.fetch ?? fetch;
    this.section = options.section ?? "SongManager";
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.pollMs = options.pollMs ?? 30;
    this.sleep = options.sleep ?? wait;
  }

  /** Runs web interface commands in one request and returns the response lines. */
  async request(commands: string[]): Promise<string[][]> {
    const response = await this.fetchFn(`${this.url}/_/${commands.join(";")}`, { headers: this.headers });
    if (!response.ok) throw new BridgeError(`Reaper's web interface answered ${response.status}`);
    return parseResponse(await response.text());
  }

  async read(keys: string[]): Promise<Record<string, string | undefined>> {
    const lines = await this.request(keys.map((key) => getExtState(this.section, key)));
    return Object.fromEntries(keys.map((key) => [key, extState(lines, this.section, key)]));
  }

  /** The bridge's heartbeat counter, or undefined if the script isn't running. */
  async alive(): Promise<string | undefined> {
    return (await this.read(["alive"])).alive;
  }

  async stateSeq(): Promise<string | undefined> {
    return (await this.read(["state_seq"])).state_seq;
  }

  async snapshot(): Promise<Snapshot | undefined> {
    const { state_seq: seq, state } = await this.read(["state_seq", "state"]);
    if (!seq || !state) return undefined;
    return { seq, state: JSON.parse(state) as BridgeState };
  }

  /** A new snapshot if the state has changed since `lastSeq`, else undefined. Costs one small request when not. */
  async poll(lastSeq: string | undefined): Promise<Snapshot | undefined> {
    const seq = await this.stateSeq();
    if (seq === undefined || seq === lastSeq) return undefined;
    return this.snapshot();
  }

  /** Sends one command and waits for its result. Send the next only after this resolves. */
  async send(command: Command): Promise<CommandResult> {
    const id = `${this.idPrefix}-${this.nextId++}`;
    const payload = base64url(JSON.stringify({ ...command, id }));
    await this.request([setExtState(this.section, "cmd", payload)]);
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await this.sleep(this.pollMs);
      const raw = (await this.read(["result"])).result;
      const result = raw ? (JSON.parse(raw) as CommandResult) : undefined;
      if (result?.id === id) return result;
    }
    throw new BridgeError(`no answer from the bridge to ${command.type} (is the script running in Reaper?)`);
  }

  /** Like send(), but throws when the command fails, and returns its data. */
  async run<T = unknown>(command: Command): Promise<T> {
    const result = await this.send(command);
    if (!result.ok) throw new BridgeError(`${command.type}: ${result.error ?? "failed"}`);
    return result.data as T;
  }

  /** Calls onState whenever the state changes. Returns a function that stops watching. */
  watch(onState: (snapshot: Snapshot) => void, intervalMs = 150, onError?: (error: unknown) => void): () => void {
    let lastSeq: string | undefined;
    let stopped = false;
    const loop = async () => {
      while (!stopped) {
        try {
          const next = await this.poll(lastSeq);
          if (next) {
            lastSeq = next.seq;
            onState(next);
          }
        } catch (error) {
          onError?.(error);
        }
        await this.sleep(intervalMs);
      }
    };
    void loop();
    return () => {
      stopped = true;
    };
  }
}
