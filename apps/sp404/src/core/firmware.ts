// The SP-404's firmware, checked on connect (docs/sp404-design.md › Open risks): the USB serial protocol was worked
// out on firmware 5.52 and may change in another. The serial protocol has no version query, so the app asks over
// MIDI with the Universal Identity Request, which Roland devices answer with their software revision. How the
// SP-404 MK2 lays its revision out isn't documented: the version is read as the digits after any leading zero
// bytes (00 05 05 02 → 5.52), to be checked against a real reply.

export const TESTED_VERSION = "5.52";

const ROLAND = 0x41;

export const identityRequest = (): number[] => [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];

export interface Identity {
  family: number;
  model: number;
  revision: number[]; // four bytes
}

const word = (lsb: number, msb: number) => lsb | (msb << 7);

// A Roland Identity Reply: F0 7E <device> 06 02 41 <family ×2> <model ×2> <revision ×4> F7.
export function parseIdentity(data: ArrayLike<number>): Identity | undefined {
  const d = Array.from(data);
  const reply = d.length === 15 && d[0] === 0xf0 && d[1] === 0x7e && d[3] === 0x06 && d[4] === 0x02;
  if (!reply || d[5] !== ROLAND) return undefined;
  return { family: word(d[6]!, d[7]!), model: word(d[8]!, d[9]!), revision: d.slice(10, 14) };
}

// The revision as a version: single digits after the leading zeros read as "5.52"; anything else is shown dotted.
export function versionOf(revision: readonly number[]): string {
  const first = revision.findIndex((b) => b !== 0);
  if (first < 0) return "0";
  const rest = revision.slice(first);
  if (rest.every((b) => b < 10)) return `${rest[0]}.${rest.slice(1).join("") || "0"}`;
  return rest.join(".");
}

export type FirmwareCheck =
  | { kind: "tested"; version: string } // the version the serial notes were worked out on
  | { kind: "accepted"; version: string } // another version the user has said is fine
  | { kind: "untested"; version: string }; // warn

export function checkFirmware(version: string, accepted: readonly string[]): FirmwareCheck {
  if (version === TESTED_VERSION) return { kind: "tested", version };
  return accepted.includes(version) ? { kind: "accepted", version } : { kind: "untested", version };
}
