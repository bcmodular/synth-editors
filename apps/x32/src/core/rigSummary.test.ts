import { describe, expect, it } from "vitest";
import { studioDesk, studioShared } from "../../e2e/studio";
import type { DeskValue } from "./cache";
import { rigSummary } from "./rigSummary";

const values = new Map([...studioDesk()].map(([a, arg]) => [a, arg.value as DeskValue]));
const get = (a: string) => values.get(a);

describe("rigSummary", () => {
  it("lists sources, destinations, the shared bus and FX slots", () => {
    const text = rigSummary({ get, shared: studioShared });
    expect(text).toContain("- TB-3: ch 7-8 (stereo), icon Synthesizer 1; sends to: Reverb -2 dB (post-fader)");
    expect(text).toContain("- King Rat: bus 9 → Aux out 6; the device returns on ch 4");
    expect(text).toContain("- Sampler: bus 11-12 → XLR out 1-2; shared: it goes to the SP-404 Mk2 now, and can go to SP-404 Mk2, Koala, P-6");
    expect(text).toContain("- FX 1: Hall Reverb (HALL), send effect fed by Reverb (protected: its type stays); Pre Delay 100 ms, Decay 1 s");
    expect(text).toContain("- FX 4: Hall Reverb (HALL), free (fed by FX 4, but nothing is sent there)");
  });

  it("narrows to the names asked for, a shared bus's targets included", () => {
    const text = rigSummary({ get, shared: studioShared, names: ["s-1", "P-6"] });
    expect(text).toContain("- S-1:");
    expect(text).toContain("- P-6:");
    expect(text).toContain("- Sampler:");
    expect(text).not.toContain("TB-3");
    expect(text).not.toContain("FX slots");
  });
});
