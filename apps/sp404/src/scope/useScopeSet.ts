// Everything the scopes need, from the settings: the SP-404's audio, the MIDI clock and the frame loop.
import type { Settings } from "../settings/useSettings";
import { useBeatClock } from "./useBeatClock";
import { useScopeAudio } from "./useScopeAudio";
import { useScopes } from "./useScopes";

export function useScopeSet(settings: Settings) {
  const audio = useScopeAudio(settings.audioIn);
  const clockIn = useBeatClock(settings.clockIn);
  const scopes = useScopes(audio, clockIn);
  return { audio, clockIn, scopes };
}

export type ScopeSet = ReturnType<typeof useScopeSet>;
