import type { Verdict } from "./types";

/**
 * Verdict thresholds. These are placeholders until we calibrate against live
 * Qloo data in M2 (see ARCHITECTURE.md > Scoring).
 */
export const THRESHOLDS = {
  /** popularity percentile at/above which a reference counts as widely known */
  knownHi: 0.5,
  /** below this, almost nobody knows it */
  knownLo: 0.25,
  /** local affinity over national baseline needed to count as loved here */
  liftHi: 1.25,
  /** below this, the room likes it less than the country does */
  liftLo: 0.8,
} as const;

export function computeLift(local: number, baseline: number): number {
  if (baseline <= 0) return local > 0 ? Number.POSITIVE_INFINITY : 1;
  return local / baseline;
}

export function computeVerdict(known: number, lift: number, t = THRESHOLDS): Verdict {
  if (known < t.knownLo || lift < t.liftLo) return "red";
  if (known >= t.knownHi && lift >= t.liftHi) return "green";
  return "yellow";
}

/** One plain sentence on why a reference got its verdict. */
export function explain(known: number, lift: number, verdict: Verdict, t = THRESHOLDS): string {
  if (verdict === "green") return "Widely known, and this room likes it more than the country does.";
  if (verdict === "yellow") {
    return lift >= t.liftHi
      ? "This room likes it, but not enough people will recognise it."
      : "Widely known, but this room is no keener on it than the country is.";
  }
  return known < t.knownLo
    ? "Too few people in this room will know it."
    : "This room likes it less than the country does.";
}
