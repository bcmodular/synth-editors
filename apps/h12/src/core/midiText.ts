// MIDI messages as text, for the monitor log: "Note On C3 (60) vel 100", "CC 74 = 12", "Clock". Middle C (60) is
// C3, as Roland and Ableton number it.

export interface MessageText {
  channel?: number; // 1–16, for channel messages
  text: string;
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const noteName = (n: number): string => `${NOTES[n % 12]}${Math.floor(n / 12) - 2} (${n})`;

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));

// Channel messages by status nibble.
const CHANNEL: Record<number, (d1: number, d2: number) => string> = {
  0x8: (n, v) => `Note Off ${noteName(n)} vel ${v}`,
  0x9: (n, v) => (v === 0 ? `Note Off ${noteName(n)}` : `Note On ${noteName(n)} vel ${v}`),
  0xa: (n, v) => `Key AT ${noteName(n)} ${v}`,
  0xb: (c, v) => `CC ${c} = ${v}`,
  0xc: (p) => `Program ${p + 1}`,
  0xd: (v) => `Channel AT ${v}`,
  0xe: (lsb, msb) => `Pitch Bend ${signed(((msb << 7) | lsb) - 8192)}`,
};

const SYSTEM: Record<number, string> = {
  0xf8: "Clock", 0xfa: "Start", 0xfb: "Continue", 0xfc: "Stop", 0xfe: "Active Sensing", 0xff: "Reset",
  0xf2: "Song Position", 0xf3: "Song Select", 0xf6: "Tune Request", 0xf1: "MTC Quarter Frame",
};

const hex = (bytes: readonly number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");

export function describe(data: ArrayLike<number>): MessageText {
  const d = Array.from(data);
  const status = d[0] ?? 0;
  const channelText = CHANNEL[status >> 4];
  if (channelText && status < 0xf0) return { channel: (status & 0x0f) + 1, text: channelText(d[1] ?? 0, d[2] ?? 0) };
  if (status === 0xf0) return { text: `SysEx, ${d.length} bytes` };
  return { text: SYSTEM[status] ?? hex(d) };
}

// Clock and active sensing arrive many times a second; the monitor hides them unless asked.
export const isTicker = (data: ArrayLike<number>): boolean => data[0] === 0xf8 || data[0] === 0xfe;
