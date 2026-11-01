// Synthesis parameter table (ported from tb-3/lua/param_defs.lua).
// Every parameter lives in one of the 11 patch blocks; EFX bytes are described in efx.ts.
import { addrKey } from "./sysex";
import type { Address } from "./sysex";
import { DIST_TYPES, fmtBipolar, fmtSemitoneRange, fmtSigned } from "./display";

export type BlockKey = string;

export interface ParamDef {
  id: string;
  name: string; // Lua `name`, e.g. "VCF CUTOFF"
  block: BlockKey;
  offset: number; // byte offset in block data (addr[3])
  encoding: "u7" | "u16"; // u16 = nibble-packed over offset, offset+1
  max: number; // raw full scale
  kind: "continuous" | "switch" | "enum";
  display: (raw: number) => string;
  assignId?: number; // TB-3 param-assign ID
  center?: number; // zero point of signed / bipolar params (raw)
}

const key = (a3: number): BlockKey => addrKey([0x10, 0x00, a3, 0x00]);

interface Opts {
  max?: number;
  signed?: boolean;
  bipolar?: boolean;
  center?: number;
  semitoneRange?: boolean;
  sw?: boolean; // `sw` and `btn` rows in the Lua table
  id?: number;
}

const snake = (name: string): string =>
  name
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const onOff = (raw: number): string => (raw === 0 ? "OFF" : "ON");

function param(a3: number, offset: number, name: string, encoding: "u7" | "u16", o: Opts = {}): ParamDef {
  const max = o.sw ? 1 : (o.max ?? (encoding === "u16" ? 255 : 127));
  let display: (raw: number) => string = String;
  let center: number | undefined;
  if (o.sw) display = onOff;
  else if (o.semitoneRange) display = fmtSemitoneRange;
  else if (o.signed) {
    display = fmtSigned;
    center = 64;
  } else if (o.bipolar) {
    const c = o.center ?? Math.floor(max / 2);
    display = (raw) => fmtBipolar(raw, c);
    center = c;
  }
  return {
    id: snake(name),
    name,
    block: key(a3),
    offset,
    encoding,
    max,
    kind: o.sw ? "switch" : "continuous",
    display,
    assignId: o.id,
    center,
  };
}

const u7 = (a3: number, offset: number, name: string, id: number, o: Opts = {}) =>
  param(a3, offset, name, "u7", { ...o, id });
const u16 = (a3: number, offset: number, name: string, id: number, o: Opts = {}) =>
  param(a3, offset, name, "u16", { ...o, id });
const sw = (a3: number, offset: number, name: string, id: number) => u7(a3, offset, name, id, { sw: true });

function special(a3: number, offset: number, id: string, name: string, d: Partial<ParamDef>): ParamDef {
  return { id, name, block: key(a3), offset, encoding: "u7", max: 127, kind: "enum", display: String, ...d };
}

