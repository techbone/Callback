import { chatJSON, llmConfigured } from "../llm";
import { TYPE_LABEL } from "../labels";
import type { Candidate, CheckResult, Entity, Room } from "../types";
import { CITY_NAMES } from "../cities";
import { checkText, findSwaps } from "./check";

export type FixStep =
  | { kind: "plan"; red: number; total: number; city: string }
  | { kind: "swap"; surface: string; to: string; rank: number; of: number; why: string; by: string; before: string; after: string; note?: string }
  | { kind: "keep"; surface: string; why: string; by: string }
  | { kind: "done"; text: string; result: CheckResult; swapped: number };

export type DecisionInput = { sentence: string; surface: string; entity: Entity; city: string; candidates: Candidate[] };
export type Decision = { pick: number; sentence: string; why: string; by: string };
export type Decider = (input: DecisionInput) => Promise<Decision | null>;

/** Other cities named in a sentence: the swap is scored for one room, so the line may be about somewhere else. */
export function otherCitiesIn(sentence: string, room: string): string[] {
  return CITY_NAMES.filter((c) => c !== room && new RegExp(`\\b${c}\\b`, "i").test(sentence));
}

/** The paragraph (blank-line separated) around a span. */
export function paragraphAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start).lastIndexOf("\n\n");
  const after = text.indexOf("\n\n", end);
  return text.slice(before < 0 ? 0 : before + 2, after < 0 ? text.length : after);
}

/** The sentence around a span. Boundaries are . ! ? followed by space and a capital, or a newline. */
export function sentenceAround(text: string, start: number, end: number): { start: number; end: number } {
  let s = 0;
  const back = /[.!?]["”')\]]*\s+(?=["“(]?[A-Z])|\n+/g;
  for (const m of text.slice(0, start).matchAll(back)) s = m.index! + m[0].length;
  const fwd = /[.!?]["”')\]]*(?=\s+["“(]?[A-Z]|\s*$)|\n/g;
  fwd.lastIndex = end;
  const m = fwd.exec(text);
  const e = m ? m.index + (m[0] === "\n" ? 0 : m[0].length) : text.length;
  return { start: s, end: e };
}

