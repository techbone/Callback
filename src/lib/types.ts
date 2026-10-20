export const QLOO_TYPES = [
  "brand",
  "place",
  "tv_show",
  "movie",
  "artist",
  "person",
  "podcast",
  "video_game",
  "book",
  "destination",
] as const;
export type QlooType = (typeof QLOO_TYPES)[number];

export const AGE_BANDS = ["any", "35_and_younger", "36_to_55", "55_and_older"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_LABELS: Record<AgeBand, string> = {
  any: "Any age",
  "35_and_younger": "35 and younger",
  "36_to_55": "36 to 55",
  "55_and_older": "55 and older",
};

export type Room = { city: string; venue?: string; age: AgeBand };

export const roomKey = (r: Room) => `${r.city}|${r.venue ?? ""}|${r.age}`;

export type Tag = { id: string; name: string };

export type Entity = {
  qlooId: string;
  name: string;
  type: QlooType;
  /** 0-1 popularity percentile from Qloo */
  popularity: number;
  tags: Tag[];
};

export type Verdict = "green" | "yellow" | "red";

export type Score = {
  roomKey: string;
  /** raw Qloo affinity in this room's city, 0-1 */
  local: number;
  /** 1 = the city in the pool that likes it most */
  rank: number;
  /** number of cities with data in the pool */
  of: number;
  /** strength here over the median of the other cities */
  lift: number;
  /** raw affinity range across cities; tiny means it plays the same everywhere */
  spread: number;
  /** strength as a share of the strongest city's */
  ofTop: number;
  /** popularity percentile, 0-1 */
  known: number;
  /** verdict from location alone */
  placeVerdict: Verdict;
  /** how the room's age band takes to it; null when no band is set or no data */
  ageFit: "strong" | "neutral" | "weak" | null;
  /** final verdict: location, then adjusted for age */
  verdict: Verdict;
};

export type Reference = {
  id: string;
  start: number;
  end: number;
  surface: string;
  entity: Entity;
  /** one per room; a room is missing when Qloo has no location data for it */
  scores: Score[];
  /** age-only affinity, when the rooms have an age band */
  age?: Partial<Record<"35_and_younger" | "36_to_55" | "55_and_older", number | null>>;
};

export type Candidate = { entity: Entity; score: Score };

export type CheckResult = {
  references: Reference[];
  /** "demo" means invented fixtures, not live Qloo data */
  source: "live" | "demo";
};
