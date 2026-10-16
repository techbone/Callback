import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare } from "./share";

const state = {
  t: "I love Waffle House.\n\nAnd “quotes”, emoji 🎤 and #hashes.",
  r: { city: "Atlanta", age: "35_and_younger" as const },
  m: "tour" as const,
  c: ["Atlanta", "Boston"],
};

describe("share links", () => {
  it("round-trips a set, room and tour", () => {
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });
  it("rejects garbage and foreign hashes", () => {
    expect(decodeShare("")).toBeNull();
    expect(decodeShare("#other=1")).toBeNull();
    expect(decodeShare("#s=notvalid")).toBeNull();
  });
  it("rejects well-formed payloads with the wrong shape", () => {
    expect(decodeShare(encodeShare({ ...state, m: "nope" as never }))).toBeNull();
  });
});
