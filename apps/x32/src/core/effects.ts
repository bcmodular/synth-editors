// Effect types and parameters (docs/x32-osc-reference.md §6, from Maillot's document). Types are numbered differently
// in FX 1-4 (0-60) and FX 5-8 (0-33, insert-only). Parameters are 0-1 on the desk, scaled per parameter; only the
// types in EFFECTS can have their parameters set, and only those with a Mix can go in as an insert.

import { FX_SEND_SLOTS, p, pad2, type Param } from "./addresses";

const SLOT_1_4: [code: string, name: string][] = [
  ["HALL", "Hall Reverb"], ["AMBI", "Ambiance"], ["RPLT", "Rich Plate"], ["ROOM", "Room"], ["CHAM", "Chamber"],
  ["PLAT", "Plate Reverb"], ["VREV", "Vintage Reverb"], ["VRM", "Vintage Room"], ["GATE", "Gated Reverb"],
  ["RVRS", "Reverse Reverb"], ["DLY", "Stereo Delay"], ["3TAP", "3-Tap Delay"], ["4TAP", "Rhythm Delay"],
  ["CRS", "Stereo Chorus"], ["FLNG", "Stereo Flanger"], ["PHAS", "Stereo Phaser"], ["DIMC", "Dimension-C"],
  ["FILT", "Mood Filter"], ["ROTA", "Rotary Speaker"], ["PAN", "Tremolo/Panner"], ["SUB", "Suboctaver"],
  ["D/RV", "Delay+Chamber"], ["CR/R", "Chorus+Chamber"], ["FL/R", "Flanger+Chamber"], ["D/CR", "Delay+Chorus"],
  ["D/FL", "Delay+Flanger"], ["MODD", "Modulation Delay"], ["GEQ2", "Dual GEQ"], ["GEQ", "Stereo GEQ"],
  ["TEQ2", "Dual TrueEQ"], ["TEQ", "Stereo TrueEQ"], ["DES2", "Dual DeEsser"], ["DES", "Stereo DeEsser"],
  ["P1A", "Stereo Xtec EQ1"], ["P1A2", "Dual Xtec EQ1"], ["PQ5", "Stereo Xtec EQ5"], ["PQ5S", "Dual Xtec EQ5"],
  ["WAVD", "Wave Designer"], ["LIM", "Precision Limiter"], ["CMB", "Combinator"], ["CMB2", "Dual Combinator"],
  ["FAC", "Fair Comp"], ["FAC1M", "M/S Fair Comp"], ["FAC2", "Dual Fair Comp"], ["LEC", "Leisure Comp"],
  ["LEC2", "Dual Leisure Comp"], ["ULC", "Ultimo Comp"], ["ULC2", "Dual Ultimo Comp"], ["ENH2", "Dual Enhancer"],
  ["ENH", "Stereo Enhancer"], ["EXC2", "Dual Exciter"], ["EXC", "Stereo Exciter"], ["IMG", "Stereo Imager"],
  ["EDI", "Edison EX1"], ["SON", "Sound Maxer"], ["AMP2", "Dual Guitar Amp"], ["AMP", "Stereo Guitar Amp"],
  ["DRV2", "Dual Tube Stage"], ["DRV", "Stereo Tube Stage"], ["PIT2", "Dual Pitch"], ["PIT", "Stereo Pitch"],
];
const SLOT_5_8 = [
  "GEQ2", "GEQ", "TEQ2", "TEQ", "DES2", "DES", "P1A", "P1A2", "PQ5", "PQ5S", "WAVD", "LIM", "FAC", "FAC1M", "FAC2", "LEC", "LEC2",
  "ULC", "ULC2", "ENH2", "ENH", "EXC2", "EXC", "IMG", "EDI", "SON", "AMP2", "AMP", "DRV2", "DRV", "PHAS", "FILT", "PAN", "SUB",
];

const FULL_NAME = new Map(SLOT_1_4);

// An FX slot, and an effect type as that slot numbers it.
export interface SlotRef {
  slot: number;
}
export interface FxType extends SlotRef {
  value: number;
}

const typesOf = (s: SlotRef): string[] => (s.slot <= FX_SEND_SLOTS ? SLOT_1_4.map(([c]) => c) : SLOT_5_8);

