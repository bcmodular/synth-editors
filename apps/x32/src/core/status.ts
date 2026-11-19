// What the app makes of the desk's /info answer: is it the desk and firmware the plan was written for?

import type { DeskInfo } from "./client";

export const EXPECTED_MODEL = "X32RACK";
export const EXPECTED_FIRMWARE_MAJOR = 4; // user routing, which inserts on aux inputs may need

export function deskProblems(info: DeskInfo): string[] {
  const problems: string[] = [];
  if (info.model !== EXPECTED_MODEL) problems.push(`This is an ${info.model || "unknown desk"}, not an X32 Rack`);
  const major = Number.parseInt(info.firmware, 10);
  if (major !== EXPECTED_FIRMWARE_MAJOR) {
    problems.push(`Firmware ${info.firmware || "unknown"}: the app was written for 4.x`);
  }
  return problems;
}
