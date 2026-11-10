// Listening to the TB-3's USB audio for the LIVE waveform (docs/tb3-live-waveform-design.md). The input
// handling is shared with the SP-404 editor (packages/audio).
import { pickInputFor } from "@synth-editors/audio";
import type { AudioInput } from "@synth-editors/audio";

export { listAudioInputs, listAudioInputsWithNames, listen } from "@synth-editors/audio";
export type { AudioInput, Frame, Listening } from "@synth-editors/audio";

// The chosen input by name, else the first with "TB-3" in its name.
export const pickInput = (inputs: AudioInput[], chosen: string | null) => pickInputFor(inputs, chosen, /TB-3/i);
