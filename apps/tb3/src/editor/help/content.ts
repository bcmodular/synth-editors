// Help (core/help) as a help panel's content, read live from the patch: each row's current value and range.
import { efxTypes } from "../../core/efx";
import type { EfxNum, EfxSlot, EfxType } from "../../core/efx";
import { EFX_GENERAL_NOTES, EFX_TYPE_HELP } from "../../core/help";
import type { SectionHelp } from "../../core/help";
import { getEfxRaw, getEfxType, getRaw } from "../../core/patch";
import type { Patch } from "../../core/patch";
import { paramById } from "../../core/params";
import type { ParamDef } from "../../core/params";
import { useEditor } from "../EditorContext";
import type { HelpContent, HelpRowView } from "./HelpPanel";

// A parameter's range as the panel shows it: OFF · ON for a switch, else its two ends.
const rangeOf = (def: ParamDef) => (def.kind === "switch" ? "OFF · ON" : `${def.display(0)} … ${def.display(def.max)}`);

export function sectionContent(help: SectionHelp, patch: Patch | null): HelpContent {
  const rows = help.rows.map((r): HelpRowView => {
    const defs = r.ids.map(paramById);
    const value = patch ? defs.map((d) => d.display(getRaw(patch, d))).join(" · ") : undefined;
    return { label: r.label, ids: r.ids, text: r.text, value, range: rangeOf(defs[0]!) };
  });
  return { title: help.title, summary: help.summary, rows, notes: help.notes, voice: help.voice };
}

// A hook for a help panel: the section's content, following the patch.
export const sectionHelp = (help: SectionHelp) => () => sectionContent(help, useEditor().patch);

// The id an EFX slot or mode group stands for in a help panel and its copy of the section.
export const efxId = (offset: number) => `efx:${offset}`;

function slotRow(s: EfxSlot, text: string, raw: number | undefined): HelpRowView {
  const value = raw === undefined ? undefined : s.display(raw);
  return { label: s.name, ids: [efxId(s.offset)], text, value, range: `${s.display(0)} … ${s.display(s.max)}` };
}

// The mode buttons (a segmented control above the drawing), as one row.
function modeRow(type: EfxType, text: string, raw: (offset: number) => number | undefined): HelpRowView | undefined {
  const buttons = type.buttons.filter((b) => b !== null);
  const first = buttons[0];
  if (!first) return undefined;
  const now = raw(first.offset);
  const value = now === undefined ? undefined : buttons.find((b) => (b.value ?? 0) === now)?.name;
  return { label: "MODE", ids: [efxId(first.offset)], text, value, range: buttons.map((b) => b.name).join(" · ") };
}

export function efxContent(efx: EfxNum, patch: Patch | null): HelpContent {
  const types = efxTypes(efx);
  const type = types[patch ? getEfxType(patch, efx) : 0] ?? types[0]!;
  const help = EFX_TYPE_HELP[type.name]!;
  const raw = (offset: number) => (patch ? getEfxRaw(patch, efx, offset) : undefined);
  const slots = type.slots.filter((s): s is EfxSlot => s !== null);
  const rows = slots.map((s) => slotRow(s, help.params[s.name] ?? "", raw(s.offset)));
  const modes = help.modes === undefined ? undefined : modeRow(type, help.modes, raw);
  return {
    title: `EFX${efx}: ${type.name}`,
    summary: help.summary,
    rows: modes ? [modes, ...rows] : rows,
    notes: [...(help.notes ?? []), ...EFX_GENERAL_NOTES],
    voice: efx === 1 ? "efx1" : "efx2",
  };
}

export const efxHelp = (efx: EfxNum) => () => efxContent(efx, useEditor().patch);
