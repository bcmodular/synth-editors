// The keyboard controller on KEYS IN (docs/tb3-phase4-design.md), wired to the TB-3 and the editor's targets.
import { useEffect, useMemo, useRef } from "react";
import { findInputByName } from "@synth-editors/midi";
import { getRaw } from "../core/patch";
import type { Patch } from "../core/patch";
import { paramById } from "../core/params";
import { paramOf, tb3CcOf } from "./ccTargets";
import type { CcTarget } from "./ccTargets";
import { launchkeyHandler } from "./launchkeyControl";
import type { TargetValue } from "./launchkeyControl";
import type { CcLearn } from "./useCcLearn";
import type { Tb3Midi } from "./useTb3Midi";

// What the targets read and write in the editor.
export interface CcTargetsCtx {
  patch: Patch | null;
  setParam: (id: string, raw: number) => void;
  tuning: number;
  setTuning: (v: number) => void;
  morph: number | null; // the morph amount, null with no target
  setMorph: (v: number) => void;
}

const UNKNOWN: TargetValue = { current: null, max: 127 };

function readTarget(c: CcTargetsCtx, t: CcTarget): TargetValue {
  const id = paramOf(t);
  if (id) {
    const def = paramById(id);
    return { current: c.patch ? getRaw(c.patch, def) : null, max: def.max };
  }
  if (t === "tuning") return { current: c.tuning, max: 127 };
  if (t === "morph") return { current: c.morph, max: 127 };
  return UNKNOWN;
}

function writeTarget(c: CcTargetsCtx, t: CcTarget, value: number, sendCc: (cc: number, v: number) => void) {
  const id = paramOf(t);
  const cc = tb3CcOf(t);
  if (id) c.patch && c.setParam(id, value);
  else if (t === "tuning") c.setTuning(value);
  else if (t === "morph") c.morph !== null && c.setMorph(value);
  else if (cc !== null) sendCc(cc, value);
}

export function useLaunchkey(midi: Tb3Midi, learn: CcLearn, ctx: CcTargetsCtx) {
  const { access, ports, inputs } = midi;
  // `inputs` changes on (re)connect.
  const input = useMemo(() => access && findInputByName(access, ports.keysIn), [access, ports.keysIn, inputs]);
  const latest = useRef({ midi, learn, ctx });
  latest.current = { midi, learn, ctx };

  useEffect(() => {
    if (!input) return;
    const l = () => latest.current;
    const send = (msg: number[]) => l().midi.tb3.send(msg);
    const handle = launchkeyHandler({
      tb3Channel: () => l().midi.channel,
      send,
      assignments: () => l().learn.assignments,
      listening: () => l().learn.listening(),
      learned: (channel, cc) => l().learn.learned(channel, cc),
      read: (t) => readTarget(l().ctx, t),
      write: (t, v) => writeTarget(l().ctx, t, v, (cc, value) => send([0xb0 | (l().midi.channel - 1), cc, value])),
    });
    const onMessage = (e: Event) => {
      const data = (e as MIDIMessageEvent).data;
      if (data) handle(data);
    };
    input.addEventListener("midimessage", onMessage);
    return () => input.removeEventListener("midimessage", onMessage);
  }, [input]);
}
