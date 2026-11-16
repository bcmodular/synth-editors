// The H12 over Web MIDI: finds its ports by name, finds which output answers SysEx and reads the hub (core/hub.ts).
// Runs again when ports come or go, and on demand. Read-only; once ready it hands on the link (io) that target
// switching writes through.

import { useCallback, useEffect, useState } from "react";
import { readHub, type HubReport } from "../core/hub";
import { findSysexPort, type Lane, type Listen } from "../core/link";
import type { Io } from "../core/switcher";
import { portsNamed, type Midi } from "../midi/useMidi";

const H12 = /H12MIDI/i;

export type HubState =
  | { kind: "starting" }
  | { kind: "no-midi"; message: string }
  | { kind: "absent" } // no H12 ports
  | { kind: "probing" }
  | { kind: "silent"; tried: string[] } // H12 ports, but none answered
  | { kind: "ready"; report: HubReport; io: Io };

const lanesOf = (access: MIDIAccess): Lane[] =>
  portsNamed(access.outputs.values(), H12).map((o) => ({ name: o.name ?? o.id, send: (data) => o.send(data) }));

function listenerOf(access: MIDIAccess): Listen {
  return (onMessage) => {
    const handlers = portsNamed(access.inputs.values(), H12).map((input) => {
      const handler = (e: MIDIMessageEvent) => e.data && onMessage(Array.from(e.data), input.name ?? input.id);
      input.addEventListener("midimessage", handler);
      return () => input.removeEventListener("midimessage", handler);
    });
    return () => handlers.forEach((remove) => remove());
  };
}

async function check(access: MIDIAccess, isCancelled: () => boolean): Promise<HubState> {
  const lanes = lanesOf(access);
  if (lanes.length === 0 || portsNamed(access.inputs.values(), H12).length === 0) return { kind: "absent" };
  const listen = listenerOf(access);
  const probe = await findSysexPort(lanes, listen, isCancelled);
  if (probe.kind === "silent") return probe;
  return { kind: "ready", report: await readHub(probe.lane, probe.reply, listen), io: { lane: probe.lane, listen } };
}

// Re-checks only when the H12's own ports change, not when another device comes or goes.
const h12Ports = (ports: string) => ports.split("|").filter((p) => H12.test(p)).join("|");

export function useHub({ access, error, ports }: Midi) {
  const [state, setState] = useState<HubState>({ kind: "starting" });
  const [round, setRound] = useState(0);
  const mine = h12Ports(ports);

  useEffect(() => {
    if (error) setState({ kind: "no-midi", message: error });
  }, [error]);

  useEffect(() => {
    if (!access) return;
    let cancelled = false;
    setState({ kind: "probing" });
    check(access, () => cancelled).then((s) => cancelled || setState(s));
    return () => {
      cancelled = true;
    };
  }, [access, mine, round]);

  const recheck = useCallback(() => setRound((r) => r + 1), []);
  return { state, recheck };
}
