// EFX1 / EFX2 type table (ported from tb-3/lua/shared/efx_defs.lua).
// Slot and button arrays keep `null` holes: they are layout positions, not gaps to compact.
import * as d from "./display";

export const EFX_BLOCK = { 1: "10001000", 2: "10001200" } as const;
export type EfxNum = 1 | 2;

export interface EfxSlot {
  offset: number;
  name: string;
  max: number;
  default: number; // fader default, 0..1
  disabledBy: number[]; // offsets whose nonzero value greys this slot
  display: (raw: number) => string;
}

export interface EfxButton {
  offset: number;
  name: string;
  action: "set" | "toggle";
  value?: number;
}

export interface EfxType {
  name: string;
  swOffset?: number;
  slots: (EfxSlot | null)[];
  buttons: (EfxButton | null)[];
}

interface SlotOpts {
  display?: (raw: number) => string;
  default?: number;
  disabledBy?: number[];
}

const slot = (offset: number, name: string, max: number, o: SlotOpts = {}): EfxSlot => ({
  offset,
  name,
  max,
  default: o.default ?? 0,
  disabledBy: o.disabledBy ?? [],
  display: o.display ?? String,
});

const set = (offset: number, name: string, value: number): EfxButton => ({ offset, name, action: "set", value });

const N = null;

const SHARED: EfxType[] = [
  { name: "BYPASS", slots: [], buttons: [] },
  {
    name: "COMP",
    swOffset: 0x01,
    slots: [
      slot(0x04, "THRESHOLD", 40, { display: d.dispThreshold }),
      slot(0x05, "RATIO", 13, { display: d.dispRatio }),
      slot(0x02, "ATTACK", 124, { display: d.dispCsAttack }),
      slot(0x03, "RELEASE", 124, { display: d.dispCsRelease }),
      slot(0x06, "KNEE", 9, { display: d.dispKnee }),
      slot(0x07, "GAIN", 80, { display: d.dispDb40, default: 0.5 }),
      slot(0x08, "BALANCE", 100, { display: d.dispBipolar50, default: 0.5 }),
    ],
    buttons: [],
  },
  {
    name: "RING MOD",
    swOffset: 0x09,
    slots: [
      slot(0x0a, "FREQ", 127),
      slot(0x0b, "SENS", 127),
      slot(0x0f, "BALANCE", 100, { display: d.dispBipolar50, default: 0.5 }),
      slot(0x10, "LEVEL", 127),
      slot(0x0d, "EQ LOW", 30, { display: d.dispDb15, default: 0.5 }),
      slot(0x0e, "EQ HIGH", 30, { display: d.dispDb15, default: 0.5 }),
    ],
    buttons: [N, N, N, set(0x0c, "UP", 0), set(0x0c, "DOWN", 1)],
  },
  {
    name: "BIT CRUSH",
    swOffset: 0x11,
    slots: [
      slot(0x12, "FILTER", 127),
      slot(0x13, "SAMP RATE", 127),
      slot(0x17, "LEVEL", 127),
      N,
      slot(0x15, "EQ LOW", 30, { display: d.dispDb15, default: 0.5 }),
      slot(0x16, "EQ HIGH", 30, { display: d.dispDb15, default: 0.5 }),
    ],
    buttons: [],
  },
  {
    name: "TREMOLO",
    swOffset: 0x18,
    slots: [
      slot(0x1c, "BPM SYNC", 20, { display: d.dispBpmDiv }),
      slot(0x1b, "RATE", 100, { display: d.dispRate, disabledBy: [0x1c] }),
      N,
      N,
      slot(0x1e, "DEPTH", 100),
      slot(0x19, "TYPE", 5, { display: d.dispTrType }),
      slot(0x20, "LEVEL", 100),
      slot(0x1a, "PHASE", 100, { display: d.dispPhase }),
      slot(0x1d, "SHAPE", 100),
    ],
    buttons: [N, N, N, set(0x1f, "TREMOLO", 0), set(0x1f, "PAN", 1)],
  },
  {
    name: "CHORUS",
    swOffset: 0x21,
    slots: [
      slot(0x24, "BPM SYNC", 20, { display: d.dispBpmDiv }),
      slot(0x23, "RATE", 100, { display: d.dispRate, disabledBy: [0x24] }),
      N,
      N,
      slot(0x25, "DEPTH", 100),
      slot(0x26, "PRE DLY", 80, { display: d.dispMs }),
      slot(0x29, "LEVEL", 100),
      slot(0x27, "HPF", 17, { display: d.dispHPF }),
      slot(0x28, "LPF", 14, { display: d.dispLPF, default: 1 }),
    ],
    buttons: [N, N, N, set(0x22, "MONO", 0), set(0x22, "STEREO1", 1), set(0x22, "STEREO2", 2)],
  },
  {
    name: "FLANGER",
    swOffset: 0x2a,
    slots: [
      slot(0x2c, "BPM SYNC", 20, { display: d.dispBpmDiv }),
      slot(0x2b, "RATE", 100, { display: d.dispRate, disabledBy: [0x2c] }),
      N,
      N,
      slot(0x2d, "DEPTH", 100),
      slot(0x2e, "MANUAL", 100, { display: d.dispBipolar50, default: 0.5 }),
      slot(0x2f, "RESONANCE", 100),
      slot(0x30, "SEPARATION", 100),
      slot(0x31, "HPF", 10, { display: d.dispFLHPF }),
      slot(0x32, "EFX LVL", 100),
      slot(0x33, "DIRECT LVL", 100),
    ],
    buttons: [],
  },
  {
    name: "PHASER",
    swOffset: 0x34,
    slots: [
      slot(0x37, "BPM SYNC", 20, { display: d.dispBpmDiv }),
      slot(0x36, "RATE", 100, { display: d.dispRate, disabledBy: [0x37, 0x3b] }),
      slot(0x3b, "STEP RATE", 20, { display: d.dispBpmDiv }),
      N,
      slot(0x38, "DEPTH", 100),
      slot(0x39, "MANUAL", 100, { display: d.dispBipolar50, default: 0.5 }),
      slot(0x3a, "RESONANCE", 127),
      slot(0x3c, "EFX LVL", 100),
      slot(0x3d, "DIRECT LVL", 100),
    ],
    buttons: [
      N,
      N,
      N,
      set(0x35, "4STAGE", 0),
      set(0x35, "8STAGE", 1),
      set(0x35, "12STAGE", 2),
      set(0x35, "BI-PH", 3),
    ],
  },
  {
    name: "DELAY",
    swOffset: 0x3e,
    slots: [
      slot(0x42, "BPM SYNC", 13, { display: d.dispBpmDiv }),
      slot(0x40, "TIME", 100, { display: d.dispMs, disabledBy: [0x42] }),
      N,
      N,
      slot(0x41, "TAP TIME", 100, { display: d.dispPct }),
      slot(0x43, "FEEDBACK", 100),
      slot(0x44, "LPF", 14, { display: d.dispLPF, default: 1 }),
      slot(0x45, "EFX LVL", 100),
      slot(0x46, "DIRECT LVL", 100),
    ],
    buttons: [N, N, N, set(0x3f, "SINGLE", 0), set(0x3f, "PAN", 1), set(0x3f, "STEREO", 2)],
  },
];

