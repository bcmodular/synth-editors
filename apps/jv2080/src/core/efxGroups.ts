// The EFX chooser's rows: the 40 types grouped by what they do, each row in its group's colour (after the SP-404
// app's chooser). Types are raw EFX Type values (0–39); `label` is the cell's text, shorter than the manual's name.

export interface EfxGroup {
  name: string;
  colour: string;
  types: readonly { type: number; label: string }[];
}

const t = (type: number, label: string) => ({ type, label });

export const EFX_GROUPS: readonly EfxGroup[] = [
  { name: "Dynamics", colour: "#2fd3ff", types: [
    t(0, "STEREO EQ"), t(4, "SPECTRUM"), t(5, "ENHANCER"), t(8, "COMPRESSOR"), t(9, "LIMITER")] },
  { name: "Drive", colour: "#ff4438", types: [t(1, "OVERDRIVE"), t(2, "DISTORTION")] },
  { name: "Modulators", colour: "#b48cff", types: [
    t(6, "AUTO WAH"), t(3, "PHASER"), t(7, "ROTARY"), t(13, "STEREO CHORUS"), t(10, "HEXA CHORUS"),
    t(11, "TREMOLO CHORUS"), t(12, "SPACE-D"), t(14, "STEREO FLANGER"), t(15, "STEP FLANGER")] },
  { name: "Delay & reverb", colour: "#4a7dff", types: [
    t(16, "STEREO DELAY"), t(17, "MOD DELAY"), t(18, "TRIPLE TAP"), t(19, "QUAD TAP"), t(20, "TIME CTRL DELAY"),
    t(23, "REVERB"), t(24, "GATE REVERB")] },
  { name: "Pitch", colour: "#3ddc5a", types: [t(21, "2VOICE PITCH"), t(22, "FBK PITCH")] },
  { name: "Drive into…", colour: "#ff8a2a", types: [
    t(25, "OD → CHORUS"), t(26, "OD → FLANGER"), t(27, "OD → DELAY"), t(28, "DIST → CHORUS"), t(29, "DIST → FLANGER"),
    t(30, "DIST → DELAY")] },
  { name: "Other chains", colour: "#f2d03b", types: [
    t(31, "ENH → CHORUS"), t(32, "ENH → FLANGER"), t(33, "ENH → DELAY"), t(34, "CHORUS → DELAY"),
    t(35, "FLANGER → DELAY"), t(36, "CHORUS → FLANGER")] },
  { name: "Parallel effects", colour: "#ff5fc8", types: [
    t(37, "CHORUS / DELAY"), t(38, "FLANGER / DELAY"), t(39, "CHORUS / FLANGER")] },
];

export const EFX_CELLS = 9; // cells per row: the longest group

export function efxGroupOf(type: number): EfxGroup | undefined {
  return EFX_GROUPS.find((g) => g.types.some((x) => x.type === type));
}
