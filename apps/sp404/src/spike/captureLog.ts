// Capture log for the Phase 0 spike: every serial chunk with its direction and time, plus notes, written to
// fixtures/local/sp404-captures by the main process (lines are batched) and kept in memory for the page.

import { toHex } from "@synth-editors/midi";
import type { Direction } from "./serialLink";

const FLUSH_MS = 250;
const KEEP_LINES = 300;

export class CaptureLog {
  private readonly t0 = performance.now();
  private queued: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  lines: string[] = [];

  constructor(private readonly onChange: () => void) {}

  async start(): Promise<string | undefined> {
    return window.sp404Capture?.start();
  }

  bytes(direction: Direction, bytes: Uint8Array): void {
    this.add(`${direction === "out" ? ">" : "<"} ${toHex(bytes)}`);
  }

  note(text: string): void {
    this.add(`# ${text}`);
  }

  private add(text: string): void {
    const line = `${(performance.now() - this.t0).toFixed(1).padStart(9)} ${text}`;
    this.lines = [...this.lines, line].slice(-KEEP_LINES);
    this.queued.push(line);
    this.timer ??= setTimeout(() => this.flush(), FLUSH_MS);
    this.onChange();
  }

  private flush(): void {
    this.timer = undefined;
    const text = this.queued.map((l) => `${l}\n`).join("");
    this.queued = [];
    void window.sp404Capture?.append(text);
  }
}
