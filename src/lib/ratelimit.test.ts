import { describe, expect, it } from "vitest";
import { rateLimit } from "./ratelimit";

describe("rateLimit", () => {
  it("allows up to the limit, then blocks until the window slides", () => {
    const k = "t1";
    for (let i = 0; i < 3; i++) expect(rateLimit(k, 3, 1000, 100 + i).ok).toBe(true);
    const blocked = rateLimit(k, 3, 1000, 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit(k, 3, 1000, 1200).ok).toBe(true);
  });
  it("keeps clients separate", () => {
    for (let i = 0; i < 2; i++) rateLimit("a", 2, 1000, 10);
    expect(rateLimit("a", 2, 1000, 20).ok).toBe(false);
    expect(rateLimit("b", 2, 1000, 20).ok).toBe(true);
  });
});
