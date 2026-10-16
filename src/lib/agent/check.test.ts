import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESETS } from "../presets";
import { checkText } from "./check";
import { locateSpans } from "./extract";

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
afterEach(() => vi.unstubAllEnvs());

const standup = PRESETS.find((p) => p.id === "standup")!;
const verdictOf = (res: Awaited<ReturnType<typeof checkText>>, surface: string) =>
  res.references.find((r) => r.surface === surface)?.scores[0]?.verdict;

describe("checkText (demo data)", () => {
  it("is green in the city that loves it and red where it dies", async () => {
    const atl = await checkText(standup.text, [standup.room]);
    expect(atl.source).toBe("demo");
    expect(verdictOf(atl, "Waffle House")).toBe("green");
    expect(verdictOf(atl, "Cumberland Farms")).toBe("red");

    const bos = await checkText(standup.text, [{ city: "Boston", age: "35_and_younger" }]);
    expect(verdictOf(bos, "Dunkin'")).toBe("green");
    expect(verdictOf(bos, "Waffle House")).toBe("red");
  });

  it("marks a nationwide favourite the room is lukewarm on as yellow", async () => {
    const atl = await checkText(standup.text, [standup.room]);
    expect(verdictOf(atl, "Starbucks")).toBe("yellow");
  });

  it("returns one score per room for tour mode", async () => {
    const rooms = ["Atlanta", "Boston", "Chicago"].map((city) => ({ city, age: "any" as const }));
    const res = await checkText(standup.text, rooms);
    for (const r of res.references) expect(r.scores).toHaveLength(r.entity ? 3 : 0);
  });

  it("leaves text with no references untouched", async () => {
    const res = await checkText("Thanks everyone for coming tonight.", [standup.room]);
    expect(res.references).toEqual([]);
  });
});

describe("locateSpans", () => {
  it("finds every occurrence and drops overlaps", () => {
    const text = "Starbucks, then more Starbucks";
    const spans = locateSpans(text, [{ surface: "Starbucks", guessedType: "brand", roleInLine: "" }]);
    expect(spans.map((s) => [s.start, s.end])).toEqual([[0, 9], [21, 30]]);
  });
});
