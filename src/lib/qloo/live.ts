import { cityByName } from "../cities";
import type { AgeProfile, Profile } from "../scoring";
import { QLOO_TYPES, type AgeBand, type Entity, type QlooType, type Room } from "../types";
import type { QlooClient } from "./client";
import { cached, cacheGet, cacheSet, isMiss } from "./store";
import { record, type QlooOp } from "./trace";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
/** radius around the city centre for the location signal, in metres */
const RADIUS = "40000";
/** Entity types a reference can resolve to. Places are left out: they carry no location affinity. */
const SEARCH_TYPES: QlooType[] = ["brand", "tv_show", "movie", "artist", "person", "podcast", "video_game", "book"];
/** Qloo allows 5 requests a second per key; stay just under it. */
const PER_SECOND = 4;

type RawTag = { id?: string; tag_id?: string; name: string };
type RawEntity = {
  entity_id: string;
  name: string;
  type?: string;
  types?: string[];
  popularity?: number;
  tags?: RawTag[];
  query?: { affinity?: number };
};
type InsightsResponse = { results?: { entities?: RawEntity[] } };

/** The hackathon API names video games "videogame" on every endpoint (the docs say video_game). */
const apiType = (t: QlooType) => `urn:entity:${t === "video_game" ? "videogame" : t}`;

const toType = (raw: RawEntity): QlooType | null => {
  const t = (raw.type ?? raw.types?.[0] ?? "").replace("urn:entity:", "").replace(/^videogame$/, "video_game");
  return (QLOO_TYPES as readonly string[]).includes(t) ? (t as QlooType) : null;
};

const toEntity = (raw: RawEntity, fallbackType?: QlooType): Entity | null => {
  const type = toType(raw) ?? fallbackType ?? null;
  if (!type) return null;
  return {
    qlooId: raw.entity_id,
    name: raw.name,
    type,
    popularity: raw.popularity ?? 0,
    // keep the first few tags: enough to explain a match without bloating the cache
    tags: (raw.tags ?? []).slice(0, 8).flatMap((t) => (t.id ?? t.tag_id ? [{ id: (t.id ?? t.tag_id)!, name: t.name }] : [])),
  };
};

