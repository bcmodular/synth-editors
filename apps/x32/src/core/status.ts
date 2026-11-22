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

// Why the app can't reach the desk, from the socket's error code. On macOS, a send refused with EHOSTUNREACH or EPERM
// while the desk answers a broadcast usually means Local Network access is off for the app that started this one.
const SOCKET_HINTS: Record<string, string> = {
  EHOSTUNREACH: "macOS refused the connection. Turn on Local Network access (System Settings → Privacy & Security → "
    + "Local Network) for the app this was started from, such as your terminal, then restart it.",
  ENETUNREACH: "This computer isn't on a network that reaches the desk.",
  EADDRNOTAVAIL: "This computer has no network address that reaches the desk.",
};
SOCKET_HINTS.EPERM = SOCKET_HINTS.EHOSTUNREACH!;

export function socketProblem(code: string): string {
  return SOCKET_HINTS[code] ?? `The network refused the connection (${code}).`;
}
