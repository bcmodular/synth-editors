// Bank names and colours for the desk.

import { PADS_PER_BANK } from "../core/padNotes";

export const BANK_LETTERS = "ABCDEFGHIJ";

// The bank colours on the desk, A–E repeated for F–J (as the SP-404 shows two pages of five banks).
const COLOURS = ["#7fc4ea", "#e6c27a", "#c9a3e6", "#8fdcc4", "#f29b9b"];

export const bankOf = (pad: number): number => Math.floor(pad / PADS_PER_BANK);
export const bankColour = (pad: number): string => COLOURS[bankOf(pad) % COLOURS.length]!;
export const bankColourOf = (bank: number): string => COLOURS[bank % COLOURS.length]!;
export const padLabel = (pad: number): string => `${BANK_LETTERS[bankOf(pad)]}${(pad % PADS_PER_BANK) + 1}`;
