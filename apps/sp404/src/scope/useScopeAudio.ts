// The SP-404's USB audio for the scopes (docs/sp404-design.md › Scopes): opened at launch, the input chosen in
// Settings or else the first named SP-404, and opened again when it comes back after unplugging.

import { explainAudioError, listAudioInputs, listAudioInputsWithNames, listen, pickInputFor } from "@synth-editors/audio";
import type { AudioInput, Listening } from "@synth-editors/audio";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { SPECTRUM_FFT } from "./scopeEngine";

export type AudioStatus = { kind: "starting" } | { kind: "on"; name: string } | { kind: "error"; message: string };

const SP404_AUDIO = /SP-404/i;
const NO_INPUT = "No SP-404 audio: choose one in Settings";
const SPECTRUM_SMOOTHING = 0.6;

// The computer's audio inputs, kept up to date as devices come and go; `named` once their names can be read.
function useAudioInputs() {
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [named, setNamed] = useState(false);
  const take = useCallback((list: AudioInput[], askedForNames = false) => {
    setInputs(list);
    if (askedForNames || list.some((d) => d.name)) setNamed(true);
  }, []);
  useEffect(() => {
    const refresh = () => listAudioInputs().then((list) => take(list), () => take([]));
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, [take]);
  return { inputs, named, take };
}

interface Opening {
  isCancelled: () => boolean;
  setStatus: (s: AudioStatus) => void;
  take: (list: AudioInput[], askedForNames: boolean) => void;
  listening: RefObject<Listening | null>;
}

// Start whatever the input to use calls for: reading the names first (which asks for permission, once), saying
// there's no input, or opening it.
function startAudio(named: boolean, picked: AudioInput | undefined, o: Opening) {
  const fail = (e: unknown) =>
    !o.isCancelled() && o.setStatus({ kind: "error", message: explainAudioError(e, "SP-404 Editor") });
  if (!named) return void listAudioInputsWithNames().then((list) => !o.isCancelled() && o.take(list, true), fail);
  if (!picked) return o.setStatus({ kind: "error", message: NO_INPUT });
  o.setStatus({ kind: "starting" });
  listen(picked, { spectrumSize: SPECTRUM_FFT, spectrumSmoothing: SPECTRUM_SMOOTHING }).then((l) => {
    if (o.isCancelled()) return l.stop();
    o.listening.current = l;
    o.setStatus({ kind: "on", name: l.name });
  }, fail);
}

export function useScopeAudio(chosenName: string) {
  const { inputs, named, take } = useAudioInputs();
  const [status, setStatus] = useState<AudioStatus>({ kind: "starting" });
  const listening: RefObject<Listening | null> = useRef(null);
  const picked = named ? pickInputFor(inputs, chosenName || null, SP404_AUDIO) : undefined;
  const key = named ? (picked?.id ?? "none") : "unknown";

  useEffect(() => {
    let cancelled = false;
    startAudio(named, picked, { isCancelled: () => cancelled, setStatus, take, listening });
    return () => {
      cancelled = true;
      listening.current?.stop();
      listening.current = null;
    };
    // Opened again only when the input to use changes (by id), not on every list refresh.
  }, [key]);

  return { status, listening, inputs };
}

export type ScopeAudio = ReturnType<typeof useScopeAudio>;
