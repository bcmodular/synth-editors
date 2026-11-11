// The scopes' frame loop (docs/sp404-design.md › Scopes): each animation frame reads the SP-404's audio into the
// scope state and paints whatever parts are on screen (the meter column always, the SCOPE view when shown).

import { clockBpm, steadyBpm } from "@synth-editors/audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { advanceScope, clearPeaks, emptyScope, resetLoudness, setHeld, SPANS, type Span } from "./scopeEngine";
import { paintMeter, paintScope, paletteFor, type PartName, type Parts } from "./scopePaint";
import type { ClockIn } from "./useBeatClock";
import type { ScopeAudio } from "./useScopeAudio";

const SPAN_KEY = "sp404.scopeSpan";
const GRAPH_KEY = "sp404.scopeGraph";

// The top panel: the spectrum line or the scrolling spectrogram.
export type Graph = "spectrum" | "spectrogram";

function readSpan(): Span {
  const v = localStorage.getItem(SPAN_KEY);
  return SPANS.find((s) => String(s) === v) ?? "4s";
}

const readGraph = (): Graph => (localStorage.getItem(GRAPH_KEY) === "spectrogram" ? "spectrogram" : "spectrum");

function useFrames(fn: () => void) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    let id = 0;
    const tick = () => {
      latest.current();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

const widthOf = (el: HTMLElement | null | undefined) => el?.offsetWidth ?? 0;
const sizeOf = (el: HTMLElement | null | undefined) => ({ width: widthOf(el), rows: el?.offsetHeight ?? 0 });

// The sizes the visible parts ask for this frame (0 for those not on screen).
const sizesOf = (parts: Parts) => ({
  waveWidth: widthOf(parts.waveL),
  spectrumWidth: widthOf(parts.spectrum),
  spectrogram: sizeOf(parts.spectrogram),
});

export function useScopes(audio: ScopeAudio, clockIn: ClockIn) {
  const state = useRef(emptyScope());
  const parts = useRef<Parts>({});
  const [held, setHeldShown] = useState(false);
  const [span, setSpanShown] = useState<Span>(readSpan);
  const [graph, setGraphShown] = useState<Graph>(readGraph);
  const spanNow = useRef(span);
  spanNow.current = span;
  const bpmShown = useRef<number | undefined>(undefined);

  useFrames(() => {
    const s = state.current;
    const l = audio.listening.current;
    const clock = clockIn.clock.current;
    const bpm = (bpmShown.current = steadyBpm(bpmShown.current, clockBpm(clock, performance.now())));
    if (l) advanceScope(s, l, { ...sizesOf(parts.current), span: spanNow.current, bpm });
    const root = parts.current.meter;
    if (!root) return;
    const p = paletteFor(root);
    paintMeter(s, parts.current, p);
    paintScope(s, parts.current, p, { clock, bpm, clockInput: clockIn.inputName, listening: l });
  });

  // A ref callback per part, made once.
  const part = useMemo(() => {
    const cache = new Map<PartName, (el: HTMLElement | null) => void>();
    return (name: PartName) => {
      if (!cache.has(name)) cache.set(name, (el) => void (parts.current[name] = el));
      return cache.get(name)!;
    };
  }, []);

  const toggleHold = useCallback(() => {
    const next = !state.current.held;
    setHeld(state.current, next);
    setHeldShown(next);
  }, []);
  const setSpan = useCallback((next: Span) => {
    localStorage.setItem(SPAN_KEY, String(next));
    setSpanShown(next);
  }, []);
  const setGraph = useCallback((next: Graph) => {
    localStorage.setItem(GRAPH_KEY, next);
    setGraphShown(next);
  }, []);
  const clear = useCallback(() => clearPeaks(state.current), []);
  const resetI = useCallback(() => resetLoudness(state.current), []);

  return { part, held, toggleHold, span, setSpan, graph, setGraph, clearPeaks: clear, resetLoudness: resetI };
}

export type Scopes = ReturnType<typeof useScopes>;
