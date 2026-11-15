// Help for the editor's sections (the (i) in each header): what a section does, a line per parameter (or group of
// parameters, like an envelope), and tips. Written for this editor from Roland's TB-3 Owner's Manual and Dope Robot's
// unofficial TB-3 guides (doperobot.com/tb3.html); see docs/tb3-help.md.

import type { VoiceSection } from "./voice";

export interface HelpRow {
  label: string;
  ids: readonly string[]; // the parameters it describes (ParamDef ids, or efx:<offset> in an EFX section)
  text: string;
}

export interface SectionHelp {
  title: string;
  summary: string;
  rows: readonly HelpRow[];
  notes: readonly string[];
  voice?: VoiceSection; // its place in the voice's signal flow, highlighted there
}

// An EFX type's help: its summary, a line per slot (by the slot's name), its mode buttons, and tips.
export interface EfxTypeHelp {
  summary: string;
  params: Readonly<Record<string, string>>;
  modes?: string;
  notes?: readonly string[];
}
