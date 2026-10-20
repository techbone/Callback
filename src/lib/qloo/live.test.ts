import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// quota state lives at module level, so each test gets a fresh copy of the module
const load = () => import("./live");

const reply = (remaining: number, results: unknown[] = []) =>
  new Response(JSON.stringify({ results }), { status: 200, headers: { "x-month-ratelimit-remaining": String(remaining) } });

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("LiveQlooClient quota guard", () => {
  it("stops making new calls once the monthly quota is nearly used, but still serves cached ones", async () => {
    const fetchMock = vi.fn(async () => reply(120, [{ entity_id: "e1", name: "Wawa", types: ["urn:entity:brand"], popularity: 0.9, tags: [] }]));
    vi.stubGlobal("fetch", fetchMock);
    const { LiveQlooClient, QuotaLow } = await load();
    const qloo = new LiveQlooClient("k", "https://example.test");

    // the first call goes through and reports 120 calls left, which is under the floor
    expect((await qloo.search("quota-test-wawa"))[0].name).toBe("Wawa");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // a new lookup is refused without touching the network
    await expect(qloo.search("quota-test-other")).rejects.toBeInstanceOf(QuotaLow);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // the same lookup again is a cache hit, so it still works
    expect((await qloo.search("quota-test-wawa"))[0].name).toBe("Wawa");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps video games to the API's type name and back", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      void url;
      return reply(9000, [{ entity_id: "g1", name: "Fortnite", types: ["urn:entity:videogame"], popularity: 0.9, tags: [] }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { LiveQlooClient } = await load();
    const [e] = await new LiveQlooClient("k", "https://example.test").search("quota-test-fortnite");
    expect(e.type).toBe("video_game");
    expect(String(fetchMock.mock.calls[0][0])).toContain("types=urn%3Aentity%3Avideogame");
  });
});
