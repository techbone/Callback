import type { AgeBand, Candidate, Entity, QlooType, Room, Tag } from "../types";

export type Affinity = { local: number; baseline: number };

/**
 * The only surface the rest of the app uses to talk to Qloo. `mock.ts` backs it
 * with demo fixtures; `live.ts` (M1, once the hackathon key arrives) backs it
 * with https://hackathon.api.qloo.com.
 */
export interface QlooClient {
  readonly source: "live" | "demo";
  /** Resolve a name to the best-matching entity of the guessed type. */
  search(name: string, type: QlooType): Promise<Entity[]>;
  /** Local and national affinity for specific entities in one room. */
  affinities(type: QlooType, entityIds: string[], room: Room): Promise<Record<string, Affinity>>;
  /** Same-tag entities this room over-indexes on, for swap suggestions. */
  localCandidates(type: QlooType, tags: Tag[], room: Room, exclude: string[], take: number): Promise<Candidate[]>;
  /** What the room loves right now, ranked by lift over the national baseline. */
  crowd(type: QlooType, room: Room, take: number): Promise<Candidate[]>;
}

export type { AgeBand };