// "DLY", or "type 99" for a value outside the table.
export const typeCode = (t: FxType): string => typesOf(t)[t.value] ?? `type ${t.value}`;
// "Stereo Delay (DLY)".
export const typeName = (t: FxType): string => {
  const c = typeCode(t);
  return FULL_NAME.has(c) ? `${FULL_NAME.get(c)} (${c})` : c;
};

// A type by its code or name ("DLY", "stereo delay"), as the slot numbers it; null if the slot can't hold it.
export function typeValue(s: SlotRef, name: string): number | null {
  const want = name.trim().toLowerCase();
  const i = typesOf(s).findIndex((c) => c.toLowerCase() === want || FULL_NAME.get(c)?.toLowerCase() === want);
  return i < 0 ? null : i;
}

export interface ParamDef {
  n: number; // /fx/N/par/NN
  name: string;
  scale: "lin" | "log" | "enum";
  min?: number;
  max?: number;
  unit?: string;
  choices?: string[];
}

type Row = [name: string, scale: "lin" | "log", min: number, max: number, unit?: string] | [name: string, choices: string[]];

// Rows in parameter order (par 01, 02, …).
function table(rows: Row[]): ParamDef[] {
  return rows.map((r, i) =>
    Array.isArray(r[1])
      ? { n: i + 1, name: r[0], scale: "enum", choices: r[1] }
      : { n: i + 1, name: r[0], scale: r[1], min: r[2] as number, max: r[3] as number, unit: (r[4] as string | undefined) ?? "" });
}

const FACTORS = ["1/4", "3/8", "1/2", "2/3", "1", "4/3", "3/2", "2", "3"];
const REVERB: Row[] = [
  ["Pre Delay", "lin", 0, 200, "ms"], ["Decay", "log", 0.2, 5, "s"], ["Size", "lin", 2, 100], ["Damping", "log", 1000, 20000, "Hz"],
  ["Diffuse", "lin", 1, 30], ["Level", "lin", -12, 12, "dB"], ["Lo Cut", "log", 10, 500, "Hz"], ["Hi Cut", "log", 200, 20000, "Hz"],
  ["Bass Multi", "log", 0.5, 2],
];
const PLATE_DECAY: Row = ["Decay", "log", 0.5, 10, "s"];

export interface EffectDef {
  params: ParamDef[];
  insertDefaults?: Record<string, number | string>; // set when it goes in as an insert (the whole signal passes through)
}

export const EFFECTS: Record<string, EffectDef> = {
  HALL: { params: table([...REVERB, ["Spread", "lin", 0, 50], ["Shape", "lin", 0, 250], ["Mod Speed", "lin", 0, 100]]) },
  PLAT: {
    params: table([REVERB[0]!, PLATE_DECAY, ...REVERB.slice(2), ["Xover", "log", 10, 500, "Hz"], ["Mod Depth", "lin", 1, 50], ["Mod Speed", "lin", 0, 100]]),
  },
  DLY: {
    params: table([
      ["Mix", "lin", 0, 100, "%"], ["Time", "lin", 1, 3000, "ms"], ["Mode", ["ST", "X", "M"]], ["Factor L", FACTORS], ["Factor R", FACTORS],
      ["Offset L/R", "lin", -100, 100], ["Lo Cut", "log", 10, 500, "Hz"], ["Hi Cut", "log", 200, 20000, "Hz"],
      ["Feed Lo Cut", "log", 10, 500, "Hz"], ["Feed Left", "lin", 1, 100], ["Feed Right", "lin", 1, 100], ["Feed Hi Cut", "log", 200, 20000, "Hz"],
    ]),
    // Mix low for an insert; a dotted eighth, with Time one eighth at 120 BPM until the tempo button sets it.
    insertDefaults: { Mix: 30, Mode: "ST", "Factor L": "3/2", "Factor R": "3/2", Time: 250 },
  },
  "3TAP": {
    params: table([
      ["Time", "lin", 1, 3000, "ms"], ["Gain Base", "lin", 0, 100], ["Pan Base", "lin", -100, 100], ["Feedback", "lin", 0, 100],
      ["Lo Cut", "log", 10, 500, "Hz"], ["Hi Cut", "log", 200, 20000, "Hz"], ["Factor A", FACTORS], ["Gain A", "lin", 0, 100],
      ["Pan A", "lin", -100, 100], ["Factor B", FACTORS], ["Gain B", "lin", 0, 100], ["Pan B", "lin", -100, 100],
      ["Cross Feed", ["OFF", "ON"]], ["Mono", ["OFF", "ON"]], ["Dry", ["OFF", "ON"]],
    ]),
  },
  "4TAP": {
    params: table([
      ["Time", "lin", 1, 3000, "ms"], ["Gain Base", "lin", 0, 100], ["Feedback", "lin", 0, 100], ["Lo Cut", "log", 10, 500, "Hz"],
      ["Hi Cut", "log", 200, 20000, "Hz"], ["Spread", "lin", 0, 6], ["Factor A", FACTORS], ["Gain A", "lin", 0, 100],
      ["Factor B", FACTORS], ["Gain B", "lin", 0, 100], ["Factor C", FACTORS], ["Gain C", "lin", 0, 100],
      ["Cross Feed", ["OFF", "ON"]], ["Mono", ["OFF", "ON"]], ["Dry", ["OFF", "ON"]],
    ]),
  },
  CRS: {
    params: table([
      ["Speed", "log", 0.05, 5, "Hz"], ["Depth L", "lin", 0, 100], ["Depth R", "lin", 0, 100], ["Delay L", "log", 0.5, 50, "ms"],
      ["Delay R", "log", 0.5, 50, "ms"], ["Mix", "lin", 0, 100, "%"], ["Lo Cut", "log", 10, 500, "Hz"], ["Hi Cut", "log", 200, 20000, "Hz"],
      ["Phase", "lin", 0, 180], ["Wave", "lin", 0, 100], ["Spread", "lin", 0, 100],
    ]),
    insertDefaults: { Mix: 30 },
  },
};

