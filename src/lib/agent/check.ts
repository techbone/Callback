import { computeLift, computeVerdict } from "../scoring";
import { getQloo } from "../qloo";
import type { CheckResult, Entity, QlooType, Reference, Room, Score } from "../types";
import { roomKey } from "../types";
import { extractReferences, locateSpans } from "./extract";

/**
 * extract -> resolve -> score. One batched affinity call per (room, type), not
 * one per reference.
 */
export async function checkText(text: string, rooms: Room[]): Promise<CheckResult> {
  const qloo = getQloo();
  const spans = locateSpans(text, await extractReferences(text));

  // resolve each distinct surface once
  const resolved = new Map<string, Entity | undefined>();
  await Promise.all(
    [...new Set(spans.map((s) => s.surface))].map(async (surface) => {
      const span = spans.find((s) => s.surface === surface)!;
      const [best] = await qloo.search(surface, span.guessedType);
      resolved.set(surface, best);
    }),
  );

  // batched scoring: room x type
  const byType = new Map<QlooType, Set<string>>();
  for (const e of resolved.values()) {
    if (!e) continue;
    if (!byType.has(e.type)) byType.set(e.type, new Set());
    byType.get(e.type)!.add(e.qlooId);
  }
  const scores = new Map<string, Score>(); // `${roomKey}#${entityId}`
  await Promise.all(
    rooms.flatMap((room) =>
      [...byType].map(async ([type, ids]) => {
        const aff = await qloo.affinities(type, [...ids], room);
        for (const id of ids) {
          const a = aff[id];
          const e = [...resolved.values()].find((x) => x?.qlooId === id)!;
          if (!a) continue;
          const lift = computeLift(a.local, a.baseline);
          scores.set(`${roomKey(room)}#${id}`, {
            roomKey: roomKey(room),
            local: a.local,
            baseline: a.baseline,
            lift,
            known: e.popularity,
            verdict: computeVerdict(e.popularity, lift),
          });
        }
      }),
    ),
  );

  const references: Reference[] = spans.map((s, i) => {
    const entity = resolved.get(s.surface);
    return {
      id: `r${i}`,
      start: s.start,
      end: s.end,
      surface: s.surface,
      roleInLine: s.roleInLine,
      entity,
      scores: entity ? rooms.flatMap((r) => scores.get(`${roomKey(r)}#${entity.qlooId}`) ?? []) : [],
    };
  });
  return { references, source: qloo.source };
}
