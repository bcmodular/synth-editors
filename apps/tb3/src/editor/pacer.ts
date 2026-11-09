// Spaces out messages to the TB-3. Over USB it drops messages that arrive too close together: a
// whole patch sent at once loses its last block, and the next request goes unanswered. (DIN's wire
// speed spaces them out by itself.) Each message gets a send time far enough after the one before,
// for Web MIDI's timestamped send; a lone message goes straight away.
//
// The gap grows with the length of the message before it, as the TB-3 needs longer for a big block:
// measured over USB, a whole patch 2 ms apart still lost a block now and then, 4 ms once in six
// tries, and this (about 11 ms after an EFX block, 3–4 ms after an edit) never in ten.
export const gapAfter = (bytes: number) => 2 + 0.08 * bytes;

export type Clock = () => number;

export interface Pacer {
  at(bytes: number): number; // when a message of this length may go
  backlog(): number; // ms until everything already scheduled has gone
}

export function createPacer(gapFor: (bytes: number) => number = gapAfter, now: Clock = () => performance.now()): Pacer {
  let next = -Infinity;
  return {
    at(bytes) {
      const at = Math.max(now(), next);
      next = at + gapFor(bytes);
      return at;
    },
    backlog: () => Math.max(0, next - now()),
  };
}

// Where messages to the TB-3 go: sent in turn, and how far behind the sending is.
export interface Tb3Sender {
  send(msg: number[]): void;
  backlog(): number;
}

// Offsets (ms) at which to send a run of messages from one moment, paced like the app's.
export function sendOffsets(msgs: number[][]): number[] {
  let t = 0;
  return msgs.map((m) => {
    const at = t;
    t += gapAfter(m.length);
    return at;
  });
}
