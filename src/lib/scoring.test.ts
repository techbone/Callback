import { describe, expect, it } from "vitest";
import { computeLift, computeVerdict } from "./scoring";

describe("computeVerdict", () => {
  it("is green when widely known and loved locally", () => {
    expect(computeVerdict(0.8, 2.4)).toBe("green");
  });
  it("is yellow when known but the room is indifferent", () => {
    expect(computeVerdict(0.8, 1.0)).toBe("yellow");
  });
  it("is yellow when loved locally but only moderately known", () => {
    expect(computeVerdict(0.35, 1.6)).toBe("yellow");
  });
  it("is red when the room likes it less than the nation does", () => {
    expect(computeVerdict(0.9, 0.5)).toBe("red");
  });
  it("is red when almost nobody knows it, however much locals like it", () => {
    expect(computeVerdict(0.1, 3)).toBe("red");
  });
  it("treats the boundaries as inclusive for green", () => {
    expect(computeVerdict(0.5, 1.25)).toBe("green");
  });
});

describe("computeLift", () => {
  it("divides local by baseline", () => {
    expect(computeLift(0.6, 0.3)).toBeCloseTo(2);
  });
  it("handles a zero baseline", () => {
    expect(computeLift(0, 0)).toBe(1);
    expect(computeLift(0.2, 0)).toBe(Infinity);
  });
});
