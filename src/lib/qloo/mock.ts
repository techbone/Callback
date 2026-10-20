import type { AgeProfile, Profile } from "../scoring";
import type { AgeBand, Entity, QlooType, Room } from "../types";
import type { QlooClient } from "./client";
import { FIXTURES, type Fixture } from "./fixtures";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const toEntity = (x: Fixture): Entity => ({
  qlooId: x.id,
  name: x.name,
  type: x.type,
  popularity: x.popularity,
  tags: x.tags.map((name) => ({ id: `demo:tag:${name}`, name })),
});

/** Turn a 0-1 fixture "how much the city likes it" into a Qloo-like affinity bunched near 1. */
function affinity(x: Fixture, city: string, age: AgeBand): number {
  const v = Math.min(1, (x.cities[city] ?? x.national) * (age === "any" ? 1 : (x.age?.[age] ?? 1)));
  return 1 - 10 ** -(1 + 3 * v);
}

const byId = new Map(FIXTURES.map((x) => [x.id, x]));

export class MockQlooClient implements QlooClient {
  readonly source = "demo" as const;

  async search(query: string): Promise<Entity[]> {
    const q = norm(query);
    return FIXTURES.filter((x) => [x.name, ...(x.aliases ?? [])].some((n) => norm(n) === q)).map(toEntity);
  }

  async affinities(_type: QlooType, ids: string[], cities: string[], age: AgeBand) {
    const out: Record<string, Profile> = {};
    for (const id of ids) {
      const x = byId.get(id);
      out[id] = Object.fromEntries(cities.map((c) => [c, x ? affinity(x, c, age) : null]));
    }
    return out;
  }

  async ageAffinities(_type: QlooType, ids: string[]) {
    const out: Record<string, AgeProfile> = {};
    for (const id of ids) {
      const x = byId.get(id);
      out[id] = Object.fromEntries(
        (["35_and_younger", "36_to_55", "55_and_older"] as const).map((b) => [b, x ? affinity(x, "_national_", b) : null]),
      );
    }
    return out;
  }

  async similarHere(entity: Entity, room: Room, take: number): Promise<Entity[]> {
    const want = new Set(entity.tags.map((t) => t.name));
    return FIXTURES.filter((x) => x.type === entity.type && x.id !== entity.qlooId && x.tags.some((t) => want.has(t)))
      .sort((a, b) => affinity(b, room.city, room.age) - affinity(a, room.city, room.age))
      .slice(0, take)
      .map(toEntity);
  }

  async crowd(type: QlooType, room: Room, take: number): Promise<Entity[]> {
    return FIXTURES.filter((x) => x.type === type && x.popularity >= 0.25)
      .sort((a, b) => affinity(b, room.city, room.age) / affinity(b, "_", room.age) - affinity(a, room.city, room.age) / affinity(a, "_", room.age))
      .slice(0, take)
      .map(toEntity);
  }
}
