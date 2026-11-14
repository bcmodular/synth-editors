// Each EFX type's drawing, by type name, and the slots set in it (shown as readouts beside it, not faders).
// Types missing from the list (BYPASS) have faders only.
import type { ReactNode } from "react";
import { BitCrushView, COMP_IN_VIEW, CompView, CRUSH_IN_VIEW, RING_IN_VIEW, RingModView } from "./dynamics";
import { EQ_IN_VIEW, EqDrawing } from "./eq";
import {
  CHORUS_IN_VIEW, ChorusView, FLANGER_IN_VIEW, FlangerView, PHASER_IN_VIEW, PhaserView, TREMOLO_IN_VIEW, TremoloView,
} from "./modulation";
import { delayInView, DelayView, PitchShiftView, pitchInView, REVERB_IN_VIEW, ReverbView } from "./timePitch";
import type { EfxViewProps } from "./viewContext";

export interface EfxDrawing {
  View: (p: EfxViewProps) => ReactNode;
  inView: (raw: (offset: number) => number) => readonly number[];
}

const always = (offsets: readonly number[]) => () => offsets;

export const EFX_VIEWS: Partial<Record<string, EfxDrawing>> = {
  COMP: { View: CompView, inView: always(COMP_IN_VIEW) },
  "RING MOD": { View: RingModView, inView: always(RING_IN_VIEW) },
  "BIT CRUSH": { View: BitCrushView, inView: always(CRUSH_IN_VIEW) },
  TREMOLO: { View: TremoloView, inView: always(TREMOLO_IN_VIEW) },
  CHORUS: { View: ChorusView, inView: always(CHORUS_IN_VIEW) },
  FLANGER: { View: FlangerView, inView: always(FLANGER_IN_VIEW) },
  PHASER: { View: PhaserView, inView: always(PHASER_IN_VIEW) },
  DELAY: { View: DelayView, inView: delayInView },
  "PITCH SHIFT": { View: PitchShiftView, inView: pitchInView },
  EQ: { View: EqDrawing, inView: always(EQ_IN_VIEW) },
  REVERB: { View: ReverbView, inView: always(REVERB_IN_VIEW) },
};
