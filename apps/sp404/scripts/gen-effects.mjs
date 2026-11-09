// Generator: TouchOSC Lua tables → apps/sp404/src/core/effects.ts and valueTables.ts.
// Usage: node apps/sp404/scripts/gen-effects.mjs ../touchosc-controllers/sp404-mk2/lua apps/sp404/src/core
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [luaDir, outDir] = process.argv.slice(2);
const info = readFileSync(join(luaDir, "controls_info.lua"), "utf8");
const mapper = readFileSync(join(luaDir, "control_mapper.lua"), "utf8");
const onValues = readFileSync(join(luaDir, "sp404_effect_on_values.lua"), "utf8");

const lower = (s) => {
  const n = s.replace(/^get/, "");
  if (/^\d+dB$/.test(n)) return "db" + n.slice(0, -2);
  return n.replace(/^[A-Z]+(?=[A-Z][a-z]|$)|^[A-Z]/, (c) => c.toLowerCase());
};

// ---- value tables from control_mapper.lua
const parseItems = (body) => {
  const items = [];
  const re = /"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(body))) items.push(m[1] ?? m[2] ?? Number(m[3]));
  return items;
};
const firstTable = (src) => {
  const m = /local\s+\w+\s*=\s*\{([\s\S]*?)\n\s*\}/.exec(src) ?? /local\s+\w+\s*=\s*\{([^}]*)\}/.exec(src);
  return m ? parseItems(m[1]) : null;
};
const tables = {};
const tapeSnippet = /local getTapeSpeedSnippet = \[\[([\s\S]*?)\]\]/.exec(mapper)[1];
tables.tapeSpeed = firstTable(tapeSnippet);
const scriptsStart = mapper.indexOf("local mappingScripts = {");
const scripts = mapper.slice(scriptsStart);
const entryRe = /\n  (get\w+) = ((?:\w+\.\.)?)\[\[([\s\S]*?)\]\],/g;
let e;
while ((e = entryRe.exec(scripts))) {
  const [, name, , body] = e;
  const t = firstTable(body);
  if (t) tables[lower(name)] = t;
}

// ---- effects from controls_info.lua and sp404_effect_on_values.lua
const names = parseItems(/local EFFECT_NAMES = \{([\s\S]*?)\n\}/.exec(onValues)[1]);
const onRows = [...(/local EFFECT_ON_MIDI_VALUES = \{([\s\S]*?)\n\}/.exec(onValues)[1]).matchAll(/\{(\d+), (\d+), (\d+)\}/g)]
  .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);

// Lua label functions that switch on SYNC: [display when sync off, display when sync on, unit off, unit on]
const SYNCED = {
  getZanZouTimes: ["zeroOneHundred", "delayTimes", "", ""],
  getSyncDelayTimes: ["tapeSpeed", "delayTimes", "ms", ""],
  getToGuRoRate: ["zeroOneHundred", "toGuRoRate", "", ""],
  getFilterRate: ["zeroOneHundred", "filterRate", "", ""],
  getFlangerRate: ["zeroOneHundred", "flangerRate", "", "bar"],
  getWahRate: ["zeroOneHundred", "wahRate", "", "bar"],
};
const unitOf = (fmt) => fmt.replace("%s", "").replace("%%", "%").trim();

