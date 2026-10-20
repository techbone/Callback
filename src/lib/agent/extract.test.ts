import { describe, expect, it } from "vitest";
import type { Entity } from "../types";
import { extractCandidates, pickEntity, splitOnJoiners } from "./extract";

const surfaces = (t: string) => extractCandidates(t).map((c) => c.surface);

describe("extractCandidates", () => {
  it("finds multi-word and single-word references and keeps exact offsets", () => {
    const t = "Back home, Dunkin' is a personality. I walked into a Waffle House at 3 a.m.";
    const c = extractCandidates(t);
    expect(c.map((x) => x.surface)).toEqual(["Dunkin'", "Waffle House"]);
    for (const x of c) expect(t.slice(x.start, x.end)).toBe(x.surface);
  });
  it("strips sentence openers off the front of a run", () => {
    const t = "Then Love Island came on.";
    const [c] = extractCandidates(t);
    expect(c.surface).toBe("Love Island");
    expect(t.slice(c.start, c.end)).toBe("Love Island");
  });
  it("skips pronouns, first names and the cities we score against", () => {
    expect(surfaces("I moved to Atlanta from Boston. Dave and Priya met at Fenway Park.")).toEqual(["Fenway Park"]);
  });
  it("keeps joiners inside titles", () => {
    expect(surfaces("We binged Parks and Recreation all week.")).toEqual(["Parks and Recreation"]);
  });
  it("keeps accented letters whole", () => {
    const t = "We listened to Beyoncé all the way home.";
    const [c] = extractCandidates(t);
    expect(c.surface).toBe("Beyoncé");
    expect(t.slice(c.start, c.end)).toBe("Beyoncé");
  });
  it("keeps The in titles and ignores number words", () => {
    expect(surfaces("Twenty years later, you watch The Bear like homework.")).toEqual(["The Bear"]);
  });
  it("splits a joined run into pieces as a fallback", () => {
    const t = "Think of us as the Tattered Cover of B2B data.";
    expect(surfaces(t)).toEqual(["Tattered Cover of B2B"]);
    const [run] = extractCandidates(t);
    expect(splitOnJoiners(run).map((p) => t.slice(p.start, p.end))).toEqual(["Tattered Cover", "B2B"]);
  });
});

const e = (name: string, type: Entity["type"], popularity: number): Entity => ({ qlooId: `${type}:${name}`, name, type, popularity, tags: [] });

describe("pickEntity", () => {
  it("prefers an exact name, then brand over individual store locations", () => {
    const r = [e("Waffle House", "place", 0.98), e("Waffle House", "brand", 0.89)];
    expect(pickEntity("Waffle House", r, { sentenceStart: false })?.type).toBe("brand");
  });
  it("accepts a prefix match for a shortened brand name, and only for brands", () => {
    expect(pickEntity("Dunkin'", [e("Dunkin' Donuts", "brand", 1)], { sentenceStart: false })?.name).toBe("Dunkin' Donuts");
    expect(pickEntity("Red Rocks", [e("Red Rocks Live in VR", "movie", 0.8)], { sentenceStart: false })).toBeNull();
  });
  it("matches across diacritics and a dropped leading The, without letting it beat an exact name", () => {
    expect(pickEntity("Beyoncé", [e("Beyonce", "artist", 1)], { sentenceStart: false })?.name).toBe("Beyonce");
    expect(pickEntity("Real Housewives of Atlanta", [e("The Real Housewives of Atlanta", "tv_show", 0.9)], { sentenceStart: false })?.type).toBe("tv_show");
    const future = [e("The Future", "movie", 0.9), e("Future", "artist", 1)];
    expect(pickEntity("Future", future, { sentenceStart: false })?.type).toBe("artist");
  });
  it("prefers the TV show over a video game of the same name", () => {
    const r = [e("Love Island", "video_game", 0.97), e("Love Island", "tv_show", 0.61)];
    expect(pickEntity("Love Island", r, { sentenceStart: false })?.type).toBe("tv_show");
  });
  it("rejects loose matches and obscure single words at the start of a sentence", () => {
    expect(pickEntity("Fair", [e("Fair Game", "movie", 0.7)], { sentenceStart: true })).toBeNull();
    expect(pickEntity("Fair", [e("Fair", "movie", 0.3)], { sentenceStart: true })).toBeNull();
  });
});