// The parameters the app reads: as many as the longest table.
export const READ_PARAMS = Math.max(...Object.values(EFFECTS).map((e) => e.params.length));

// Delays the tempo bridge owns the Time of (docs/x32-spec.md, "Tempo bridge"), and the note their Time is set to, in
// beats: an eighth for the Stereo Delay (its Factor L/R set the note values), a quarter for the multi-tap delays, whose
// base tap plays at Time itself (Factors A-C set the others).
export const SYNCED_BEATS: Record<string, number> = { DLY: 0.5, "3TAP": 1, "4TAP": 1 };
export const SYNCED = new Set(Object.keys(SYNCED_BEATS));

export const effectAt = (t: FxType): EffectDef | null => EFFECTS[typeCode(t)] ?? null;
export const canInsert = (e: EffectDef | null): boolean => !!e?.insertDefaults;

export const findParam = (e: EffectDef, name: string): ParamDef | null =>
  e.params.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()) ?? null;

export const fxParam = (s: SlotRef, d: ParamDef): Param => p(`/fx/${s.slot}/par/${pad2(d.n)}`, d.scale === "enum" ? "i" : "f");

export class BadValue extends Error {}

// A value in the units people use ("2.5", "3/2", "ST") → what the desk stores.
export function toDesk({ def: d, value }: { def: ParamDef; value: number | string }): number {
  if (d.scale === "enum") {
    const i = d.choices!.findIndex((c) => c.toLowerCase() === String(value).trim().toLowerCase());
    if (i < 0) throw new BadValue(`${d.name} takes ${d.choices!.join(", ")}`);
    return i;
  }
  const v = Number(value);
  if (!Number.isFinite(v)) throw new BadValue(`${d.name} takes a number from ${d.min} to ${d.max}${d.unit ? ` ${d.unit}` : ""}`);
  const f = d.scale === "lin" ? (v - d.min!) / (d.max! - d.min!) : Math.log(v / d.min!) / Math.log(d.max! / d.min!);
  return Math.min(Math.max(f, 0), 1);
}

// What the desk stores → the units people use.
export function fromDesk(d: ParamDef, stored: number): string {
  if (d.scale === "enum") return d.choices![stored] ?? String(stored);
  const v = d.scale === "lin" ? d.min! + stored * (d.max! - d.min!) : d.min! * (d.max! / d.min!) ** stored;
  const shown = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  return `${shown}${d.unit ? ` ${d.unit}` : ""}`;
}
