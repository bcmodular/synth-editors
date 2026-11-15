// A section's help (core/sectionHelp) as a help panel's content, read live from the patch (for `tone`, for a
// tone's sections): each row's value and range, and the values its flow draws.

import type { EfxParamDef } from "../../core/efx";
import type { FlowGet, FlowValue } from "../../core/efxHelp";
import { getParam, type Patch } from "../../core/patch";
import type { ParamDef } from "../../core/params";
import { clampParam, param } from "../../core/paramValue";
import type { SectionHelp } from "../../core/sectionHelp";
import { useEditor } from "../EditorContext";
import type { HelpContent, HelpRow } from "./HelpPanel";

// A parameter's range as the panel shows it: a short list in full, a long one or a number range end to end.
function rangeOf(def: ParamDef): string {
  const labels = def.labels;
  if (labels && labels.length <= 6) return labels.join(", ");
  if (labels) return `${labels[0]}…${labels[labels.length - 1]}`;
  return `${def.display(def.min)}…${def.display(def.max)}`;
}

// A patch parameter as a flow reads it, described the way the EFX parameters are (centred ones as signed amounts).
function flowValue(def: ParamDef, value: number, name: string): FlowValue {
  const centred = def.center !== undefined;
  const p: EfxParamDef = {
    slot: 0, name, full: def.name, range: rangeOf(def), max: def.max - def.min,
    kind: centred ? "linear" : "display", signed: centred, first: def.min - (def.center ?? def.min), step: 1,
  };
  return { p, raw: value - def.min, text: def.display(value) };
}

function readValue(patch: Patch | null, def: ParamDef, tone: number): number {
  return patch ? clampParam(def, getParam(patch, def, tone)) : def.min;
}

const ALL_TONES = [0, 1, 2, 3];

export function sectionContent(help: SectionHelp, patch: Patch | null, tone: number): HelpContent {
  const valueOf = (id: string) => readValue(patch, param(id), tone);
  const get: FlowGet = (id) => {
    const v = flowValue(param(id), valueOf(id), help.tags?.[id] ?? param(id).name);
    return { ...v, text: v.text + (help.units?.[id] ?? "") };
  };
  const rows: HelpRow[] = help.rows.map((r) => {
    const def = param(r.ids[0]!);
    const tones = r.perTone ? ALL_TONES : [tone];
    const value = r.ids.flatMap((id) => tones.map((t) => param(id).display(readValue(patch, param(id), t)))).join(" / ");
    return { label: r.label, ids: r.ids, text: r.text, value: r.noValue ? undefined : value, range: r.noValue ? undefined : rangeOf(def) };
  });
  return { title: help.title, summary: help.summary, rows, notes: help.notes, flow: help.flow, get };
}

// A hook for a help panel: the section's content, following the patch.
export function sectionContentHook(help: SectionHelp, tone = 0): () => HelpContent {
  return () => sectionContent(help, useEditor().patch, tone);
}
