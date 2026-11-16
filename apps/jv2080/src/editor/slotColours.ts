// Slot row colours: the two rows of a set differ. They keep clear of green (the active slot), red (DELETE), white
// (GRAB) and amber (unsaved edits). After apps/tb3/src/editor/slotColours.ts.
import { SLOTS_PER_ROW } from "../core/patchSet";

export interface RowColour {
  screen: string;
}

export const ROW_COLOURS: readonly RowColour[] = [{ screen: "#4cc9f0" }, { screen: "#b483ff" }];

export const rowColour = (slot: number): RowColour => ROW_COLOURS[Math.floor(slot / SLOTS_PER_ROW) % ROW_COLOURS.length]!;
