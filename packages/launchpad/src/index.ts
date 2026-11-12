// Launchpad Pro Mk1 (original) driver: Programmer layout, RGB LEDs, input parsing.
// Later Launchpad models use different SysEx and are not supported.

const HEADER = [0xf0, 0x00, 0x20, 0x29, 0x02, 0x10] as const;

const LAYOUT_PROGRAMMER = 0x03;

export function programmerLayout(): number[] {
  return [...HEADER, 0x2c, LAYOUT_PROGRAMMER, 0xf7];
}

export function allLedsOff(): number[] {
  return [...HEADER, 0x0e, 0x00, 0xf7];
}

const clamp63 = (v: number) => Math.max(0, Math.min(63, Math.round(v)));

// r, g, b are 0–63.
export function ledRgb(led: number, r: number, g: number, b: number): number[] {
  return [...HEADER, 0x0b, led, clamp63(r), clamp63(g), clamp63(b), 0xf7];
}

export type Rgb = readonly [number, number, number];

// Several LEDs in one message (the Pro takes up to 78 led/r/g/b groups after 0x0B).
export function ledsRgb(leds: Iterable<readonly [number, Rgb]>): number[] {
  const body = [...leds].flatMap(([led, [r, g, b]]) => [led, clamp63(r), clamp63(g), clamp63(b)]);
  return [...HEADER, 0x0b, ...body, 0xf7];
}

// Programmer layout pad numbering: row * 10 + column, bottom-left = 11, top-right = 88.
// The top two rows map to 16 preset slots: 81–88 → 1–8, 71–78 → 9–16.
export function padToSlot(note: number): number | undefined {
  const row = Math.floor(note / 10);
  const col = note % 10;
  if (col < 1 || col > 8) return undefined;
  if (row === 8) return col;
  if (row === 7) return col + 8;
  return undefined;
}

export function slotToPad(slot: number): number {
  return slot <= 8 ? 80 + slot : 70 + (slot - 8);
}

export type LaunchpadEvent =
  | { type: "pad"; note: number; velocity: number }
  | { type: "pressure"; note: number; value: number } // polyphonic aftertouch
  | { type: "channelPressure"; value: number } // channel aftertouch: whichever pads are held
  | { type: "button"; cc: number; value: number };

export function parseLaunchpad(data: ArrayLike<number>): LaunchpadEvent | undefined {
  const status = (data[0] ?? 0) & 0xf0;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  switch (status) {
    case 0x90:
      return { type: "pad", note: d1, velocity: d2 }; // velocity 0 = released
    case 0x80:
      return { type: "pad", note: d1, velocity: 0 };
    case 0xa0:
      return { type: "pressure", note: d1, value: d2 };
    case 0xb0:
      return { type: "button", cc: d1, value: d2 };
    case 0xd0:
      return { type: "channelPressure", value: d1 };
    default:
      return undefined;
  }
}

export * from "./brightness";
