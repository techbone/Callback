import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { FIXTURES } from "../qloo/fixtures";
import { QLOO_TYPES, type QlooType } from "../types";

export type RawReference = { surface: string; guessedType: QlooType; roleInLine: string };
export type Span = RawReference & { start: number; end: number };

const ExtractionSchema = z.object({
  references: z.array(
    z.object({
      surface: z.string().describe("The reference exactly as written in the text, a verbatim substring"),
      guessedType: z.enum(QLOO_TYPES),
      roleInLine: z
        .string()
        .describe("Short note on the job this reference does in its line, e.g. 'punchline target' or 'shorthand for cheap'"),
    }),
  ),
});

const SYSTEM = `You find cultural references in text written for a live audience (stand-up, toasts, keynotes, ad copy, sales pitches).

A cultural reference is a named, real-world thing the audience is expected to recognise: a brand, restaurant chain, TV show, movie, musician, public figure, sports venue, game, book, podcast, or travel destination.

Rules:
- surface must be an exact substring of the text, copied character for character.
- Skip generic nouns ("coffee", "a movie"), the speaker's own friends and family, and the city the speaker is in unless it is clearly being used as a reference to something else (a TV show, a team).
- Do not list the same surface twice.
- If there are no references, return an empty list.`;

export async function extractWithClaude(text: string): Promise<RawReference[]> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: process.env.CALLBACK_EXTRACT_MODEL ?? "claude-haiku-5-5",
    max_tokens: 4000,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  return response.parsed_output?.references ?? [];
}

/** Keyword fallback used when no ANTHROPIC_API_KEY is set. Matches demo fixture names only. */
export function extractWithLexicon(text: string): RawReference[] {
  const out: RawReference[] = [];
  const seen = new Set<string>();
  for (const x of FIXTURES) {
    if (x.ambiguous) continue;
    for (const name of [x.name, ...(x.aliases ?? [])]) {
      const re = new RegExp(`(?<![\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`);
      const m = re.exec(text);
      if (m && !seen.has(m[0])) {
        seen.add(m[0]);
        out.push({ surface: m[0], guessedType: x.type, roleInLine: "reference" });
      }
    }
  }
  return out;
}

export async function extractReferences(text: string): Promise<RawReference[]> {
  if (process.env.ANTHROPIC_API_KEY) return extractWithClaude(text);
  return extractWithLexicon(text);
}

/** Turn surfaces into non-overlapping spans, one per occurrence in the text. */
export function locateSpans(text: string, refs: RawReference[]): Span[] {
  const spans: Span[] = [];
  for (const ref of refs) {
    if (!ref.surface) continue;
    let from = 0;
    for (;;) {
      const i = text.indexOf(ref.surface, from);
      if (i < 0) break;
      spans.push({ ...ref, start: i, end: i + ref.surface.length });
      from = i + ref.surface.length;
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const s of spans) {
    if (kept.length && s.start < kept[kept.length - 1].end) continue;
    kept.push(s);
  }
  return kept;
}
