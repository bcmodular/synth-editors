import { describe, expect, it } from "vitest";
import { degreeNote, scaleNotes } from "./pitch";

describe("note circle", () => {
  it("lights a major or minor scale from the SCALE step", () => {
    expect([...scaleNotes(0).notes].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]); // C Maj
    expect(scaleNotes(21)).toMatchObject({ key: 9, minor: true }); // A Min
  });

  it("folds NOTE's scale degree into the octave", () => {
    expect(degreeNote(1, 0, false)).toBe(0); // C Maj, degree 1 = C
    expect(degreeNote(3, 0, false)).toBe(4); // E
    expect(degreeNote(-1, 0, false)).toBe(11); // the degree below = B
    expect(degreeNote(8, 9, true)).toBe(9); // A Min, degree 8 = A again
  });
});
