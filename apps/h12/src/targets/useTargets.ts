// Target switching over the H12 link (core/switcher.ts, through settings/useWriter.ts): reads which target the H12
// is set to, switches to another, changes the pedal CC, turns the copy to the Mac (for the monitor) on and off, and
// puts back the H12's previous settings. Before the first write, the previous values of every setting a switch may
// change are kept (core/backup.ts), once.

import { useCallback, useState } from "react";
import { mapperFormatProblem } from "../core/status";
import {
  currentTarget, DEFAULT_PEDAL_CC, isOff, mappersWithoutInit, OFF_SETTINGS, parseTargets, pedalCcIn, SWITCH_SETTINGS,
  targetSettings, type Choice, type Target,
} from "../core/targets";
import list from "../targets.json";
import type { HubState } from "../hub/useHub";
import { useWriter, type Wording, type WriterSpec } from "../settings/useWriter";

export { summary, type Outcome } from "../settings/useWriter";

const PARSED = parseTargets(list);
const TARGETS = "targets" in PARSED ? PARSED.targets : [];
const LIST_PROBLEMS = "problems" in PARSED ? PARSED.problems : [];

// Nothing is written unless the firmware stores mappers the way the app writes them.
const SPEC: WriterSpec = { list: SWITCH_SETTINGS, backupKey: "h12.backup", guard: (hub) => mapperFormatProblem(hub.firmware) };

const switchWording = (name: string): Wording => ({ doing: `Switching to ${name}`, done: `Switched to ${name}`,
  stopped: `Stopped switching to ${name}`, unchanged: `Already on ${name}` });

const monitorWording = (on: boolean): Wording => {
  const what = `the copy to the Mac ${on ? "on" : "off"}`;
  return { doing: `Turning ${what}`, done: `Turned ${what}`, stopped: `Stopped turning ${what}`,
    unchanged: `The copy to the Mac is already ${on ? "on" : "off"}` };
};

const pedalWording = (cc: number): Wording => ({ doing: `Setting the pedal to CC ${cc}`,
  done: `Set the pedal to CC ${cc}`, stopped: `Stopped setting the pedal to CC ${cc}`,
  unchanged: `The pedal already sends CC ${cc}` });

const OFF_WORDING: Wording = { doing: "Turning the keys and the pedal off", done: "Turned the keys and the pedal off",
  stopped: "Stopped turning the keys and the pedal off", unchanged: "The keys and the pedal are already off" };

const nameOf = (c: Pick<Choice, "target" | "channel">) =>
  (c.target.channels ? `${c.target.name} ch ${c.channel}` : c.target.name);

type Apply = ReturnType<typeof useWriter>["apply"];

// What the panel can do: switch target (keeping the pedal CC and the copy to the Mac as they are), change the pedal
// CC, turn the copy on or off, or turn the keys and the pedal off. With no target set, the pedal CC is the one chosen
// here, or else mapper 23's, and waits for the next switch.
function useActions(apply: Apply, active: Choice | undefined, mapperCc: number | undefined) {
  const [chosenCc, setChosenCc] = useState<number>();
  const monitor = active?.monitor ?? false;
  const pedalCc = active?.pedalCc ?? chosenCc ?? mapperCc ?? DEFAULT_PEDAL_CC;
  const switchTo = useCallback((target: Target, channel = target.channel) =>
    apply(switchWording(nameOf({ target, channel })), () => targetSettings(target, { channel, pedalCc, monitor })),
  [apply, pedalCc, monitor]);
  const setMonitor = useCallback((on: boolean) => {
    if (active) void apply(monitorWording(on), () => targetSettings(active.target, { ...active, monitor: on }));
  }, [apply, active]);
  const setPedalCc = useCallback((cc: number) => {
    setChosenCc(cc);
    if (active) void apply(pedalWording(cc), () => targetSettings(active.target, { ...active, pedalCc: cc }));
  }, [apply, active]);
  const switchOff = useCallback(() => apply(OFF_WORDING, () => OFF_SETTINGS), [apply]);
  return { pedalCc, switchTo, setMonitor, setPedalCc, switchOff };
}

export function useTargets(hub: HubState, note: (text: string) => void = () => undefined) {
  const { current, apply, ...writer } = useWriter(hub, SPEC, note);
  const read = current
    ? { active: currentTarget(TARGETS, current), off: isOff(current), withoutInit: mappersWithoutInit(current) }
    : { active: undefined, off: false, withoutInit: [] };
  const actions = useActions(apply, read.active, current && pedalCcIn(current));
  return { targets: TARGETS, listProblems: LIST_PROBLEMS, ...read, ...writer, ...actions };
}

export type Targets = ReturnType<typeof useTargets>;
