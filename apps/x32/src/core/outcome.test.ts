import { describe, expect, it } from "vitest";
import { describeOutcome } from "./outcome";
import type { Plan } from "./planner";

const plan: Plan = {
  summary: "Send S-1 to Delay at 0 dB",
  confirm: "It switches sends or outputs off",
  changes: [{ param: { address: "/ch/09/mix/03/level", type: "f" }, value: 0.75, from: 0, what: "S-1 → bus 3 at 0 dB" }],
};

describe("describeOutcome", () => {
  it("says what happened", () => {
    expect(describeOutcome({ kind: "applied", plan, result: { written: 1, total: 1, mismatches: [] } })).toBe(
      "Done: Send S-1 to Delay at 0 dB (1 value, all read back).",
    );
    expect(describeOutcome({ kind: "waiting", plan })).toBe(
      "Waiting for you to confirm: Send S-1 to Delay at 0 dB. It switches sends or outputs off.",
    );
    expect(describeOutcome({ kind: "mismatch", plan, mismatch: { change: plan.changes[0]!, got: 0 } })).toBe(
      "Stopped: S-1 → bus 3 at 0 dB reads back as -∞, not 0 dB.",
    );
    expect(describeOutcome({ kind: "offline", plan })).toMatch(/isn't reachable/);
  });
});
