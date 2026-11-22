// The desk's enumerated values the rig needs, from Maillot's "Unofficial X32/M32 OSC Remote Protocol". All to check on
// the real desk on day one; a correction should only need a change here.

const inRange = (n: number, low: number, high: number) => Math.min(Math.max(n, low), high) === n;

export const COLOURS = ["OFF", "RD", "GN", "YE", "BL", "MG", "CY", "WH"];

// `/…/config/color`: 0–7, then the same colours inverted (8–15).
export function colourName(n: number): string {
  const base = COLOURS[n % 8] ?? "?";
  return n >= 8 ? `${base}i` : base;
}

export type Tap = "input" | "pre-eq" | "post-eq" | "pre" | "post" | "group";
export const TAPS: Tap[] = ["input", "pre-eq", "post-eq", "pre", "post", "group"];

// `/…/mix/MM/type`: where a send is taken from.
export const tapName = (n: number): Tap => TAPS[n] ?? "post";

// `/fx/N/source/{l,r}`: 0 = insert, 1–16 = mix bus 1–16, 17 = M/C.
export const fxSourceBus = (n: number): number | null => (inRange(n, 1, 16) ? n : null);

// `/…/insert/sel`: 0 = off, 1–16 = FX1L, FX1R … FX8R, 17–22 = aux 1–6.
export const insertSlot = (sel: number): number | null => (inRange(sel, 1, 16) ? Math.ceil(sel / 2) : null);

// `/outputs/{main,aux}/NN/src`: 0 off, 1–2 main L/R, 3 M/C, 4–19 mix bus 1–16, then matrices and direct outs.
export const outputBus = (src: number): number | null => (inRange(src, 4, 19) ? src - 3 : null);

// Local outputs on the X32 Rack: XLR outs 1–8 (`/outputs/main`) and aux outs 1–6 (`/outputs/aux`).
export const LOCAL_OUTPUTS = { main: 8, aux: 6 } as const;

// `/…/config/icon`: 1–74 (docs/x32-osc-reference.md §7).
export const ICONS = [
  "None", "Kick Back", "Kick Front", "Snare Top", "Snare Bottom", "High Tom", "Mid Tom", "Floor Tom", "Hi-Hat", "Ride",
  "Drum Kit", "Cowbell", "Bongos", "Congas", "Tambourine", "Vibraphone", "Electric Bass", "Acoustic Bass", "Contrabass",
  "Les Paul Guitar", "Ibanez Guitar", "Washburn Guitar", "Acoustic Guitar", "Bass Amp", "Guitar Amp", "Amp Cabinet",
  "Piano", "Organ", "Harpsichord", "Keyboard", "Synthesizer 1", "Synthesizer 2", "Synthesizer 3", "Keytar", "Trumpet",
  "Trombone", "Saxophone", "Clarinet", "Violin", "Cello", "Male Vocal", "Female Vocal", "Choir", "Hand Sign", "Talk A",
  "Talk B", "Large Diaphragm Mic", "Condenser Mic Left", "Condenser Mic Right", "Handheld Mic", "Wireless Mic",
  "Podium Mic", "Headset Mic", "XLR Jack", "TRS Plug", "TRS Plug Left", "TRS Plug Right", "RCA Plug Left",
  "RCA Plug Right", "Reel to Reel", "FX", "Computer", "Monitor Wedge", "Left Speaker", "Right Speaker", "Speaker Array",
  "Speaker on a Pole", "Amp Rack", "Controls", "Faders", "MixBus", "Matrix", "Routing", "Smiley",
];
export const iconNumber = (name: string): number | null => {
  const i = ICONS.findIndex((x) => x.toLowerCase() === name.trim().toLowerCase());
  return i < 0 ? null : i + 1;
};
