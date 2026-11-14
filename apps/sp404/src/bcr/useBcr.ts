// The BCR2000 for the FX (docs/sp404-design.md › Controllers › BCR2000): its parameter encoders and morph amount
// drive the buses, and its LED rings follow the app.

import { useEffect, useMemo, useRef, useState } from "react";
import { MidiSender } from "../fx/midiSender";
import type { Fx } from "../fx/useFx";
import { BcrLink, ringsFor, type Rings } from "./bcrLink";
import type { BcrEvent } from "./bcrMap";
import { useBcrPorts } from "./bcrPorts";

function useRings(fx: Fx): Rings {
  const { buses, play } = fx;
  return useMemo(() => {
    const source = (bus: 1 | 2 | 3 | 4 | 5) => {
      const m = play.morphs[bus];
      return { ...buses[bus], morph: m?.slot === undefined ? undefined : m.amount };
    };
    return ringsFor({ 1: source(1), 2: source(2), 3: source(3), 4: source(4), 5: source(5) });
  }, [buses, play.morphs]);
}

type Param = Extract<BcrEvent, { kind: "param" }>;
type Morph = Extract<BcrEvent, { kind: "morph" }>;

function applyParam(fx: Fx, e: Param): boolean {
  const b = fx.buses[e.bus];
  if (!b.fxId || e.slot >= b.values.length) return false;
  fx.setValue(e.bus, e.slot, e.value);
  return true;
}

function applyMorph(fx: Fx, e: Morph): boolean {
  if (fx.play.morphs[e.bus]?.slot === undefined) return false;
  fx.play.setMorphAmount(e.bus, e.value / 127);
  return true;
}

// Act on an event if the bus can take it; false when it can't (the ring is then put back).
const apply = (fx: Fx, e: BcrEvent): boolean =>
  e.kind === "param" ? applyParam(fx, e) : e.kind === "morph" && applyMorph(fx, e);

// The link to the BCR's output, made again when the output changes, and sent every ring on connect.
function useLink(output: MIDIOutput | undefined, want: React.RefObject<Rings>): BcrLink | undefined {
  const [link, setLink] = useState<BcrLink>();
  useEffect(() => {
    if (!output) return void setLink(undefined);
    const sender = new MidiSender((m) => output.send(m));
    const next = new BcrLink((m) => sender.send(m));
    next.connect(want.current);
    setLink(next);
    return () => sender.stop();
  }, [output, want]);
  return link;
}

export function useBcr(fx: Fx): { name?: string } {
  const { input, output } = useBcrPorts();
  const rings = useRings(fx);
  const want = useRef(rings);
  want.current = rings;
  const latest = useRef(fx);
  latest.current = fx;
  const link = useLink(output, want);

  useEffect(() => link?.update(rings), [link, rings]);

  useEffect(() => {
    if (!input || !link) return;
    const onMessage = (m: MIDIMessageEvent) => {
      const e = m.data ? link.receive(m.data, want.current) : undefined;
      if (e && !apply(latest.current, e)) link.update(want.current);
    };
    input.addEventListener("midimessage", onMessage);
    return () => input.removeEventListener("midimessage", onMessage);
  }, [input, link]);

  return { name: output?.name ?? undefined };
}
