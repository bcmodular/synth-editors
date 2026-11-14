// Patch dumps saved from the JV live in fixtures/local/jv2080/ (gitignored). These tests skip when there are none,
// eg. on CI or a fresh clone.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diffPatch } from "./diff";
import { decodeSyx, encodeSyx, getParam, patchName, type Patch } from "./patch";
import { ALL_PARAMS } from "./params";
import { param } from "./paramValue";
import { waveGroupOf } from "./waves";

const FIXTURE_DIR = join(import.meta.dirname, "../../../../fixtures/local/jv2080");
const files = existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".syx")) : [];

function load(file: string): Patch {
  const result = decodeSyx(readFileSync(join(FIXTURE_DIR, file)));
  if ("error" in result) throw new Error(`${file}: ${result.error}`);
  return result.patch;
}

describe.skipIf(files.length === 0)("local .syx dumps", () => {
  it.each(files)("%s decodes, re-encodes byte for byte, and diffs to nothing", (file) => {
    const bytes = readFileSync(join(FIXTURE_DIR, file));
    const patch = load(file);
    expect(Array.from(encodeSyx(patch))).toEqual(Array.from(bytes));
    expect(diffPatch(patch, patch)).toEqual([]);
    expect(patchName(patch)).not.toBe("");
  });

  it.each(files)("%s has every parameter in range and internal waves", (file) => {
    const patch = load(file);
    for (const p of ALL_PARAMS) {
      for (const tone of p.block === "tone" ? [0, 1, 2, 3] : [0]) {
        const value = getParam(patch, p, tone);
        expect(value, `${p.id} tone ${tone + 1}`).toBeGreaterThanOrEqual(p.min);
        expect(value, `${p.id} tone ${tone + 1}`).toBeLessThanOrEqual(p.max);
      }
    }
    for (const tone of [0, 1, 2, 3]) {
      const group = waveGroupOf(getParam(patch, param("waveGroupType"), tone), getParam(patch, param("waveGroupId"), tone));
      expect(group, `tone ${tone + 1}`).toBeDefined();
    }
  });
});
