import type { AgeBand, Entity, QlooType, Room } from "../types";
import type { AgeProfile, Profile } from "../scoring";

/**
 * The only surface the rest of the app uses to talk to Qloo. `live.ts` calls the
 * hackathon API; `mock.ts` serves invented demo fixtures when no key is set.
 */
export interface QlooClient {
  readonly source: "live" | "demo";
  /** Entities whose names match the query, across all types. */
  search(query: string): Promise<Entity[]>;
  /** Affinity of each entity in each city. Missing data comes back as null. */
  affinities(type: QlooType, entityIds: string[], cities: string[], age: AgeBand): Promise<Record<string, Profile>>;
  /** Affinity of each entity per age band, with no location signal. */
  ageAffinities(type: QlooType, entityIds: string[]): Promise<Record<string, AgeProfile>>;
  /** Same-type entities this room likes that resemble the given one, for swaps. */
  similarHere(entity: Entity, room: Room, take: number): Promise<Entity[]>;
  /** What the room likes right now (trend-biased). */
  crowd(type: QlooType, room: Room, take: number): Promise<Entity[]>;
}
