import { describe, expect, it } from "vitest";
import { ageFit, applyAgeFit, computeVerdict, explain, positionIn, strength, type Profile } from "./scoring";

/** Real Qloo affinities (signal.location point, 40 km), pulled 2026-10-20. */
const CITIES = ["Atlanta", "Boston", "Chicago", "Houston", "Denver", "New York", "Los Angeles", "Seattle"];
const real = (vals: number[]): Profile => Object.fromEntries(CITIES.map((c, i) => [c, vals[i]]));
const WAFFLE = real([0.9978, 0.9694, 0.9794, 0.9789, 0.9713, 0.9756, 0.9639, 0.9557]);
const DUNKIN = real([0.9984, 0.9996, 0.9989, 0.9951, 0.9944, 0.9993, 0.9953, 0.9895]);
const PORTILLO = real([0.9681, 0.9659, 0.9992, 0.9671, 0.9783, 0.9697, 0.9786, 0.9672]);
const STARBUCKS = real([0.9998, 0.9998, 0.9999, 0.9998, 0.9997, 0.9999, 0.9998, 0.9998]);
const TAYLOR = real([0.9997, 1.0, 0.9999, 0.9994, 1.0, 1.0, 1.0, 1.0]);
// 35-and-younger audience: low affinity overall, but Boston is clearly home
const CUMBERLAND = real([0.7943, 0.9029, 0.8154, 0.745, 0.781, 0.8558, 0.7921, 0.7573]);

const verdict = (known: number, profile: Profile, city: string) => {
  const p = positionIn(profile, city);
  return p ? computeVerdict(known, p) : null;
};

describe("verdicts on real Qloo data", () => {
  it("Waffle House: lands in Atlanta, dies in Boston, lukewarm in Chicago", () => {
    expect(verdict(0.89, WAFFLE, "Atlanta")).toBe("green");
    expect(verdict(0.89, WAFFLE, "Boston")).toBe("red");
    expect(verdict(0.89, WAFFLE, "Chicago")).toBe("yellow");
  });
  it("Dunkin': lands in Boston, dies in Houston", () => {
    expect(verdict(1, DUNKIN, "Boston")).toBe("green");
    expect(verdict(1, DUNKIN, "Houston")).toBe("red");
  });
  it("Portillo's: lands in Chicago, dies in Atlanta, shaky where it still beats the median", () => {
    expect(verdict(0.83, PORTILLO, "Chicago")).toBe("green");
    expect(verdict(0.83, PORTILLO, "Atlanta")).toBe("red");
    expect(verdict(0.83, PORTILLO, "Los Angeles")).toBe("yellow");
  });
  it("Starbucks and Taylor Swift play the same everywhere, so they are yellow in every city", () => {
    for (const c of CITIES) {
      expect(verdict(1, STARBUCKS, c)).toBe("yellow");
      expect(verdict(1, TAYLOR, c)).toBe("yellow");
    }
  });
  it("Cumberland Farms: home in Boston, dies in Atlanta even though the rest of the pool is flat", () => {
    expect(positionIn(CUMBERLAND, "Boston")!.rank).toBe(1);
    expect(verdict(0.48, CUMBERLAND, "Atlanta")).toBe("red");
    expect(verdict(0.48, CUMBERLAND, "Houston")).toBe("red");
  });
});

describe("computeVerdict", () => {
  const strong = { rank: 1, of: 12, lift: 1.5, spread: 0.04, ofTop: 1 };
  it("is red when almost nobody knows it, however local", () => {
    expect(computeVerdict(0.1, strong)).toBe("red");
  });
  it("is only yellow when loved locally but not widely known", () => {
    expect(computeVerdict(0.35, strong)).toBe("yellow");
  });
});

describe("positionIn", () => {
  it("ranks the city among the pool", () => {
    const p = positionIn(WAFFLE, "Atlanta")!;
    expect([p.rank, p.of]).toEqual([1, 8]);
    expect(p.lift).toBeGreaterThan(1.5);
  });
  it("returns null with no data for the city or too few cities", () => {
    expect(positionIn({ ...WAFFLE, Boston: null }, "Boston")).toBeNull();
    expect(positionIn({ Atlanta: 0.9, Boston: 0.8 }, "Atlanta")).toBeNull();
  });
});

describe("strength", () => {
  it("stretches the top of the affinity scale", () => {
    expect(strength(0.9998)).toBeGreaterThan(strength(0.99) * 1.5);
  });
  it("is capped for a perfect score", () => {
    expect(Number.isFinite(strength(1))).toBe(true);
  });
});

describe("explain", () => {
  it("names the reason", () => {
    expect(explain(0.1, { rank: 1, of: 8, lift: 1, spread: 0.04, ofTop: 1 }, "red", "Atlanta")).toMatch(/Too few/);
    expect(explain(1, { rank: 3, of: 8, lift: 1, spread: 0.0002, ofTop: 0.95 }, "yellow", "Atlanta")).toMatch(/same in every city/);
    expect(explain(0.9, { rank: 8, of: 8, lift: 0.6, spread: 0.04, ofTop: 0.5 }, "red", "Boston")).toMatch(/Boston .* least/);
    // red because one city dominates, not because this one is near the bottom
    expect(explain(0.9, { rank: 3, of: 8, lift: 1.02, spread: 0.04, ofTop: 0.6 }, "red", "Houston")).toMatch(/#3 of 8, well behind the cities that love it most/);
  });
});

describe("age", () => {
  // real age-only affinities
  const LOVE_ISLAND = { "35_and_younger": 0.9647, "36_to_55": 0.5799, "55_and_older": 0.5837 };
  const WAFFLE_AGE = { "35_and_younger": 0.7539, "36_to_55": 0.7787, "55_and_older": 0.9463 };
  it("reads strong, neutral and weak from absolute affinity", () => {
    expect(ageFit(LOVE_ISLAND, "35_and_younger")).toBe("strong");
    expect(ageFit(LOVE_ISLAND, "55_and_older")).toBe("weak");
    expect(ageFit(WAFFLE_AGE, "35_and_younger")).toBe("neutral");
    expect(ageFit(WAFFLE_AGE, "any")).toBeNull();
  });
  it("only ever knocks green down to yellow", () => {
    expect(applyAgeFit("green", "weak")).toBe("yellow");
    expect(applyAgeFit("yellow", "weak")).toBe("yellow");
    expect(applyAgeFit("green", "strong")).toBe("green");
  });
});
