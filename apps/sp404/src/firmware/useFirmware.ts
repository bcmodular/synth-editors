// The firmware check on connect (core/firmware.ts): asks the SP-404 who it is over MIDI when its ports appear, and
// says whether its firmware is the one the serial protocol was worked out on. A version the user accepts is
// remembered, so the warning shows once per version.

import { useCallback, useEffect, useState } from "react";
import { checkFirmware, identityRequest, parseIdentity, versionOf, type FirmwareCheck } from "../core/firmware";
import { usePortsNamed, type PortMatch } from "../midi/usePortsNamed";

const SP404: PortMatch = { name: /SP-404/i };
const ACCEPTED_KEY = "sp404.firmwareAccepted";
const REPLY_MS = 2000;

export type FirmwareState = FirmwareCheck | { kind: "asking" } | { kind: "silent" } | { kind: "off" };

function readAccepted(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(ACCEPTED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Ask once per connection; the reply (or none within a moment) settles the version.
function useIdentity(input: MIDIInput | undefined, output: MIDIOutput | undefined) {
  const [version, setVersion] = useState<string | null | undefined>(); // undefined: asking; null: no reply
  useEffect(() => {
    setVersion(undefined);
    if (!input || !output) return;
    const onMessage = (e: MIDIMessageEvent) => {
      const id = e.data ? parseIdentity(e.data) : undefined;
      if (id) setVersion(versionOf(id.revision));
    };
    input.addEventListener("midimessage", onMessage);
    output.send(identityRequest());
    const timer = setTimeout(() => setVersion((v) => (v === undefined ? null : v)), REPLY_MS);
    return () => {
      clearTimeout(timer);
      input.removeEventListener("midimessage", onMessage);
    };
  }, [input, output]);
  return version;
}

export function useFirmware() {
  const { input, output } = usePortsNamed(SP404);
  const version = useIdentity(input, output);
  const [accepted, setAccepted] = useState(readAccepted);
  const accept = useCallback((v: string) => setAccepted((was) => {
    const next = was.includes(v) ? was : [...was, v];
    localStorage.setItem(ACCEPTED_KEY, JSON.stringify(next));
    return next;
  }), []);
  const state: FirmwareState = !input || !output ? { kind: "off" }
    : version === undefined ? { kind: "asking" }
    : version === null ? { kind: "silent" }
    : checkFirmware(version, accepted);
  return { state, accept };
}

export type Firmware = ReturnType<typeof useFirmware>;
