// The live trace over the desk connection: subscribe to the meter banks the path needs, keep the peaks for a few
// seconds while the source plays, then say where the signal stops (core/trace.ts).

import { bankAddress, METERS, Peaks } from "../core/meters";
import { str } from "../core/osc";
import type { PathRequest } from "../core/pathCheck";
import type { PlanContext } from "../core/planner";
import { banksOf, traceStages, traceText, type Stage } from "../core/trace";
import type { Desk } from "./useDesk";

const MIN_S = 1;
const MAX_S = 8; // a subscription lasts 10 s, so one is enough
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stagesOrReason(ctx: PlanContext, req: PathRequest): Stage[] | string {
  try {
    return traceStages(ctx, req);
  } catch (e) {
    return (e as Error).message;
  }
}

export async function traceNow(desk: Desk, ctx: PlanContext, req: PathRequest & { seconds: number }): Promise<{ text: string; kind: string }> {
  const client = desk.client;
  if (!client || desk.link !== "connected") return { text: "The desk isn't connected.", kind: "offline" };
  const stages = stagesOrReason(ctx, req);
  if (typeof stages === "string") return { text: stages, kind: "refused" };
  const peaks = new Peaks();
  const off = client.onMessage((m) => peaks.take(m));
  for (const bank of banksOf(stages)) client.command(METERS, [str(bankAddress(bank))]);
  await pause(Math.min(MAX_S, Math.max(MIN_S, req.seconds)) * 1000);
  off();
  return { text: traceText(ctx, req, stages, peaks), kind: "state" };
}
