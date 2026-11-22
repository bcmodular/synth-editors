import { describe, expect, it } from "vitest";
import { foundDesks, XINFO } from "./discovery";
import { decodePacket, encodeMessage, str } from "./osc";

const xinfo = (ip: string, name: string) => encodeMessage("/xinfo", [str(ip), str(name), str("X32RACK"), str("4.15")]);

describe("discovery", () => {
  it("asks with an argument-less /xinfo", () => {
    expect(decodePacket(XINFO)).toEqual([{ address: "/xinfo", args: [] }]);
  });

  it("lists each desk once, by where its answer came from", () => {
    const answer = { from: "192.168.0.138:10023", bytes: xinfo("192.168.0.138", "X32RACK-0E-1C-B1") };
    expect(foundDesks([answer, answer])).toEqual([
      { host: "192.168.0.138:10023", name: "X32RACK-0E-1C-B1", model: "X32RACK", firmware: "4.15" },
    ]);
  });

  it("ignores anything that isn't an /xinfo answer", () => {
    const fake = { from: "127.0.0.1:50123", bytes: xinfo("127.0.0.1", "Fake") };
    const other = { from: "192.168.0.9:10023", bytes: encodeMessage("/info", [str("V2.07")]) };
    expect(foundDesks([fake, other]).map((d) => d.host)).toEqual(["127.0.0.1:50123"]);
  });
});
