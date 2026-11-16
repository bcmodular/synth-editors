// The H12 over Web MIDI: finds its ports by name, finds which output answers SysEx and reads the hub (core/hub.ts).
// Runs again when the H12's ports come or go, and on demand. Read-only: nothing here writes a setting.

import { requestMidi } from "@synth-editors/midi";
import { useCallback, useEffect, useState } from "react";
import { readHub, type HubReport } from "../core/hub";
import { findSysexPort, type Lane, type Listen } from "../core/link";

const H12 = /H12MIDI/i;
const SETTLE_MS = 300; // the H12's sixteen ports appear one by one when it is plugged in

export type HubState =
  | { kind: "starting" }
  | { kind: "no-midi"; message: string }
  | { kind: "absent" } // no H12 ports
  | { kind: "probing" }
  | { kind: "silent"; tried: string[] } // H12 ports, but none answered
  | { kind: "ready"; report: HubReport };

const h12Ports = <T extends MIDIPort>(ports: Iterable<T>): T[] =>
  [...ports].filter((p) => H12.test(p.name ?? "") && p.state === "connected");

const portNames = (access: MIDIAccess) =>
  [...h12Ports(access.inputs.values()), ...h12Ports(access.outputs.values())].map((p) => `${p.type}:${p.name}`).sort().join("|");

const lanesOf = (access: MIDIAccess): Lane[] =>
  h12Ports(access.outputs.values()).map((o) => ({ name: o.name ?? o.id, send: (data) => o.send(data) }));

function listenerOf(access: MIDIAccess): Listen {
  return (onMessage) => {
    const inputs = h12Ports(access.inputs.values());
    const handlers = inputs.map((input) => {
      const handler = (e: MIDIMessageEvent) => e.data && onMessage(Array.from(e.data), input.name ?? input.id);
      input.addEventListener("midimessage", handler);
      return () => input.removeEventListener("midimessage", handler);
    });
    return () => handlers.forEach((remove) => remove());
  };
}

async function check(access: MIDIAccess, isCancelled: () => boolean): Promise<HubState> {
  const lanes = lanesOf(access);
  if (lanes.length === 0 || h12Ports(access.inputs.values()).length === 0) return { kind: "absent" };
  const listen = listenerOf(access);
  const probe = await findSysexPort(lanes, listen, isCancelled);
  if (probe.kind === "silent") return probe;
  return { kind: "ready", report: await readHub(probe.lane, probe.reply, listen) };
}

export function useHub() {
  const [state, setState] = useState<HubState>({ kind: "starting" });
  const [access, setAccess] = useState<MIDIAccess>();
  const [ports, setPorts] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unfollow = () => undefined as void;
    requestMidi().then((a) => {
      if (cancelled) return;
      const follow = () => {
        clearTimeout(timer);
        timer = setTimeout(() => setPorts(portNames(a)), SETTLE_MS);
      };
      a.addEventListener("statechange", follow);
      unfollow = () => a.removeEventListener("statechange", follow);
      setAccess(a);
      setPorts(portNames(a));
    }, (e: unknown) => setState({ kind: "no-midi", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unfollow();
    };
  }, []);

  useEffect(() => {
    if (!access) return;
    let cancelled = false;
    setState({ kind: "probing" });
    check(access, () => cancelled).then((s) => cancelled || setState(s));
    return () => {
      cancelled = true;
    };
  }, [access, ports, round]);

  const recheck = useCallback(() => setRound((r) => r + 1), []);
  return { state, recheck };
}
