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

// Stops the build with a message when the map isn't in the expected shape.
function check(ok, message) {
  if (!ok) throw new Error(message);
}

function match(re, text, what) {
  const m = re.exec(text);
  check(m, `${what}: "${text}"`);
  return m;
}

// --- EFX ---

const F17 = "200 250 315 400 500 630 800 1000 1250 1600 2000 2500 3150 4000 5000 6300 8000"
  .split(" ").map((f) => `${f} Hz`);
const SHARED_LISTS = { "*F17*": F17, "*F18*": [...F17, "BYPASS"] };

function enumLabels(range, count) {
  const parts = range.split(", ");
  const unit = / (Hz|dB)$/.exec(parts.at(-1))?.[1];
  const labels = SHARED_LISTS[range.split(" ")[0]] ?? parts.map((p) => (unit ? `${p.replace(` ${unit}`, "")} ${unit}` : p));
  check(labels.length === count, `enum "${range}": ${labels.length} labels, expected ${count}`);
  return labels;
}

// Linear ranges: "-15…+15 dB", "0–180 degree", "5–500 ms". Units as the editor shows them.
const UNITS = { dB: " dB", "%": "%", ms: " ms", degree: "°", semitone: " st", cent: " cent" };

function linear(range, max) {
  const [, from, to, unit] = match(/^(-?[\d.]+)[…–]\+?(-?[\d.]+) ?(\S*)/, range, "linear range");
  const first = Number(from);
  return { first, step: (Number(to) - first) / max, unit: UNITS[unit] ?? "", signed: first < 0 };
}

function balanceSides(range) {
  const [, left, right] = match(/^([A-Z]+)100:0([A-Z]+)/, range, "balance range");
  return { left, right };
}

// The Raw column's mapping word → the value description efx.ts uses.
const VALUES = {
  "= display": () => ({ kind: "display" }),
  list: (range, max) => ({ kind: "list", labels: enumLabels(range, max + 1) }),
  linear: (range, max) => ({ kind: "linear", ...linear(range, max) }),
  pan: () => ({ kind: "pan" }),
  balance: (range) => ({ kind: "balance", ...balanceSides(range) }),
  "display values not yet known": () => ({ kind: "unknown" }),
};

// The Raw column: "0–N = display", "0–N list", "0–N linear", "0–N pan…", "0–N balance", "0–N, display values…".
function valuesOf(range, raw) {
  const [, top, mapping] = match(/^0–(\d+),? (= display|list|linear|pan|balance|display values not yet known)/, raw, "raw column");
  const max = Number(top);
  const values = VALUES[mapping](range, max);
  return { kind: values.kind, max, ...values };
}

function parseEfxParam(type, [slot, off, name, full, range, raw]) {
  check(Number(off) === 12 + Number(slot), `${type} ${name}: slot ${slot} at offset ${off}`);
  return { slot: Number(slot), name, full, range, ...valuesOf(range, raw) };
}

function parseEfx() {
  const blocks = section("## 7. EFX types", "## 8. Internal").split(/^#### /m).slice(1);
  const types = blocks.map((block) => {
    const [, name] = match(/^\d+ (.+?) — raw EFX Type \d+/, block.slice(0, 120), "EFX heading");
    const rows = block.split("\n").filter((l) => /^\| \d+ \|/.test(l)).map(cells);
    return { name, params: rows.map((row) => parseEfxParam(name, row)) };
  });
  check(types.length === 40, `expected 40 EFX types, found ${types.length}`);
  return types;
}

const efx = parseEfx();
// One type per block, one parameter per line, so the generated file diffs well when the map changes.
const efxParamLines = (t) => t.params.map((p) => `    ${JSON.stringify(p)},`).join("\n");
const efxTypeSource = (t, i) => `  // ${i + 1}\n  { name: ${JSON.stringify(t.name)}, params: [\n${efxParamLines(t)}\n  ] },`;
out(
  "efxTable.ts",
  `${HEADER}// The 40 EFX types and their parameters in slot order (EFX Parameter n = Common offset 12 + n). Wire order and raw
// ranges measured by tgoelles (github.com/tgoelles/jv2080-max-for-live); "unknown" = panel values not yet known.
import type { EfxTypeDef } from "./efx";

export const EFX_TABLE: readonly EfxTypeDef[] = [
${efx.map(efxTypeSource).join("\n")}
];
`,
);

// --- Waves ---

// Each table row holds up to three "No. | SysEx | Name" groups, separated by an empty column.
function rowWaves(row) {
  const c = cells(row);
  return [0, 4, 8].filter((i) => c[i]).map((i) => [Number(c[i + 1]), c[i + 2].replace(/\s*\\\*$/, "")]);
}

function parseWaves(heading, count) {
  const rows = section(heading).split("\n####")[0].split("\n").filter((l) => /^\| \d{3} \|/.test(l));
  const names = [];
  for (const [raw, name] of rows.flatMap(rowWaves)) names[raw] = name;
  check(names.length === count && !names.includes(undefined), `${heading}: expected ${count} waves`);
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

const paramCount = efx.reduce((n, t) => n + t.params.length, 0);
console.log(`EFX: ${efx.length} types, ${paramCount} params; waves: ${intA.length} + ${intB.length}`);
