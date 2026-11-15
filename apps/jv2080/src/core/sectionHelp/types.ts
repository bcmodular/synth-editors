// Help for a section of the editor (a tone's pitch, filter, amp or LFOs; the chorus, reverb or patch settings):
// what it does, a row for each control or group of controls, tips, and its signal flow. The words are ours; the
// facts come from the JV-2080 manual (pp. 25–27, 53–55, 70–89).

import type { Flow } from "../efxHelp/flow";

export interface SectionRow {
  label: string;
  ids: readonly string[]; // the patch parameters it stands for (core/params ids); their values are shown, LFO1 / LFO2
  text: string;
  noValue?: boolean; // a group (an envelope): no single value to show
}

export interface SectionHelp {
  title: string;
  summary: string;
  rows: readonly SectionRow[];
  notes: readonly string[];
  flow: Flow;
  tags?: Readonly<Record<string, string>>; // short names for values shown in the flow ("Depth", "FB")
  units?: Readonly<Record<string, string>>; // units after values shown in the flow (" st", " ¢")
}
