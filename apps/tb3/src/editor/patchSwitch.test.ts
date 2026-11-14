import { describe, expect, it } from "vitest";
import { encodeParam, getRaw, setRaw } from "../core/patch";
import { paramById } from "../core/params";
import { parseDt1 } from "../core/sysex";
import { demoPatch } from "./demoPatch";
import { switchMessages } from "./patchSwitch";

const volume = paramById("master_volume");
const cutoff = paramById("vcf_cutoff");
const from = demoPatch();
const to = setRaw(from, cutoff, getRaw(from, cutoff) + 20);

describe("switchMessages", () => {
  it("sends just the changes", () => {
    expect(switchMessages(from, to, false)).toHaveLength(1);
    expect(switchMessages(from, from, false)).toEqual([]);
  });

  it("quiet: volume to 0 first and back last, with the volume left out of the middle", () => {
    const louder = setRaw(to, volume, 100);
    const msgs = switchMessages(from, louder, true);
    expect(msgs[0]).toEqual(encodeParam(volume, 0));
    expect(msgs.at(-1)).toEqual(encodeParam(volume, 100));
    expect(msgs.slice(1, -1).map((m) => parseDt1(m)!.addr[2])).not.toContain(0x0c); // nothing in the VCA block
  });

  it("quiet: a switch that only changes the volume isn't muted", () => {
    const msgs = switchMessages(from, setRaw(from, volume, 10), true);
    expect(msgs).toEqual([encodeParam(volume, 10)]);
  });
});
