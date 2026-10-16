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
  /** affinity in this room, 0-1 */
  local: number;
  /** affinity nationally for the same age band, 0-1 */
  baseline: number;
  /** local / baseline */
  lift: number;
  /** popularity percentile, 0-1 */
  known: number;
  verdict: Verdict;
};

export type Reference = {
  id: string;
  start: number;
  end: number;
  surface: string;
  roleInLine: string;
  /** undefined when the reference could not be resolved to a Qloo entity */
  entity?: Entity;
  scores: Score[];
};

export type Candidate = { entity: Entity; local: number; baseline: number; lift: number };

export type CheckResult = {
  references: Reference[];
  /** "demo" means fixtures, not live Qloo data */
  source: "live" | "demo";
};
