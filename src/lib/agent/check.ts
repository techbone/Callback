import { POOL } from "../cities";
import { getQloo, type QlooClient } from "../qloo";
import { ageFit, applyAgeFit, computeVerdict, positionIn, THRESHOLDS, type AgeProfile, type Profile } from "../scoring";
import type { Candidate as Swap, CheckResult, CityRow, Entity, Reference, Room, Score } from "../types";
import { roomKey } from "../types";
import { extractCandidates, pickEntity, splitOnJoiners, type Candidate } from "./extract";

/**
 * Score entities in each room. Location is ranked against the city pool with no
 * age signal (age swamps location when combined); age is scored separately and
 * can knock the verdict down a step. Batched: one call per type and city, plus
 * one per type and age band, all cached per entity.
 */
export async function scoreEntities(
  qloo: QlooClient,
  entities: Entity[],
  rooms: Room[],
  agesOut?: Map<string, AgeProfile>,
  profilesOut?: Map<string, Profile>,
): Promise<Map<string, Score[]>> {
  const out = new Map<string, Score[]>(entities.map((e) => [e.qlooId, []]));
  const cities = [...new Set([...POOL, ...rooms.map((r) => r.city)])];
  const types = [...new Set(entities.map((e) => e.type))];
  const needAge = rooms.some((r) => r.age !== "any");

  await Promise.all(
    types.map(async (type) => {
      const group = entities.filter((e) => e.type === type);
      const ids = [...new Set(group.map((e) => e.qlooId))];
      const [profiles, ages] = await Promise.all([
        qloo.affinities(type, ids, cities, "any"),
        needAge ? qloo.ageAffinities(type, ids) : Promise.resolve({} as Record<string, AgeProfile>),
      ]);
      for (const e of group) {
        if (ages[e.qlooId]) agesOut?.set(e.qlooId, ages[e.qlooId]);
        const profile = profiles[e.qlooId];
        if (profile) profilesOut?.set(e.qlooId, profile);
        for (const room of rooms) {
          const list = out.get(e.qlooId)!;
          if (list.some((s) => s.roomKey === roomKey(room))) continue;
          const pos = profile ? positionIn(profile, room.city) : null;
          if (!pos) continue;
          const placeVerdict = computeVerdict(e.popularity, pos);
          const fit = ageFit(ages[e.qlooId], room.age);
          list.push({
            roomKey: roomKey(room),
            local: profile[room.city] as number,
            ...pos,
            known: e.popularity,
            placeVerdict,
            ageFit: fit,
            verdict: applyAgeFit(placeVerdict, fit),
          });
        }
      }
    }),
  );
  return out;
}

/** extract -> resolve -> score */
export async function checkText(text: string, rooms: Room[]): Promise<CheckResult> {
  const qloo = getQloo();
  let candidates = extractCandidates(text);

  const resolved = new Map<string, Entity | null>();
  const resolveAll = (cs: Candidate[]) =>
    Promise.all(
      [...new Set(cs.map((c) => c.surface))]
        .filter((surface) => !resolved.has(surface))
        .map(async (surface) => {
          const sentenceStart = cs.filter((x) => x.surface === surface).every((x) => x.sentenceStart);
          resolved.set(surface, pickEntity(surface, await qloo.search(surface), { sentenceStart }));
        }),
    );
  await resolveAll(candidates);
  // joined runs that matched nothing get a second chance as separate pieces
  const retry = candidates.flatMap((c) => (resolved.get(c.surface) ? [] : splitOnJoiners(c)));
  if (retry.length) {
    await resolveAll(retry);
    candidates = candidates.flatMap((c) => (resolved.get(c.surface) ? [c] : splitOnJoiners(c).filter((p) => resolved.get(p.surface))));
  }

  const entities = [...new Map([...resolved.values()].flatMap((e) => (e ? [[e.qlooId, e] as const] : []))).values()];
  const ages = new Map<string, AgeProfile>();
  const profiles = new Map<string, Profile>();
  const scores = await scoreEntities(qloo, entities, rooms, ages, profiles);

  const references: Reference[] = candidates.flatMap((c, i) => {
    const entity = resolved.get(c.surface);
    if (!entity) return [];
    const profile = profiles.get(entity.qlooId);
    return [
      {
        id: `r${i}`,
        start: c.start,
        end: c.end,
        surface: c.surface,
        entity,
        scores: scores.get(entity.qlooId) ?? [],
        cities: profile ? cityRows(entity, profile) : undefined,
        age: ages.get(entity.qlooId),
      },
    ];
  });
  return { references, source: qloo.source };
}

const rank = { green: 0, yellow: 1, red: 2 } as const;

/** Same-category swaps this room likes, best first. */
export async function findSwaps(entity: Entity, room: Room, take = 3): Promise<Swap[]> {
  const qloo = getQloo();
  const seen = new Set([entity.name.toLowerCase()]);
  const pool = (await qloo.similarHere(entity, room, 40)).filter((e) => {
    const k = e.name.toLowerCase();
    if (e.qlooId === entity.qlooId || seen.has(k) || e.popularity < THRESHOLDS.knownHi) return false;
    seen.add(k);
    return true;
  });
  const scores = await scoreEntities(qloo, pool, [room]);
  return pool
    .flatMap((e) => {
      const score = scores.get(e.qlooId)?.[0];
      return score && score.verdict !== "red" && score.lift > 1 ? [{ entity: e, score }] : [];
    })
    .sort((a, b) => rank[a.score.verdict] - rank[b.score.verdict] || b.score.lift - a.score.lift)
    .slice(0, take);
}

/** Every pool city for one entity, best first. Pure: uses a profile already fetched. */
export function cityRows(entity: Entity, profile: Profile): CityRow[] {
  return POOL.flatMap((city) => {
    const p = positionIn(profile, city);
    return p ? [{ city, rank: p.rank, of: p.of, lift: p.lift, verdict: computeVerdict(entity.popularity, p) }] : [];
  }).sort((a, b) => a.rank - b.rank);
}

/** Resolve a bare name ("Waffle House") to a Qloo entity. */
export async function resolveName(name: string): Promise<Entity | null> {
  return pickEntity(name, await getQloo().search(name), { sentenceStart: false });
}

/** Where a reference lands across the city pool, plus its age profile. */
export async function whereItLands(entity: Entity): Promise<{ cities: CityRow[]; age: AgeProfile }> {
  const qloo = getQloo();
  const [profiles, ages] = await Promise.all([
    qloo.affinities(entity.type, [entity.qlooId], POOL, "any"),
    qloo.ageAffinities(entity.type, [entity.qlooId]),
  ]);
  return { cities: cityRows(entity, profiles[entity.qlooId] ?? {}), age: ages[entity.qlooId] ?? {} };
}