const body = info.slice(0, info.indexOf("local childScript"));
const blocks = [...body.matchAll(/\[(\d+)\] = \{ -- ([^\n]*)\n([\s\S]*?)\n  \},/g)];
const effects = blocks.map((b) => {
  const id = Number(b[1]);
  const rows = [...b[3].matchAll(/\{(\d+), '(\w+)', (true|false), '([^']*)', '\w*', '(\w*)', '([^']*)', '(\w*)'(?:, '\w*', '(\w*)',\s*'(\{[^}]*\})'|, '', '', '')?(?:, '(true|false)')?/g)];
  const params = rows.map((r) => {
    const [, cc, fader, tuning, label, fn, fmt, , gridFn, starts, synced] = r;
    const p = { cc: Number(cc), key: fader.replace(/_fader$/, ""), label, tuning: tuning === "true" };
    const startList = starts ? JSON.parse(starts.replace("{", "[").replace("}", "]")) : [];
    if (synced === "true") {
      const s = SYNCED[fn] ?? (fn === "getZeroOneHundred" && gridFn === "getRate" ? ["zeroOneHundred", "rate", "", ""] : null);
      if (!s) throw new Error(`unknown synced ${fn}`);
      p.display = s[0];
      if (s[2]) p.unit = s[2];
      p.sync = { display: s[1], ...(startList.length ? { starts: startList } : {}), ...(s[3] ? { unit: s[3] } : {}) };
    } else {
      p.display = lower(fn);
      const u = unitOf(fmt);
      if (u) p.unit = u;
      if (startList.length) p.starts = startList;
    }
    if (p.key === "sync") p.isSync = true;
    return p;
  });
  const cc83 = onRows[id - 1];
  return { id, name: names[id - 1], cc83: { bus12: cc83[0], bus34: cc83[1], input: cc83[2] }, params };
});
if (effects.length !== 46) throw new Error(`parsed ${effects.length} effects`);

// Fixes to the Lua data. TimeCtrlDly H DAMP lists 16 steps for its 15 values (the list was copied from TIME);
// use the 15-step split that Sync Delay and Ko-Da-Ma use for the same values.
const findParam = (fxName, key) => effects.find((x) => x.name === fxName).params.find((p) => p.key === key);
findParam("TimeCtrlDly", "h_damp_f").starts = findParam("Sync Delay", "h_damp_f").starts;

const fmtVal = (v) => (typeof v === "number" ? String(v) : JSON.stringify(v));
const wrap = (items, indent) => {
  const lines = [];
  let line = indent;
  for (const s of items.map(fmtVal)) {
    if (line.length + s.length + 2 > 118) {
      lines.push(line.trimEnd());
      line = indent;
    }
    line += s + ", ";
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.join("\n");
};

const used = new Set();
for (const fx of effects) for (const p of fx.params) {
  used.add(p.display);
  if (p.sync) used.add(p.sync.display);
}
const FORMULAS = new Set(["zeroOneHundred", "zeroSixty", "zeroNinetyNine", "db24", "db48", "looperLength", "root"]);
let t = "// Generated from touchosc-controllers sp404-mk2/lua/control_mapper.lua (BC Modular). Lookup tables for the\n";
t += "// SP-404 MK2 FX display values; most are indexed by raw CC value, discrete ones by list position.\n\n";
t += "export const VALUE_TABLES = {\n";
for (const name of [...used].sort()) {
  if (FORMULAS.has(name)) continue;
  const tbl = tables[name];
  if (!tbl) throw new Error(`no table for ${name}`);
  t += `  ${name}: [\n${wrap(tbl, "    ")}\n  ],\n`;
}
t += "} as const satisfies Record<string, readonly (string | number)[]>;\n";
writeFileSync(join(outDir, "valueTables.ts"), t);

const pObj = (p) => {
  const parts = [`cc: ${p.cc}`, `key: "${p.key}"`, `label: "${p.label}"`, `display: "${p.display}"`];
  if (p.unit) parts.push(`unit: "${p.unit}"`);
  if (p.tuning) parts.push("tuning: true");
  if (p.isSync) parts.push("isSync: true");
  let s = `{ ${parts.join(", ")}`;
  if (p.starts) s += `,\n        starts: [${p.starts.join(", ")}]`;
  if (p.sync) {
    const sp = [`display: "${p.sync.display}"`];
    if (p.sync.unit) sp.push(`unit: "${p.sync.unit}"`);
    if (p.sync.starts) sp.push(`starts: [${p.sync.starts.join(", ")}]`);
    s += `,\n        sync: { ${sp.join(", ")} }`;
  }
  return s + " }";
};
let f = "// Generated from touchosc-controllers sp404-mk2/lua/controls_info.lua and sp404_effect_on_values.lua\n";
f += "// (BC Modular). The 46 SP-404 MK2 effects: CC 83 number per bus group (0 = not available) and parameters.\n\n";
f += 'import type { FxDef } from "./fxTypes";\n\n';
f += "export const EFFECTS: readonly FxDef[] = [\n";
for (const fx of effects) {
  f += `  {\n    id: ${fx.id},\n    name: "${fx.name}",\n    cc83: { bus12: ${fx.cc83.bus12}, bus34: ${fx.cc83.bus34}, input: ${fx.cc83.input} },\n    params: [\n`;
  for (const p of fx.params) f += `      ${pObj(p)},\n`;
  f += "    ],\n  },\n";
}
f += "];\n";
writeFileSync(join(outDir, "effects.ts"), f);
console.log("effects", effects.length, "tables", Object.keys(tables).length, "params", effects.reduce((n, x) => n + x.params.length, 0));
