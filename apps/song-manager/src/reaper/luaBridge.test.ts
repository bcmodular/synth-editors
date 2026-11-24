// Runs the Lua bridge's own tests (apps/song-manager/reaper/test) when a lua interpreter is installed.

import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFile = fileURLToPath(new URL("../../reaper/test/bridge_test.lua", import.meta.url));

function findLua(): string | undefined {
  for (const candidate of ["lua", "/opt/homebrew/bin/lua", "lua5.4"]) {
    if (spawnSync(candidate, ["-v"]).status === 0) return candidate;
  }
  return undefined;
}

const lua = findLua();

describe.skipIf(!lua)("Reaper bridge script (Lua)", () => {
  it("passes its tests against the mock Reaper", () => {
    const output = execFileSync(lua as string, [testFile], { encoding: "utf8" });
    expect(output).toMatch(/, 0 failed/);
  });
});
