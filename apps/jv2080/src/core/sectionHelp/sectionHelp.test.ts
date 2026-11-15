import { describe, expect, it } from "vitest";
import { ALL_PARAMS } from "../params";
import { AMP_HELP, CHORUS_HELP, FILTER_HELP, LFO_HELP, MIXER_HELP, PATCH_HELP, PITCH_HELP, REVERB_HELP, toneOverviewHelp } from ".";

const ids = new Set(ALL_PARAMS.map((p) => p.id));
const parts = [PITCH_HELP, FILTER_HELP, AMP_HELP, LFO_HELP, CHORUS_HELP, REVERB_HELP, PATCH_HELP, MIXER_HELP].map((help) => ({ name: help.title, help }));
// The tone overviews' blocks stand for whole parts, whose detail is in the parts' own help, so they aren't all rows.
const overviews = [0, 1, 2, 3].map((t) => ({ name: toneOverviewHelp(t).title, help: toneOverviewHelp(t) }));
const sections = [...parts, ...overviews];

describe("section help", () => {
  it.each(sections)("$name's rows name real parameters, each once", ({ help }) => {
    const named = help.rows.flatMap((r) => r.ids);
    for (const id of named) expect(ids.has(id), id).toBe(true);
    expect(new Set(help.rows.map((r) => r.label)).size, "row labels are unique").toBe(help.rows.length);
  });

  it.each(sections)("$name's flow joins nodes that exist and names real parameters", ({ help }) => {
    const nodes = new Set(help.flow.nodes.map((n) => n.id));
    expect(nodes.size, "node ids are unique").toBe(help.flow.nodes.length);
    for (const e of help.flow.edges) expect(nodes.has(e.from) && nodes.has(e.to), `${e.from} → ${e.to}`).toBe(true);
    const used = [
      ...help.flow.nodes.flatMap((n) => [...(n.params ?? []), ...(n.value ? [n.value].flat() : [])]),
      ...help.flow.edges.flatMap((e) => [...(e.params ?? []), ...(e.gains ?? []).map((g) => g.param), ...(e.when ? [e.when.param] : [])]),
    ];
    for (const id of used) expect(ids.has(id), id).toBe(true);
  });

  it.each(parts)("$name's flow parameters are all in its rows, so pointing at the flow lights a row", ({ help }) => {
    const rowIds = new Set(help.rows.flatMap((r) => r.ids));
    const used = help.flow.nodes.flatMap((n) => n.params ?? []).concat(help.flow.edges.flatMap((e) => (e.gains ?? []).map((g) => g.param)));
    const outside = used.filter((id) => !rowIds.has(id) && !id.startsWith("efx"));
    expect(outside).toEqual([]);
  });
});

describe("tone overview", () => {
  it("pairs each tone with the other tone of its pair", () => {
    expect(toneOverviewHelp(0).rows.find((r) => r.label.startsWith("Structure"))?.ids).toEqual(["structure12"]);
    expect(toneOverviewHelp(3).rows.find((r) => r.label.startsWith("Structure"))?.text).toContain("tone 3");
  });
});