function locationParams(city: string, age: AgeBand): Record<string, string> {
  const c = cityByName(city);
  if (!c) throw new Error(`Unknown city: ${city}`);
  const p: Record<string, string> = { "signal.location": `POINT(${c.lon} ${c.lat})`, "signal.location.radius": RADIUS };
  if (age !== "any") p["signal.demographics.age"] = age;
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let starts: number[] = [];
async function throttle() {
  for (;;) {
    const now = Date.now();
    starts = starts.filter((t) => now - t < 1000);
    if (starts.length < PER_SECOND) {
      starts.push(now);
      return;
    }
    await sleep(1000 - (now - starts[0]) + 10);
  }
}

/** Monthly calls left on the key, from Qloo's response headers. */
export let monthRemaining: number | null = null;

/** Below this many calls left, stop making new ones so cached examples keep working through judging. */
export const QUOTA_FLOOR = Number(process.env.QLOO_QUOTA_FLOOR ?? 300);

export class QuotaLow extends Error {
  constructor() {
    super("Qloo monthly quota nearly used");
  }
}

export class LiveQlooClient implements QlooClient {
  readonly source = "live" as const;

  constructor(
    private key: string,
    private base = "https://hackathon.api.qloo.com",
  ) {}

  private async get<T>(path: string, params: Record<string, string> | URLSearchParams, op: QlooOp): Promise<T> {
    if (monthRemaining !== null && monthRemaining < QUOTA_FLOOR) throw new QuotaLow();
    record(op, false);
    const url = `${this.base}${path}?${new URLSearchParams(params)}`;
    for (let attempt = 0; ; attempt++) {
      await throttle();
      const res = await fetch(url, { headers: { "X-Api-Key": this.key }, cache: "no-store" });
      const left = res.headers.get("x-month-ratelimit-remaining");
      if (left) monthRemaining = Number(left);
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const reset = Number(res.headers.get("x-second-ratelimit-reset"));
        await sleep(Number.isFinite(reset) && reset > 0 ? reset * 1000 + 50 : 500 * (attempt + 1));
        continue;
      }
      throw new Error(`Qloo ${path} ${res.status}`);
    }
  }

  search(query: string): Promise<Entity[]> {
    return cached(`search|${query.toLowerCase()}`, WEEK, async () => {
      // cultural types only: unfiltered search returns individual store locations first
      const params = new URLSearchParams({ query, take: "8" });
      for (const t of SEARCH_TYPES) params.append("types", apiType(t));
      const r = await this.get<{ results?: RawEntity[] }>("/search", params, "search");
      return (r.results ?? []).flatMap((x) => toEntity(x) ?? []);
    }, "search");
  }

  async affinities(type: QlooType, ids: string[], cities: string[], age: AgeBand): Promise<Record<string, Profile>> {
    const out: Record<string, Profile> = Object.fromEntries(ids.map((id) => [id, {}]));
    const k = (id: string, city: string) => `aff|${type}|${id}|${city}|${age}`;
    await Promise.all(
      cities.map(async (city) => {
        // each entity/city pair is cached on its own; only fetch the ones we lack
        const missing: string[] = [];
        for (const id of ids) {
          const v = await cacheGet(k(id, city));
          if (isMiss(v)) missing.push(id);
          else out[id][city] = v as number | null;
        }
        record("location", true, ids.length - missing.length);
        if (missing.length === 0) return;
        const r = await this.get<InsightsResponse>(
          "/v2/insights",
          {
            "filter.type": apiType(type),
            "filter.results.entities": missing.join(","),
            ...locationParams(city, age),
            take: String(missing.length),
          },
          "location",
        );
        const got = new Map((r.results?.entities ?? []).map((e) => [e.entity_id, e.query?.affinity ?? null]));
        for (const id of missing) {
          const v = got.get(id) ?? null;
          out[id][city] = v;
          await cacheSet(k(id, city), v, WEEK);
        }
      }),
    );
    return out;
  }

  async ageAffinities(type: QlooType, ids: string[]): Promise<Record<string, AgeProfile>> {
    const out: Record<string, AgeProfile> = Object.fromEntries(ids.map((id) => [id, {}]));
    const bands = ["35_and_younger", "36_to_55", "55_and_older"] as const;
    const k = (id: string, band: string) => `age|${type}|${id}|${band}`;
    await Promise.all(
      bands.map(async (band) => {
        const missing: string[] = [];
        for (const id of ids) {
          const v = await cacheGet(k(id, band));
          if (isMiss(v)) missing.push(id);
          else out[id][band] = v as number | null;
        }
        record("age", true, ids.length - missing.length);
        if (missing.length === 0) return;
        const r = await this.get<InsightsResponse>(
          "/v2/insights",
          {
            "filter.type": apiType(type),
            "filter.results.entities": missing.join(","),
            "signal.demographics.age": band,
            take: String(missing.length),
          },
          "age",
        );
        const got = new Map((r.results?.entities ?? []).map((e) => [e.entity_id, e.query?.affinity ?? null]));
        for (const id of missing) {
          const v = got.get(id) ?? null;
          out[id][band] = v;
          await cacheSet(k(id, band), v, WEEK);
        }
      }),
    );
    return out;
  }

  similarHere(entity: Entity, room: Room, take: number): Promise<Entity[]> {
    return cached(`similar|${entity.qlooId}|${room.city}|${take}`, WEEK, async () => {
      const r = await this.get<InsightsResponse>("/v2/insights", {
        "filter.type": apiType(entity.type),
        "signal.interests.entities": entity.qlooId,
        ...locationParams(room.city, "any"),
        take: String(take),
      }, "similar");
      return (r.results?.entities ?? []).flatMap((x) => toEntity(x, entity.type) ?? []);
    }, "similar");
  }

  crowd(type: QlooType, room: Room, take: number): Promise<Entity[]> {
    // No age signal here: combined with location it swamps the city (tested: Atlanta
    // turned into Orlando parks). Trends only for TV, where it surfaces what's on now.
    return cached(`crowd|${type}|${room.city}|${take}`, 3 * DAY, async () => {
      const c = cityByName(room.city);
      if (!c) throw new Error(`Unknown city: ${room.city}`);
      const point = `POINT(${c.lon} ${c.lat})`;
      const params: Record<string, string> =
        type === "place"
          ? { "filter.location": point, "filter.location.radius": "20000" }
          : { "signal.location": point, "signal.location.radius": RADIUS };
      if (type === "tv_show") params["bias.trends"] = "high";
      const r = await this.get<InsightsResponse>("/v2/insights", { "filter.type": apiType(type), ...params, take: String(take) }, "crowd");
      return (r.results?.entities ?? []).flatMap((x) => toEntity(x, type) ?? []);
    }, "crowd");
  }
}
