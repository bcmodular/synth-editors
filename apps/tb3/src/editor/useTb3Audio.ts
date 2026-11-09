// The LIVE waveform's audio (docs/tb3-live-waveform-design.md): DRAWN or LIVE, which input, and the
// open stream while LIVE is on. The input opens only when LIVE is on, so people who never use it
// never see a microphone prompt.
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { listAudioInputs, listAudioInputsWithNames, listen, pickInput } from "./tb3Audio";
import type { AudioInput, Listening } from "./tb3Audio";
import { load, save } from "./storage";

export type VcoView = "drawn" | "live";
export type AudioStatus = { kind: "off" | "starting" } | { kind: "on"; name: string } | { kind: "error"; message: string };

const VIEW_KEY = "tb3.vcoView";
const INPUT_KEY = "audio.tb3In";
const NO_INPUT = "No TB-3 audio input: choose one in MIDI settings";

function explain(e: unknown): string {
  if (e instanceof DOMException && e.name === "NotAllowedError")
    return "Audio input not allowed: allow TB-3 Editor in the system's microphone settings";
  return e instanceof Error ? e.message : String(e);
}

async function open(name: string | null, onInputs: (list: AudioInput[]) => void): Promise<Listening> {
  const list = await listAudioInputsWithNames();
  onInputs(list);
  const input = pickInput(list, name);
  if (!input) throw new Error(NO_INPUT);
  return listen(input);
}

// The computer's audio inputs, kept up to date as devices come and go.
function useAudioInputs() {
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const refresh = useCallback(() => {
    listAudioInputs()
      .then(setInputs)
      .catch(() => setInputs([]));
  }, []);
  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, [refresh]);
  return { inputs, setInputs };
}

// While `on`, the chosen input is open in `listening`.
function useListening(on: boolean, inputName: string | null, onInputs: (list: AudioInput[]) => void) {
  const [status, setStatus] = useState<AudioStatus>({ kind: "off" });
  const listening: RefObject<Listening | null> = useRef(null);
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    setStatus({ kind: "starting" });
    open(inputName, onInputs)
      .then((l) => {
        if (cancelled) return l.stop();
        listening.current = l;
        setStatus({ kind: "on", name: l.name });
      })
      .catch((e: unknown) => !cancelled && setStatus({ kind: "error", message: explain(e) }));
    return () => {
      cancelled = true;
      listening.current?.stop();
      listening.current = null;
      setStatus({ kind: "off" });
    };
  }, [on, inputName, onInputs]);
  return { status, listening };
}

// A remembered string setting.
function useSetting<T extends string>(key: string, read: (v: string | null) => T) {
  const [value, setValue] = useState(() => read(load(key)));
  const set = useCallback(
    (v: T) => {
      save(key, v);
      setValue(v);
    },
    [key],
  );
  return [value, set] as const;
}

const readView = (v: string | null): VcoView => (v === "live" ? "live" : "drawn");
const readName = (v: string | null) => v ?? "";

export function useTb3Audio() {
  const [view, setView] = useSetting(VIEW_KEY, readView);
  const [inputName, chooseInput] = useSetting(INPUT_KEY, readName);
  const { inputs, setInputs } = useAudioInputs();
  const { status, listening } = useListening(view === "live", inputName || null, setInputs);
  return { view, setView, inputs, inputName, chooseInput, status, listening };
}

export type Tb3Audio = ReturnType<typeof useTb3Audio>;
