import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { setQloo } from "../qloo";
import { MockQlooClient } from "../qloo/mock";
import { fixSet, otherCitiesIn, paragraphAround, replaceWithArticle, rewriteIsFaithful, rulesDecider, sentenceAround, type Decider, type FixStep } from "./fix";

describe("sentenceAround", () => {
  const t = "Back home, Dunkin' is a personality. Here, I walked into a Waffle House at 3 a.m. and the waitress knew me.\n\nNext line.";
  it("finds the sentence and ignores dots inside a.m.", () => {
    const i = t.indexOf("Waffle House");
    const s = sentenceAround(t, i, i + 12);
    expect(t.slice(s.start, s.end)).toBe("Here, I walked into a Waffle House at 3 a.m. and the waitress knew me.");
  });
  it("finds the first sentence", () => {
    const i = t.indexOf("Dunkin'");
    const s = sentenceAround(t, i, i + 7);
    expect(t.slice(s.start, s.end)).toBe("Back home, Dunkin' is a personality.");
  });
});

describe("otherCitiesIn", () => {
  it("names other cities but not the room's own", () => {
    expect(otherCitiesIn("I told him I grew up on Wawa hoagies back in Boston.", "Houston")).toEqual(["Boston"]);
    expect(otherCitiesIn("Houston is hot, Boston is not.", "Houston")).toEqual(["Boston"]);
    expect(otherCitiesIn("Nothing here.", "Houston")).toEqual([]);
  });
});

describe("paragraphAround", () => {
  it("returns just the blank-line separated paragraph", () => {
    const t = "First para. Boston.\n\nSecond para with Dunkin'. More.\n\nThird.";
    const i = t.indexOf("Dunkin'");
    expect(paragraphAround(t, i, i + 7)).toBe("Second para with Dunkin'. More.");
    expect(paragraphAround("one paragraph only", 4, 9)).toBe("one paragraph only");
  });
});

describe("replaceWithArticle", () => {
  it("fixes a/an", () => {
    const s = "I walked into a Waffle House.";
    expect(replaceWithArticle(s, 16, 28, "IHOP")).toBe("I walked into an IHOP.");
    expect(replaceWithArticle("An Applebee's run", 3, 13, "Waffle House")).toBe("A Waffle House run");
  });
});

describe("rewriteIsFaithful", () => {
  const before = "My roommate says Tom Brady is just a guy who throws.";
  it("accepts a clean swap", () => {
    expect(rewriteIsFaithful(before, "My roommate says Matt Ryan is just a guy who throws.", "Tom Brady", "Matt Ryan")).toBe(true);
  });
  it("rejects a rewrite that adds material", () => {
    expect(
      rewriteIsFaithful(before, "My roommate, a huge Falcons fan, says Matt Ryan is honestly just a guy who throws footballs.", "Tom Brady", "Matt Ryan"),
    ).toBe(false);
  });
  it("rejects a rewrite that drops the pick or keeps the old name", () => {
    expect(rewriteIsFaithful(before, before, "Tom Brady", "Matt Ryan")).toBe(false);
  });
});

describe("fixSet (demo data)", () => {
  beforeAll(() => setQloo(new MockQlooClient()));
  afterAll(() => setQloo(null));
  const room = { city: "Atlanta", age: "any" as const };
  const text = "Back home, Dunkin' is a personality. My uncle only eats at Portillo's.";

  it("swaps references that die here and re-checks", async () => {
    const steps: FixStep[] = [];
    const out = await fixSet(text, room, { decide: rulesDecider, onStep: (s) => steps.push(s) });
    expect(steps[0].kind).toBe("plan");
    expect(steps.at(-1)!.kind).toBe("done");
    expect(out.swapped).toBeGreaterThan(0);
    expect(out.result.references.filter((r) => r.scores[0]?.verdict === "red")).toHaveLength(0);
  });

  it("falls back to rules when the decider fails or rewrites too much", async () => {
    const broken: Decider = async () => {
      throw new Error("rate limited");
    };
    const rewriter: Decider = async ({ candidates }) => ({ pick: 0, sentence: `Totally new text about ${candidates[0].entity.name}.`, why: "", by: "llm" });
    for (const decide of [broken, rewriter]) {
      const steps: FixStep[] = [];
      await fixSet(text, room, { decide, onStep: (s) => steps.push(s) });
      const swaps = steps.filter((s) => s.kind === "swap");
      expect(swaps.length).toBeGreaterThan(0);
      for (const s of swaps) expect(s.kind === "swap" && s.by).toBe("rules");
    }
  });

  it("keeps a reference when the decider says nothing fits", async () => {
    const none: Decider = async () => ({ pick: -1, sentence: "", why: "Nothing fits.", by: "llm" });
    const steps: FixStep[] = [];
    const out = await fixSet(text, room, { decide: none, onStep: (s) => steps.push(s) });
    expect(out.swapped).toBe(0);
    expect(steps.some((s) => s.kind === "keep")).toBe(true);
  });

  it("leaves a clean set alone", async () => {
    const p = PRESETS[0];
    const steps: FixStep[] = [];
    await fixSet("Thanks for coming out tonight.", p.room, { decide: rulesDecider, onStep: (s) => steps.push(s) });
    expect(steps.map((s) => s.kind)).toEqual(["plan", "done"]);
  });
});
