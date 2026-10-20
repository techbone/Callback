import type { AgeBand, Verdict } from "./types";

/** Affinity per city. null means Qloo has no location data for the entity there. */
export type Profile = Record<string, number | null>;

/** Affinity per age band (no location). */
export type AgeProfile = Partial<Record<Exclude<AgeBand, "any">, number | null>>;

export type AgeFit = "strong" | "neutral" | "weak";

/**
 * How this age band takes to a reference, from Qloo's age-only affinity. Real
 * values sit around 0.55-0.65 when a band has no particular feeling for
 * something and 0.85+ when it skews that way (e.g. Love Island: 0.96 under 35,
 * 0.58 over 55).
 */
export function ageFit(profile: AgeProfile | undefined, band: AgeBand, t = AGE_THRESHOLDS): AgeFit | null {
  if (!profile || band === "any") return null;
  const mine = profile[band];
  if (mine == null) return null;
  if (mine >= t.strong) return "strong";
  if (mine < t.weak) return "weak";
  return "neutral";
}

export const AGE_THRESHOLDS = { strong: 0.85, weak: 0.66 } as const;

/** Age is a modifier: it can stop a reference being a sure thing, never make it die. */
export const applyAgeFit = (v: Verdict, fit: AgeFit | null): Verdict => (fit === "weak" && v === "green" ? "yellow" : v);

export type Position = {
  /** 1 = this city likes it most among the pool */
  rank: number;
  of: number;
  /** this city's strength over the median of the other cities */
  lift: number;
  /** raw affinity range across cities; tiny means it plays the same everywhere */
  spread: number;
  /** this city's strength as a share of the strongest city's */
  ofTop: number;
};

/**
 * Thresholds. Calibrated on real Qloo numbers (see scoring.test.ts), not guessed.
 */
export const THRESHOLDS = {
  /** popularity at/above which a reference counts as widely known */
  knownHi: 0.5,
  /** below this almost nobody knows it */
  knownLo: 0.25,
  /** raw affinity range under this means it plays about the same in every city */
  flat: 0.005,
  /** best share of the pool counts as "loved here" */
  topShare: 0.25,
  /** from this share down (0 = best, 1 = worst), and below the median city, counts as "dies here" */
  bottomShare: 0.4,
  liftHi: 1.15,
  /** outside the top share, a city this far below the strongest one counts as "dies here"... */
  farBelowTop: 0.7,
  /** ...unless it still beats the median city by this much */
  farBelowTopMaxLift: 1.1,
} as const;

/**
 * Qloo affinities are percentile-like and bunch near 1 (0.96 vs 0.9998), so raw
 * differences are tiny. -log10(1 - a) stretches the top end into a usable scale.
 */
export const strength = (a: number) => -Math.log10(Math.max(1e-5, 1 - Math.min(a, 0.99999)));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Where a city sits in a profile, or null when Qloo has no data for it. */
export function positionIn(profile: Profile, city: string): Position | null {
  const mine = profile[city];
  if (mine == null) return null;
  const all = Object.values(profile).filter((v): v is number => v != null).map(strength);
  if (all.length < 3) return null;
  const s = strength(mine);
  const others = Object.entries(profile)
    .filter(([c, v]) => c !== city && v != null)
    .map(([, v]) => strength(v as number));
  const raw = Object.values(profile).filter((v): v is number => v != null);
  return {
    rank: 1 + all.filter((x) => x > s + 1e-9).length,
    of: all.length,
    lift: s / median(others),
    spread: Math.max(...raw) - Math.min(...raw),
    ofTop: s / Math.max(...all),
  };
}

export function computeVerdict(known: number, p: Position, t = THRESHOLDS): Verdict {
  if (known < t.knownLo) return "red";
  if (p.spread < t.flat) return "yellow";
  const share = p.of > 1 ? (p.rank - 1) / (p.of - 1) : 0;
  if (share <= t.topShare && p.lift >= t.liftHi) return known >= t.knownHi ? "green" : "yellow";
  if (share >= t.bottomShare && p.lift < 1) return "red";
  if (share > t.topShare && p.ofTop < t.farBelowTop && p.lift < t.farBelowTopMaxLift) return "red";
  return "yellow";
}

const AGE_WORDS: Record<Exclude<AgeBand, "any">, string> = {
  "35_and_younger": "under-35s",
  "36_to_55": "36-to-55s",
  "55_and_older": "over-55s",
};

/** A short second sentence about the age band, or "". */
export function explainAge(fit: AgeFit | null, band: AgeBand): string {
  if (!fit || band === "any" || fit === "neutral") return "";
  return fit === "strong" ? `It plays especially well with ${AGE_WORDS[band]}.` : `${AGE_WORDS[band][0].toUpperCase()}${AGE_WORDS[band].slice(1)} don't go for it much, so it's not a sure thing.`;
}

/** One plain sentence on why a reference got its location verdict. */
export function explain(known: number, p: Position, verdict: Verdict, city: string, t = THRESHOLDS): string {
  if (known < t.knownLo) return "Too few people in this room will know it.";
  if (p.spread < t.flat) return "Everyone knows it, and it plays about the same in every city.";
  if (verdict === "green") return `Widely known, and ${city} is one of the cities that likes it most.`;
  if (verdict === "red") {
    return p.rank <= Math.ceil(p.of / 2)
      ? `${city} ranks #${p.rank} of ${p.of}, well behind the cities that love it most.`
      : `${city} is one of the cities that likes it least.`;
  }
  return p.rank <= Math.ceil(p.of / 2)
    ? `${city} likes it more than most, but not enough to count on it.`
    : `Known, but ${city} sits in the middle of the pack for it.`;
}
