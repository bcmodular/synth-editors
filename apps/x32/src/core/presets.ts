// FX presets: a catalogue describing the presets in the desk's FX library (what each sounds like and what it suits),
// matched to the library by name, and searched by the chat. The catalogue file stays out of the repo (it's derived
// from third-party preset files): the main process reads it from fixtures/local/ or the data folder.

import { FX_SEND_SLOTS } from "./addresses";
import { sameName } from "./names";

export interface Preset {
  name: string; // as in the desk's library
  type: string; // "Hall Reverb"
  code: string; // "HALL": the type it loads as
  slots: "1-4" | "1-8"; // the slots it can load into
  description: string;
  tags: string[];
  source?: string; // what it was saved for: "Insert", "Mix bus 1/2"
  confidence?: string;
}

// A catalogue entry with its place in the desk's library (/-libs/fx/NNN, NNN = index + 1), or null if it isn't there.
export interface LibPreset extends Preset {
  index: number | null;
}

// Optional text fields, kept only when present.
const optional = (p: Partial<Preset>) =>
  Object.fromEntries((["source", "confidence"] as const).filter((k) => p[k]).map((k) => [k, String(p[k])]));

function toPreset(p: Preset): Preset {
  return {
    name: p.name, type: String(p.type ?? p.code), code: p.code, slots: p.slots === "1-8" ? "1-8" : "1-4",
    description: String(p.description ?? ""), tags: Array.isArray(p.tags) ? p.tags.map(String) : [], ...optional(p),
  };
}

const isPreset = (p: Partial<Preset> | null): p is Preset => typeof p?.name === "string" && typeof p.code === "string";

export function parsePresets(json: unknown): Preset[] {
  const list = (json as { presets?: unknown })?.presets;
  return Array.isArray(list) ? list.filter(isPreset).map(toPreset) : [];
}

// The catalogue matched to the library's names (index i is /-libs/fx/(i+1)).
export function inLibrary(presets: Preset[], libraryNames: string[]): LibPreset[] {
  return presets.map((p) => {
    const i = libraryNames.findIndex((n) => sameName(n, p.name));
    return { ...p, index: i < 0 ? null : i };
  });
}

export const canLoadInto = (p: Preset, slot: number): boolean => slot <= FX_SEND_SLOTS || p.slots === "1-8";

const REVERBS = new Set(["HALL", "AMBI", "RPLT", "ROOM", "CHAM", "PLAT", "VREV", "VRM", "GATE", "RVRS"]);
const DELAYS = new Set(["DLY", "3TAP", "4TAP", "MODD"]);
const COMBOS: Record<string, string[]> = { "D/RV": ["delay", "reverb"], "CR/R": ["modulation", "reverb"], "FL/R": ["modulation", "reverb"], "D/CR": ["delay", "modulation"], "D/FL": ["delay", "modulation"] };
const MODULATION = new Set(["CRS", "FLNG", "PHAS", "DIMC", "FILT", "ROTA", "PAN", "SUB", "PIT", "PIT2"]);

export interface Coded {
  code: string; // an effect type's code: "HALL"
}

// What kind of effect a type is: a send effect slot only takes a preset of a kind it already is.
export function families({ code }: Coded): string[] {
  if (COMBOS[code]) return COMBOS[code]!;
  if (REVERBS.has(code)) return ["reverb"];
  if (DELAYS.has(code)) return ["delay"];
  return MODULATION.has(code) ? ["modulation"] : ["other"];
}

export const sameFamily = (a: Coded, b: Coded): boolean => families(a).some((f) => families(b).includes(f));

// Presets matching the words asked for, best first: name, tags and description, every word scored.
export function searchPresets(presets: LibPreset[], query: string, limit = 8): LibPreset[] {
  const words = query.toLowerCase().split(/[^a-z0-9/#'-]+/).filter((w) => w.length > 1);
  const score = (p: LibPreset) => words.reduce((n, w) => {
    const inName = p.name.toLowerCase().includes(w) || p.type.toLowerCase().includes(w) ? 3 : 0;
    const inTags = p.tags.some((t) => t.includes(w)) ? 2 : 0;
    return n + inName + inTags + (p.description.toLowerCase().includes(w) ? 1 : 0);
  }, 0);
  return presets
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0 || !words.length)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}

// The search's answer for the model.
export function presetsText(presets: LibPreset[], query: string): string {
  if (!presets.length) return "There's no preset catalogue (fx-presets.json), so presets can't be searched.";
  const found = searchPresets(presets, query, query.trim() ? 8 : presets.length);
  return found.length ? found.map(presetLine).join("\n") : `No preset matches "${query}".`;
}

// A preset as a line for the model.
export const presetLine = (p: LibPreset): string =>
  `- ${p.name} (${p.type}, ${p.code}; FX ${p.slots}${p.source ? `; saved for ${p.source}` : ""}${p.index === null ? "; NOT in the desk's library" : ""}): ${p.description} Tags: ${p.tags.join(", ")}.`;
