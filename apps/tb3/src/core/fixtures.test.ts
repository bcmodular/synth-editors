// Real patch dumps live in fixtures/local/tb3/ (gitignored: third-party patches).
// These tests skip when the folder is empty, e.g. on CI or a fresh clone.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { splitSysex } from "@synth-editors/midi";
import { PATCH_BLOCKS, addrKey, parseDt1 } from "./sysex";

const FIXTURE_DIR = join(import.meta.dirname, "../../../../fixtures/local/tb3");
const files = existsSync(FIXTURE_DIR) ? readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".syx")) : [];

describe.skipIf(files.length === 0)("local .syx fixtures", () => {
  it.each(files)("%s holds all 11 patch blocks with valid checksums", (file) => {
    const messages = splitSysex(readFileSync(join(FIXTURE_DIR, file))).map((m) => parseDt1(m));
    expect(messages).toHaveLength(PATCH_BLOCKS.length);

    // Files order blocks arbitrarily, so match by address.
    const byKey = new Map(messages.map((m) => [m ? addrKey(m.addr) : "", m]));
    for (const block of PATCH_BLOCKS) {
      const msg = byKey.get(addrKey(block.addr));
      expect(msg, block.name).toBeDefined();
      expect(msg?.data.length, block.name).toBe(block.size);
      expect(msg?.checksumOk, block.name).toBe(true);
    }
  });
});
