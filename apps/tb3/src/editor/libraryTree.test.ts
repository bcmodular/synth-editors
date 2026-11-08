import { describe, expect, it } from "vitest";
import { displayName, filterTree, moveTarget, renameTarget } from "./libraryTree";
import type { LibEntry } from "./useLibrary";

const file = (path: string, kind: "patch" | "set" = "patch"): LibEntry => ({ kind, name: path.split("/").pop()!, path });
const dir = (path: string, children: LibEntry[]): LibEntry => ({ kind: "dir", name: path.split("/").pop()!, path, children });

const tree = [dir("Acid", [file("Acid/Squelch.syx"), dir("Acid/Old", [file("Acid/Old/Rubber.syx")])]), file("Bass.syx")];

describe("library search", () => {
  it("keeps matches and the folders leading to them", () => {
    expect(filterTree(tree, "rubber")).toEqual([dir("Acid", [dir("Acid/Old", [file("Acid/Old/Rubber.syx")])])]);
  });

  it("a matching folder keeps only its matching contents", () => {
    expect(filterTree(tree, "acid")).toEqual([dir("Acid", [])]);
  });
});

describe("library moves", () => {
  it("moves into another folder, or to the top", () => {
    expect(moveTarget({ from: "Bass.syx", into: "Acid" })).toBe("Acid/Bass.syx");
    expect(moveTarget({ from: "Acid/Squelch.syx", into: "" })).toBe("Squelch.syx");
  });

  it("refuses a move to where it already is, or into itself", () => {
    expect(moveTarget({ from: "Acid/Squelch.syx", into: "Acid" })).toBeNull();
    expect(moveTarget({ from: "Acid", into: "Acid" })).toBeNull();
    expect(moveTarget({ from: "Acid", into: "Acid/Old" })).toBeNull();
    expect(moveTarget({ from: "Acid", into: "Acidic" })).toBe("Acidic/Acid");
  });
});

describe("library renames", () => {
  it("shows and edits files without their extension, and keeps it on rename", () => {
    const f = file("Acid/Squelch.syx");
    expect(displayName(f)).toBe("Squelch");
    expect(renameTarget(f, "Gloop")).toBe("Acid/Gloop.syx");
    expect(renameTarget(f, "Gloop.syx")).toBe("Acid/Gloop.syx");
    expect(renameTarget(file("A.tb3set", "set"), "B")).toBe("B.tb3set");
  });

  it("renames folders as typed", () => {
    expect(displayName(tree[0]!)).toBe("Acid");
    expect(renameTarget(tree[0]!, "Acid.old")).toBe("Acid.old");
  });
});