const SYNTH: ParamDef[] = [
  // LFO 10 00 00 00
  u7(0x00, 0x00, "LFO RATE", 0),
  u7(0x00, 0x01, "LFO DELAY", 1),
  u7(0x00, 0x02, "LFO SAW", 2),
  u7(0x00, 0x03, "LFO SQR", 3),
  u7(0x00, 0x04, "LFO TRI", 4),
  u7(0x00, 0x05, "LFO SIN", 5),
  u7(0x00, 0x06, "LFO CV OFFSET", 6),
  u7(0x00, 0x07, "LFO S&H", 7),
  u7(0x00, 0x08, "VCO LFO DEPTH", 8, { signed: true }),
  u7(0x00, 0x09, "VCF LFO DEPTH", 9, { signed: true }),
  u7(0x00, 0x0a, "VCA LFO DEPTH", 10, { signed: true }),
  sw(0x00, 0x0b, "LFO BPM SYNC", 11),
  sw(0x00, 0x0c, "LFO RETRIGGER", 12),

  // Tuning (CV offset) 10 00 02 00.
  // param_defs.lua: the spec labels off=0 as SQR and off=2 as SAW, but hardware is reversed, so
  // SAW is @00 (id 14) and SQR is @02 (id 13). Centre is 127 here; tools/decode_patch.py uses 128.
  // The disagreement is recorded, not resolved.
  u16(0x02, 0x00, "SAW TUNING", 14, { bipolar: true, max: 151, center: 127 }),
  u16(0x02, 0x02, "SQR TUNING", 13, { bipolar: true, max: 151, center: 127 }),
  u16(0x02, 0x04, "RING+SIN TUNING", 15, { bipolar: true, max: 151, center: 127 }),

  // Cross modulation 10 00 04 00
  u7(0x04, 0x00, "CM SQR>SAW", 16, { signed: true }),
  u7(0x04, 0x02, "CM SAW>SAW", 18, { signed: true }),
  u7(0x04, 0x03, "CM WHITE>SAW", 19, { signed: true }),
  u7(0x04, 0x04, "CM PINK>SAW", 20, { signed: true }),
  u7(0x04, 0x05, "CM SQR>SQR", 21, { signed: true }),
  u7(0x04, 0x07, "CM SAW>SQR", 23, { signed: true }),
  u7(0x04, 0x08, "CM WHITE>SQR", 24, { signed: true }),
  u7(0x04, 0x09, "CM PINK>SQR", 25, { signed: true }),

  // Ring modulation 10 00 06 00
  u7(0x06, 0x00, "RM SAW DEPTH", 26),
  u7(0x06, 0x01, "RM SQR DEPTH", 27),
  u7(0x06, 0x04, "RM RING DEPTH", 30),
  u7(0x06, 0x05, "RM WHITE DEPTH", 31),
  u7(0x06, 0x06, "RM PINK DEPTH", 32),
  u7(0x06, 0x0b, "RM DEPTH", 37),

  // VCO levels and source switches 10 00 08 00
  u7(0x08, 0x00, "VCO SAW LEVEL", 40),
  u7(0x08, 0x01, "VCO SQR LEVEL", 41),
  u7(0x08, 0x04, "VCO SIN LEVEL", 44),
  u7(0x08, 0x05, "VCO WHITE LEVEL", 45),
  u7(0x08, 0x06, "VCO PINK LEVEL", 46),
  u7(0x08, 0x07, "VCO RING LEVEL", 47),
  sw(0x08, 0x08, "VCO SAW SW", 48),
  sw(0x08, 0x09, "VCO SQR SW", 49),
  sw(0x08, 0x0a, "VCO SIN SW", 50),
  sw(0x08, 0x0b, "VCO WH NOISE SW", 51),
  sw(0x08, 0x0c, "VCO PK NOISE SW", 52),
  sw(0x08, 0x0d, "VCO RING SW", 53),

  // VCF 10 00 0A 00
  u16(0x0a, 0x00, "VCF CUTOFF", 54),
  u16(0x0a, 0x02, "VCF RESONANCE", 55),
  u16(0x0a, 0x04, "VCF ENV DEPTH", 56),
  u7(0x0a, 0x06, "VCF ATTACK", 57),
  u7(0x0a, 0x07, "VCF DECAY", 58),
  u7(0x0a, 0x08, "VCF SUSTAIN", 59),
  u7(0x0a, 0x09, "VCF RELEASE", 60),
  u7(0x0a, 0x0a, "VCF KEY FOLLOW", 61),

  // VCA 10 00 0C 00
  u7(0x0c, 0x00, "VCA ATTACK", 62),
  u7(0x0c, 0x01, "VCA DECAY", 63),
  u7(0x0c, 0x02, "VCA SUSTAIN", 64),
  u7(0x0c, 0x03, "VCA RELEASE", 65),
  u7(0x0c, 0x04, "MASTER VOLUME", 66),

  // Distortion 10 00 0E 00
  sw(0x0e, 0x00, "DIST SW", 67),
  special(0x0e, 0x01, "dist_type", "DIST TYPE", {
    max: 24,
    display: (raw) => DIST_TYPES[raw] ?? String(raw),
  }),
  u7(0x0e, 0x02, "DIST DRIVE", 69, { max: 120 }),
  u7(0x0e, 0x03, "DIST BOTTOM", 70, { max: 100, bipolar: true }),
  u7(0x0e, 0x04, "DIST TONE", 71, { max: 100, bipolar: true }),
  u7(0x0e, 0x05, "DIST EFX LEVEL", 72, { max: 100 }),
  u7(0x0e, 0x06, "DIST DRY LEVEL", 73, { max: 100 }),
  sw(0x0e, 0x07, "DIST COLOR", 74),

  // Portamento / param assign 10 00 14 00
  sw(0x14, 0x00, "PORTA SW", 254),
  u7(0x14, 0x01, "PORTA TIME", 255),
  special(0x14, 0x02, "porta_mode", "PORTA MODE", {
    max: 1,
    display: (raw) => (raw === 0 ? "LEGATO" : "ALWAYS"),
  }),
  u7(0x14, 0x03, "BENDER RANGE", 257, { max: 23, semitoneRange: true }),
  u16(0x14, 0x0e, "ACCENT", 264),
];

// Assign slots hold a param-assign ID (u16, nibble-packed). The display resolves it back to a
// synthesis parameter name; EFX IDs have no table yet and show as `#<id>`.
const ASSIGN_NAMES = new Map(
  SYNTH.flatMap((p) => (p.assignId === undefined ? [] : [[p.assignId, p.name] as const])),
);
const assignDisplay = (raw: number): string => ASSIGN_NAMES.get(raw) ?? `#${raw}`;
// Max is the 14-bit hard limit (msb 0..0x7F, lsb 0..15): the Lua IDs reach 264, so the msb
// exceeds 0x0F (264 → bytes 10 08). Inferred from the Lua ID range; still to be confirmed on
// hardware (assign Accent on the TB-3, then dump).
const assignSlot = (offset: number, id: string, name: string): ParamDef =>
  special(0x14, offset, id, name, { encoding: "u16", max: 0x7f * 16 + 15, display: assignDisplay });

export const PARAMS: readonly ParamDef[] = [
  ...SYNTH,
  assignSlot(0x04, "assign_xy_mod", "ASSIGN XY MOD"),
  assignSlot(0x06, "assign_effect_knob", "ASSIGN EFFECT KNOB"),
  assignSlot(0x08, "assign_pad_x", "ASSIGN PAD X"),
  assignSlot(0x0a, "assign_pad_y", "ASSIGN PAD Y"),
];

const BY_ID = new Map(PARAMS.map((p) => [p.id, p]));

export function paramById(id: string): ParamDef {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`unknown param id: ${id}`);
  return p;
}

// DT1 address of a parameter's first byte.
export function paramAddr(def: ParamDef): Address {
  const a = def.block.match(/../g)!.map((h) => parseInt(h, 16));
  return [a[0]!, a[1]!, a[2]!, def.offset];
}
