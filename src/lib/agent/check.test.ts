import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { setQloo } from "../qloo";
import { MockQlooClient } from "../qloo/mock";
import { checkText, findSwaps } from "./check";

beforeAll(() => setQloo(new MockQlooClient()));
afterAll(() => setQloo(null));

const standup = PRESETS.find((p) => p.id === "standup")!;
const verdictOf = (res: Awaited<ReturnType<typeof checkText>>, surface: string) =>
  res.references.find((r) => r.surface === surface)?.scores[0]?.verdict;

describe("checkText (demo data)", () => {
  it("is green where a reference is loved and red where it dies", async () => {
    const atl = await checkText(standup.text, [standup.room]);
    expect(atl.source).toBe("demo");
    expect(verdictOf(atl, "Waffle House")).toBe("green");
    const bos = await checkText(standup.text, [{ city: "Boston", age: "35_and_younger" }]);
    expect(verdictOf(bos, "Dunkin'")).toBe("green");
    expect(verdictOf(bos, "Waffle House")).toBe("red");
  });

  it("returns one score per room for tour mode", async () => {
    const rooms = ["Atlanta", "Boston", "Chicago"].map((city) => ({ city, age: "any" as const }));
    const res = await checkText(standup.text, rooms);
    expect(res.references.length).toBeGreaterThan(3);
    for (const r of res.references) expect(r.scores).toHaveLength(3);
  });

  it("leaves text with no references untouched", async () => {
    const res = await checkText("Thanks everyone for coming tonight.", [standup.room]);
    expect(res.references).toEqual([]);
  });
});

describe("findSwaps (demo data)", () => {
  it("suggests same-type swaps the room likes", async () => {
    const atl = await checkText(standup.text, [standup.room]);
    const dunkin = atl.references.find((r) => r.surface === "Dunkin'")!.entity;
    const swaps = await findSwaps(dunkin, standup.room);
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      expect(s.entity.type).toBe("brand");
      expect(s.score.verdict).not.toBe("red");
    }
  });
});
