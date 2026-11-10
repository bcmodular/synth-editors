// Each effect's drawing, by effect id (all 46). ParamBars stands in for any effect missing from the list.
import type { ReactNode } from "react";
import type { FxId } from "../../core/fxTypes";
import {
  CompressorView, CrusherView, DistortionView, GtAmpSimView, LofiView, OverdriveView, RingModView, WrmSaturatorView,
} from "./drive";
import { BackSpinView, DjfxLooperView, DownerView, ScatterView, StopperView } from "./dj";
import { CloudDelayView, DjfxDelayView, KoDaMaView, SxDelayView, SyncDelayView, TapeEchoView, TimeCtrlDlyView, ZanZouView } from "./delay";
import { CassetteSimView, HaDouView, ReverbView, SxReverbView, VinylSim303View, VinylSim404View } from "./reverbVintage";
import { ChorusView, FlangerView, JunoChorusView, PhaserView, SlicerView, ToGuRoView, TremoloPanView } from "./modulation";
import { AutoPitchView, ChromaticPsView, HarmonyView, HyperResoView, ResonatorView, VocoderView } from "./pitch";
import { EqualizerView, FilterDriveView, IsolatorView, SbfView, SuperFilterView, WahView } from "./filterEq";
import type { ViewProps } from "./types";

export const VIEWS: Partial<Record<FxId, (p: ViewProps) => ReactNode>> = {
  1: FilterDriveView,
  2: ResonatorView,
  3: SyncDelayView,
  4: IsolatorView,
  5: DjfxLooperView,
  6: ScatterView,
  7: DownerView,
  8: HaDouView,
  9: KoDaMaView,
  10: ZanZouView,
  11: ToGuRoView,
  12: SbfView,
  13: StopperView,
  14: TapeEchoView,
  15: TimeCtrlDlyView,
  16: SuperFilterView,
  27: WahView,
  28: SlicerView,
  29: TremoloPanView,
  30: ChromaticPsView,
  31: HyperResoView,
  17: WrmSaturatorView,
  18: VinylSim303View,
  19: VinylSim404View,
  20: CassetteSimView,
  21: LofiView,
  22: ReverbView,
  23: ChorusView,
  24: JunoChorusView,
  25: FlangerView,
  26: PhaserView,
  32: RingModView,
  33: CrusherView,
  34: OverdriveView,
  35: DistortionView,
  36: EqualizerView,
  37: CompressorView,
  38: SxReverbView,
  39: SxDelayView,
  40: CloudDelayView,
  41: BackSpinView,
  42: DjfxDelayView,
  43: AutoPitchView,
  44: VocoderView,
  45: HarmonyView,
  46: GtAmpSimView,
};
