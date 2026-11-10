// MIDI to the SP-404's FX, paced and coalesced: messages wait under a key (bus and CC), a newer message for the same
// key replaces a waiting one in place, and one goes out every `gapMs`. An effect change's CC 83, CC 19 and knobs
// have distinct keys, so they keep their order.

import { SendQueue } from "../core/sendQueue";
import type { MidiMessage } from "../core/midi";

export const MIDI_GAP_MS = 2;

export const messageKey = ([status, cc]: MidiMessage): string => `${status & 0x0f}:${cc}`;

export class MidiSender {
  private readonly queue = new SendQueue<MidiMessage>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly out: (message: MidiMessage) => void, private readonly gapMs = MIDI_GAP_MS) {}

  send(messages: readonly MidiMessage[]): void {
    for (const m of messages) this.queue.put(messageKey(m), m);
    if (this.timer === undefined) this.pump();
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.queue.clear();
  }

  private pump(): void {
    const next = this.queue.take();
    if (!next) {
      this.timer = undefined;
      return;
    }
    this.out(next);
    this.timer = setTimeout(() => this.pump(), this.gapMs);
  }
}