/** Replace a span with a name, fixing a preceding "a"/"an". */
export function replaceWithArticle(sentence: string, from: number, to: number, name: string): string {
  let head = sentence.slice(0, from);
  const art = /\b(a|an|A|An)(\s+)$/.exec(head);
  if (art) {
    const an = /^[aeiou]/i.test(name);
    const word = an ? (art[1][0] === "A" ? "An" : "an") : art[1][0] === "A" ? "A" : "a";
    head = head.slice(0, art.index) + word + art[2];
  }
  return head + name + sentence.slice(to);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Guard against an LLM that rewrites too much: the new sentence must name the
 * pick, drop the old reference, and otherwise keep the writer's words.
 */
export function rewriteIsFaithful(before: string, after: string, surface: string, pick: string): boolean {
  if (!after.toLowerCase().includes(pick.toLowerCase())) return false;
  if (after.toLowerCase().includes(surface.toLowerCase())) return false;
  const rest = (s: string, cut: string) => words(s.replace(new RegExp(cut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " "));
  const a = new Set(rest(before, surface));
  const b = new Set(rest(after, pick));
  const ignore = new Set(["a", "an", "the"]);
  const kept = [...a].filter((w) => ignore.has(w) || b.has(w)).length;
  const added = [...b].filter((w) => !a.has(w) && !ignore.has(w)).length;
  return kept / Math.max(1, a.size) >= 0.85 && added <= 3 && after.length <= before.length * 1.5;
}

function noteFor(paragraph: string, city: string): string | undefined {
  const others = otherCitiesIn(paragraph, city);
  return others.length
    ? `This part of the set mentions ${others.join(" and ")}. The swap is scored for ${city} only, so check it still fits the story.`
    : undefined;
}

/** No LLM: take the best-ranked swap and put its name in place. */
export const rulesDecider: Decider = async ({ sentence, surface, candidates, city }) => {
  const c = candidates[0];
  const i = sentence.indexOf(surface);
  if (!c || i < 0) return null;
  return {
    pick: 0,
    sentence: replaceWithArticle(sentence, i, i + surface.length, c.entity.name),
    why: `Best-ranked swap in the same category: #${c.score.rank} of ${c.score.of} cities for ${city}.`,
    by: "rules",
  };
};

const SYSTEM = `You help a writer adapt cultural references for a live audience.
You get one sentence, one reference in it that won't land with this crowd, and replacement candidates this city's crowd loves (from Qloo taste data, best first).
Pick the candidate that keeps the line working: same role and meaning (a quarterback for a line about throwing, a late-night chain for a line about 3 a.m. food), recognisable to this crowd.
Then rewrite the sentence, changing only the reference and words grammar forces (a/an, plurals, possessives). Keep the writer's voice. Never add jokes, words or punctuation of your own.
If no candidate fits the line, set pick to -1 and keep the sentence unchanged.
Reply with JSON only: {"pick": number, "sentence": string, "why": string}. "why" is one short plain sentence for the writer, under 20 words.`;

export const llmDecider: Decider = async ({ sentence, surface, entity, city, candidates }) => {
  const list = candidates
    .map(
      (c, i) =>
        `${i}. ${c.entity.name} (${TYPE_LABEL[c.entity.type]}${c.entity.tags.length ? `; ${c.entity.tags.slice(0, 3).map((t) => t.name).join(", ")}` : ""}) #${c.score.rank} of ${c.score.of} cities for ${city}`,
    )
    .join("\n");
  const user = `City: ${city}\nSentence: ${sentence}\nReference that won't land: ${surface} (${TYPE_LABEL[entity.type]})\nCandidates:\n${list}`;
  const { data, model } = await chatJSON<{ pick?: unknown; sentence?: unknown; why?: unknown }>(SYSTEM, user);
  const pick = Number(data.pick);
  if (!Number.isInteger(pick) || pick < -1 || pick >= candidates.length) return null;
  return {
    pick,
    sentence: typeof data.sentence === "string" ? data.sentence.trim() : sentence,
    why: typeof data.why === "string" ? data.why.trim() : "",
    by: model.split("/").pop() ?? model,
  };
};

/**
 * The "Fix my set" agent. Check, pick the next reference that dies here, get
 * local swaps from Qloo, decide (LLM if configured, rules otherwise), rewrite
 * the sentence, re-check, repeat.
 */
export async function fixSet(
  text: string,
  room: Room,
  opts: { decide?: Decider; onStep?: (s: FixStep) => void; maxSteps?: number } = {},
): Promise<{ text: string; result: CheckResult; swapped: number }> {
  const decide = opts.decide ?? (llmConfigured() ? llmDecider : rulesDecider);
  const emit = opts.onStep ?? (() => {});
  const tried = new Set<string>();
  let swapped = 0;
  let result = await checkText(text, [room]);
  const verdict = (r: CheckResult["references"][number]) => r.scores[0]?.verdict;
  emit({ kind: "plan", red: result.references.filter((r) => verdict(r) === "red").length, total: result.references.length, city: room.city });

  for (let step = 0; step < (opts.maxSteps ?? 6); step++) {
    const target = result.references.find((r) => verdict(r) === "red" && !tried.has(r.entity.qlooId));
    if (!target) break;
    tried.add(target.entity.qlooId);

    const candidates = await findSwaps(target.entity, room, 5);
    if (candidates.length === 0) {
      emit({ kind: "keep", surface: target.surface, why: `No well-known ${TYPE_LABEL[target.entity.type].toLowerCase()} in the same vein ranks well in ${room.city}.`, by: "qloo" });
      continue;
    }

    const span = sentenceAround(text, target.start, target.end);
    const sentence = text.slice(span.start, span.end);
    const paragraphBefore = paragraphAround(text, target.start, target.end);
    const input: DecisionInput = { sentence, surface: target.surface, entity: target.entity, city: room.city, candidates };

    let decision: Decision | null = null;
    try {
      decision = await decide(input);
    } catch {
      decision = null; // LLM down or out of quota: fall through to rules
    }
    if (decision && decision.pick >= 0 && !rewriteIsFaithful(sentence, decision.sentence, target.surface, candidates[decision.pick].entity.name)) {
      decision = null;
    }
    if (decision && decision.pick === -1) {
      emit({ kind: "keep", surface: target.surface, why: decision.why || "None of the local swaps fit this line.", by: decision.by });
      continue;
    }
    decision ??= await rulesDecider(input);
    if (!decision) continue;

    const pick = candidates[decision.pick];
    text = text.slice(0, span.start) + decision.sentence + text.slice(span.end);
    swapped++;
    emit({
      kind: "swap",
      surface: target.surface,
      to: pick.entity.name,
      rank: pick.score.rank,
      of: pick.score.of,
      why: decision.why,
      by: decision.by,
      before: sentence,
      after: decision.sentence,
      note: noteFor(paragraphBefore, room.city),
    });
    result = await checkText(text, [room]);
  }

  emit({ kind: "done", text, result, swapped });
  return { text, result, swapped };
}
