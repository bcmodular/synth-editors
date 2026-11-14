// Generates src/core/efxTable.ts and src/core/waveNames.ts from docs/jv2080-sysex-map.md (§7 EFX types, §8 waves).
// The map is the source of truth: re-run this after correcting it (eg. with measurements from the JV).
//   node apps/jv2080/scripts/genTables.mjs
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const map = readFileSync(new URL("docs/jv2080-sysex-map.md", root), "utf8");
const out = (file, text) => writeFileSync(new URL(`apps/jv2080/src/core/${file}`, root), text);
const HEADER = "// Generated from docs/jv2080-sysex-map.md by apps/jv2080/scripts/genTables.mjs. Don't edit by hand.\n";

const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
const section = (from, to) => map.slice(map.indexOf(from), to ? map.indexOf(to) : undefined);

// --- EFX ---

const F17 = "200 250 315 400 500 630 800 1000 1250 1600 2000 2500 3150 4000 5000 6300 8000".split(" ").map((f) => `${f} Hz`);
const F18 = [...F17, "BYPASS"];

function enumLabels(range, count) {
  if (range.startsWith("*F17*")) return F17;
  if (range.startsWith("*F18*")) return F18;
  const parts = range.split(", ");
  const unit = / (Hz|dB)$/.exec(parts.at(-1))?.[1];
  const labels = unit ? parts.map((p) => `${p.replace(` ${unit}`, "")} ${unit}`) : parts;
  if (labels.length !== count) throw new Error(`enum "${range}": ${labels.length} labels, expected ${count}`);
  return labels;
}

function kindOf(range, rawToDisplay) {
  if (rawToDisplay === "raw = display") return { kind: "raw" };
  const enumMatch = /enum, (\d+) values/.exec(rawToDisplay);
  if (enumMatch) return { kind: "enum", labels: enumLabels(range, Number(enumMatch[1])) };
  return { kind: "unknown" };
}

function parseEfx() {
  const types = [];
  const blocks = section("## 7. EFX types", "## 8. Internal").split(/^#### /m).slice(1);
  for (const block of blocks) {
    const title = /^\d+ (.+?) — raw EFX Type (\d+)/.exec(block);
    if (!title) throw new Error(`EFX heading: ${block.slice(0, 60)}`);
    const rows = block.split("\n").filter((l) => /^\| \d+ \|/.test(l)).map(cells);
    const params = rows.map(([n, , name, full, range, raw], i) => {
      if (Number(n) !== i + 1) throw new Error(`${title[1]}: param ${n} out of order`);
      return { name, full, range, ...kindOf(range, raw) };
    });
    types.push({ name: title[1], params });
  }
  if (types.length !== 40) throw new Error(`expected 40 EFX types, found ${types.length}`);
  return types;
}

const efx = parseEfx();
// One type per block, one parameter per line, so the generated file diffs well when the map changes.
const efxTypeSource = (t, i) =>
  `  // ${i + 1}\n  { name: ${JSON.stringify(t.name)}, params: [\n${t.params.map((p) => `    ${JSON.stringify(p)},`).join("\n")}\n  ] },`;
out(
  "efxTable.ts",
  `${HEADER}// The 40 EFX types and their parameters (EFX Parameter 1…n, Common offsets 13…). "unknown" = the manual gives only
// a display range, not how raw 0–127 maps to it.
import type { EfxTypeDef } from "./efx";

export const EFX_TABLE: readonly EfxTypeDef[] = [
${efx.map(efxTypeSource).join("\n")}
];
`,
);

// --- Waves ---

function parseWaves(heading, count) {
  const rows = section(heading).split("\n####")[0].split("\n").filter((l) => /^\| \d{3} \|/.test(l));
  const names = [];
  for (const row of rows) {
    const c = cells(row);
    for (let i = 0; i + 2 < c.length; i += 4) {
      if (!c[i]) continue;
      const raw = Number(c[i + 1]);
      names[raw] = c[i + 2].replace(/\s*\\\*$/, "");
    }
  }
  if (names.length !== count || names.includes(undefined)) throw new Error(`${heading}: expected ${count} waves`);
  return names;
}

const intA = parseWaves("#### INT-A", 255);
const intB = parseWaves("#### INT-B", 193);
out(
  "waveNames.ts",
  `${HEADER}// Internal waveform names by raw Wave Number (display number = raw + 1). The one-shot marks are dropped.

export const INT_A_WAVES: readonly string[] = ${JSON.stringify(intA)};

export const INT_B_WAVES: readonly string[] = ${JSON.stringify(intB)};
`,
);

console.log(`EFX: ${efx.length} types, ${efx.reduce((n, t) => n + t.params.length, 0)} params; waves: ${intA.length} + ${intB.length}`);
