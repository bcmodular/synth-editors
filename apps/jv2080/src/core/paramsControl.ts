// The controller matrix and the EFX control (manual p. 73, 104–106; address map p. 189–190). A patch has three
// controllers: controller 1 is the modulation lever, 2 and 3 each follow a source chosen here. Each tone sends each
// controller to up to four destinations, each with its own depth. Two more sources move the EFX type's realtime
// parameter (the one marked # in the manual's effect pages).

import { choice, common, depth, tone, type ParamDef } from "./paramDefs";

const BASIC_SOURCES = ["OFF", "SYS-CTRL1", "SYS-CTRL2", "MODULATION", "BREATH", "FOOT", "VOLUME", "PAN", "EXPRESSION",
  "PITCH BEND", "AFTERTOUCH"];
export const EFX_SOURCES = BASIC_SOURCES; // p. 189 *2
export const CONTROL_SOURCES = [...BASIC_SOURCES, "LFO1", "LFO2", "VELOCITY", "KEYFOLLOW", "PLAYMATE"]; // *7
export const HOLD_PEAK = ["OFF", "HOLD", "PEAK"]; // *8

// p. 190 *9, with what each abbreviation moves.
export const DESTINATIONS: readonly (readonly [string, string])[] = [
  ["OFF", "nothing"], ["PCH", "pitch"], ["CUT", "cutoff"], ["RES", "resonance"], ["LEV", "level"], ["PAN", "pan"],
  ["MIX", "the Mix/EFX send"], ["CHO", "the chorus send"], ["REV", "the reverb send"],
  ["PL1", "LFO1's pitch depth"], ["PL2", "LFO2's pitch depth"], ["FL1", "LFO1's filter depth"],
  ["FL2", "LFO2's filter depth"], ["AL1", "LFO1's amp depth"], ["AL2", "LFO2's amp depth"],
  ["pL1", "LFO1's pan depth"], ["pL2", "LFO2's pan depth"], ["L1R", "LFO1's rate"], ["L2R", "LFO2's rate"],
];

export const CONTROLLERS = [1, 2, 3] as const;
export const SLOTS = [1, 2, 3, 4] as const;

export const ctrlDestId = (c: number, d: number) => `ctrl${c}Dest${d}`;
export const ctrlDepthId = (c: number, d: number) => `ctrl${c}Depth${d}`;

export const COMMON_CONTROL: readonly ParamDef[] = [
  choice(common("efxCtrlSource1", "EFX Ctrl Source 1", 0x1d), EFX_SOURCES),
  depth(common("efxCtrlDepth1", "EFX Ctrl Depth 1", 0x1e)),
  choice(common("efxCtrlSource2", "EFX Ctrl Source 2", 0x1f), EFX_SOURCES),
  depth(common("efxCtrlDepth2", "EFX Ctrl Depth 2", 0x20)),
  choice(common("ctrlSource2", "Ctrl 2 Source", 0x3a), CONTROL_SOURCES),
  choice(common("ctrlSource3", "Ctrl 3 Source", 0x3b), CONTROL_SOURCES),
  choice(common("efxCtrlHold", "EFX Ctrl Hold/Peak", 0x3c), HOLD_PEAK),
  ...CONTROLLERS.map((c) => choice(common(`ctrl${c}Hold`, `Ctrl ${c} Hold/Peak`, 0x3c + c), HOLD_PEAK)),
];

// Controller c's destination d at 0x15 + 8(c − 1) + 2(d − 1), its depth in the next byte.
export const TONE_CONTROL: readonly ParamDef[] = CONTROLLERS.flatMap((c) => SLOTS.flatMap((d) => {
  const at = 0x15 + 8 * (c - 1) + 2 * (d - 1);
  return [
    choice(tone(ctrlDestId(c, d), `Ctrl ${c} Dest ${d}`, at), DESTINATIONS.map(([abbr]) => abbr)),
    depth(tone(ctrlDepthId(c, d), `Ctrl ${c} Depth ${d}`, at + 1)),
  ];
}));
