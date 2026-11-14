// The EQ's drawing: its frequency response with a handle for each band (ui/EqView.tsx). Every band setting but
// LEVEL is set here.
import { EQ_FREQS, EQ_Q, HPF_FREQS, LPF_FREQS } from "../../core/display";
import { EQ_MAX_HZ, EQ_MIN_HZ, eqGainDb, eqResponse, parseHz } from "../../core/eqResponse";
import type { EqSettings } from "../../core/eqResponse";
import { getEfxRaw } from "../../core/patch";
import { EqView } from "../../ui/EqView";
import type { EqHandle } from "../../ui/EqView";
import { useEditor } from "../EditorContext";
import type { EfxViewProps } from "./viewContext";

// Byte offsets of the EQ's settings in the EFX1 block.
export const EQ_OFFSETS = {
  lowCut: 0x54,
  lowGain: 0x55,
  lmFreq: 0x56,
  lmQ: 0x57,
  lmGain: 0x58,
  hmFreq: 0x59,
  hmQ: 0x5a,
  hmGain: 0x5b,
  hiCut: 0x5c,
  hiGain: 0x5d,
  level: 0x5e,
} as const satisfies Record<keyof EqSettings, number>;

export const EQ_IN_VIEW = Object.values(EQ_OFFSETS).filter((o) => o !== EQ_OFFSETS.level);

const hzTable = (labels: readonly string[], flat: number) => labels.map((l) => parseHz(l) ?? flat);
const EQ_HZ = hzTable(EQ_FREQS, EQ_MIN_HZ);
const LOW_CUT_HZ = hzTable(HPF_FREQS, EQ_MIN_HZ); // "Flat" at the left edge
const HI_CUT_HZ = hzTable(LPF_FREQS, EQ_MAX_HZ); // "Flat" at the right edge
const SHELF_HANDLE_HZ = { low: 40, high: 8000 }; // kept clear of the cut handles at the edges
const GAIN_MAX = 40;
const GAIN_ZERO = 20;

export function EqDrawing({ efx, size }: EfxViewProps) {
  const ed = useEditor();
  const patch = ed.patch;
  const b = (offset: number) => (patch ? getEfxRaw(patch, efx, offset) : 0);
  const set = (offset: number) => (v: number) => ed.setEfxByte(efx, offset, v);
  const e = Object.fromEntries(Object.entries(EQ_OFFSETS).map(([k, o]) => [k, b(o)])) as unknown as EqSettings;
  const at = (hz: number) => eqGainDb(e, hz);
  const gain = (offset: number) => ({ raw: b(offset), max: GAIN_MAX, onChange: set(offset) });
  const O = EQ_OFFSETS;
  const handles: EqHandle[] = [
    {
      key: "lc",
      label: "CUT",
      below: true,
      hz: LOW_CUT_HZ[e.lowCut]!,
      db: at(LOW_CUT_HZ[e.lowCut]!),
      freq: { table: LOW_CUT_HZ, index: e.lowCut, onChange: set(O.lowCut) },
      wheel: { value: e.lowCut, max: LOW_CUT_HZ.length - 1, onChange: set(O.lowCut) },
      onReset: () => set(O.lowCut)(0),
    },
    {
      key: "lo",
      label: "LOW",
      hz: SHELF_HANDLE_HZ.low,
      db: at(SHELF_HANDLE_HZ.low),
      gain: gain(O.lowGain),
      wheel: { value: e.lowGain, max: GAIN_MAX, onChange: set(O.lowGain) },
      onReset: () => set(O.lowGain)(GAIN_ZERO),
    },
    ...(["lm", "hm"] as const).map((band) => {
      const o = band === "lm" ? { f: O.lmFreq, q: O.lmQ, g: O.lmGain } : { f: O.hmFreq, q: O.hmQ, g: O.hmGain };
      const hz = EQ_HZ[b(o.f)] ?? EQ_MIN_HZ;
      return {
        key: band,
        label: band === "lm" ? "LM" : "HM",
        hz,
        db: at(hz),
        freq: { table: EQ_HZ, index: b(o.f), onChange: set(o.f) },
        gain: gain(o.g),
        wheel: { value: b(o.q), max: EQ_Q.length - 1, onChange: set(o.q) }, // scroll = Q
        onReset: () => set(o.g)(GAIN_ZERO),
      };
    }),
    {
      key: "hi",
      label: "HIGH",
      hz: SHELF_HANDLE_HZ.high,
      db: at(SHELF_HANDLE_HZ.high),
      gain: gain(O.hiGain),
      wheel: { value: e.hiGain, max: GAIN_MAX, onChange: set(O.hiGain) },
      onReset: () => set(O.hiGain)(GAIN_ZERO),
    },
    {
      key: "hc",
      label: "CUT",
      below: true,
      hz: HI_CUT_HZ[e.hiCut]!,
      db: at(HI_CUT_HZ[e.hiCut]!),
      freq: { table: HI_CUT_HZ, index: e.hiCut, onChange: set(O.hiCut) },
      wheel: { value: e.hiCut, max: HI_CUT_HZ.length - 1, onChange: set(O.hiCut) },
      onReset: () => set(O.hiCut)(HI_CUT_HZ.length - 1),
    },
  ];
  return <EqView ys={patch ? eqResponse(e) : null} handles={handles} width={size.width} height={size.height} />;
}
