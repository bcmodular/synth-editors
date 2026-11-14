// The JV-2080's patch banks (CC 0 / CC 32, then program change 0–127 = patch 1–128). Manual p.184.

export interface Bank {
  name: string;
  msb: number;
  lsb: number;
}

export const BANKS: readonly Bank[] = [
  { name: "USER", msb: 80, lsb: 0 },
  { name: "PR-A", msb: 81, lsb: 0 },
  { name: "PR-B", msb: 81, lsb: 1 },
  { name: "PR-C", msb: 81, lsb: 2 },
  { name: "GM", msb: 81, lsb: 3 },
  { name: "PR-E", msb: 81, lsb: 4 },
];

export const PATCHES_PER_BANK = 128;

// Bank select and program change on a channel (0–15) for patch 1–128.
export function programChange(bank: Bank, patch: number, channel: number): number[][] {
  return [
    [0xb0 | channel, 0, bank.msb],
    [0xb0 | channel, 32, bank.lsb],
    [0xc0 | channel, patch - 1],
  ];
}

export const patchLabel = (bank: Bank, patch: number) => `${bank.name} ${String(patch).padStart(3, "0")}`;