const PITCH_SHIFT: EfxType = {
  name: "PITCH SHIFT",
  swOffset: 0x47,
  slots: [
    slot(0x49, "PITCH 1", 48, { display: d.dispPitchSt, default: 0.5 }),
    slot(0x4a, "PRE DLY 1", 100, { display: d.dispMs }),
    slot(0x4c, "EFX LVL 1", 100),
    slot(0x4b, "FEEDBACK", 100),
    slot(0x4d, "PITCH 2", 48, { display: d.dispPitchSt, default: 0.5 }),
    slot(0x4e, "PRE DLY 2", 100, { display: d.dispMs }),
    slot(0x50, "EFX LVL 2", 100),
    slot(0x51, "DIRECT LVL", 100),
  ],
  buttons: [N, N, N, set(0x48, "1MONO", 0), set(0x48, "2MONO", 1), set(0x48, "2STEREO", 2)],
};

const EQ: EfxType = {
  name: "EQ",
  swOffset: 0x53,
  slots: [
    slot(0x54, "LOW CUT", 17, { display: d.dispHPF }),
    slot(0x55, "LOW GAIN", 40, { display: d.dispDb20, default: 0.5 }),
    slot(0x5c, "HI CUT", 14, { display: d.dispLPF, default: 1 }),
    slot(0x5d, "HI GAIN", 40, { display: d.dispDb20, default: 0.5 }),
    slot(0x56, "LM FREQ", 27, { display: d.dispEQFreq }),
    slot(0x57, "LM Q", 5, { display: d.dispEQQ }),
    slot(0x58, "LM GAIN", 40, { display: d.dispDb20, default: 0.5 }),
    N,
    slot(0x59, "HM FREQ", 27, { display: d.dispEQFreq }),
    slot(0x5a, "HM Q", 5, { display: d.dispEQQ }),
    slot(0x5b, "HM GAIN", 40, { display: d.dispDb20, default: 0.5 }),
    slot(0x5e, "LEVEL", 40, { display: d.dispDb20, default: 0.5 }),
  ],
  buttons: [],
};

const REVERB: EfxType = {
  name: "REVERB",
  swOffset: 0x47,
  slots: [
    slot(0x49, "TIME", 99, { display: d.dispRevTime }),
    slot(0x4a, "PRE DLY", 100, { display: d.dispMs }),
    slot(0x4d, "DENSITY", 10),
    slot(0x50, "SPRING SNS", 100),
    slot(0x4b, "HPF", 17, { display: d.dispHPF }),
    slot(0x4c, "LPF", 14, { display: d.dispLPF, default: 1 }),
    slot(0x4e, "EFX LVL", 100),
    slot(0x4f, "DIRECT LVL", 100),
  ],
  buttons: [
    set(0x48, "AMBIENT", 0),
    set(0x48, "ROOM", 1),
    set(0x48, "HALL 1", 2),
    set(0x48, "HALL 2", 3),
    set(0x48, "PLATE", 4),
    set(0x48, "SPRING", 5),
    set(0x48, "MOD", 6),
  ],
};

const TYPES: Record<EfxNum, EfxType[]> = {
  1: [...SHARED, PITCH_SHIFT, EQ], // 0–10
  2: [...SHARED, REVERB], // 0–9
};

// Types indexed by the type byte (data byte 0 of the EFX block).
export const efxTypes = (efxNum: EfxNum): readonly EfxType[] => TYPES[efxNum];
