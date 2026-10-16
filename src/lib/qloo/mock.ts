import type { Candidate, Entity, QlooType, Room, Tag } from "../types";
import type { Affinity, QlooClient } from "./client";
import { FIXTURES, type Fixture } from "./fixtures";
import { computeLift } from "../scoring";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const toTag = (name: string): Tag => ({ id: `demo:tag:${name}`, name });

const toEntity = (x: Fixture): Entity => ({
  qlooId: x.id,
  name: x.name,
  type: x.type,
  popularity: x.popularity,
  tags: x.tags.map(toTag),
});

function affinityOf(x: Fixture, room: Room): Affinity {
  const base = x.cities[room.city] ?? x.national;
  const ageMul = x.age?.[room.age] ?? 1;
  return { local: Math.min(1, base * ageMul), baseline: x.national };
}

const byId = new Map(FIXTURES.map((x) => [x.id, x]));

export class MockQlooClient implements QlooClient {
  readonly source = "demo" as const;

  async search(name: string, type: QlooType): Promise<Entity[]> {
    const q = norm(name);
    const hits = FIXTURES.filter((x) => [x.name, ...(x.aliases ?? [])].some((n) => norm(n) === q));
    // prefer the guessed type, but still resolve if the model guessed the wrong one
    hits.sort((a, b) => Number(b.type === type) - Number(a.type === type));
    return hits.map(toEntity);
  }

  async affinities(_type: QlooType, ids: string[], room: Room) {
    const out: Record<string, Affinity> = {};
    for (const id of ids) {
      const x = byId.get(id);
      if (x) out[id] = affinityOf(x, room);
    }
    return out;
  }

  async localCandidates(type: QlooType, tags: Tag[], room: Room, exclude: string[], take: number): Promise<Candidate[]> {
    const want = new Set(tags.map((t) => t.name));
    return FIXTURES.filter((x) => x.type === type && !exclude.includes(x.id) && x.popularity >= 0.25)
      .map((x) => ({ x, overlap: x.tags.filter((t) => want.has(t)).length }))
      .filter(({ overlap }) => overlap > 0)
      .map(({ x, overlap }) => {
        const a = affinityOf(x, room);
        return { overlap, candidate: { entity: toEntity(x), ...a, lift: computeLift(a.local, a.baseline) } };
      })
      .filter(({ candidate }) => candidate.lift >= 1.25)
      .sort((a, b) => b.overlap - a.overlap || b.candidate.lift - a.candidate.lift)
      .slice(0, take)
      .map(({ candidate }) => candidate);
  }

  async crowd(type: QlooType, room: Room, take: number): Promise<Candidate[]> {
    return FIXTURES.filter((x) => x.type === type && x.popularity >= 0.25)
      .map((x) => {
        const a = affinityOf(x, room);
        return { entity: toEntity(x), ...a, lift: computeLift(a.local, a.baseline) };
      })
      .filter((c) => c.lift >= 1.25)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, take);
  }
}
