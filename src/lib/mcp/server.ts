import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { checkText, findSwaps, resolveName, whereItLands } from "../agent/check";
import { fixSet } from "../agent/fix";
import { CITY_NAMES, POOL } from "../cities";
import { TYPE_LABEL } from "../labels";
import { getQloo } from "../qloo";
import { ageFit, explain, explainAge, THRESHOLDS, AGE_THRESHOLDS } from "../scoring";
import { AGE_BANDS, AGE_LABELS, type AgeBand, type QlooType, type Reference, type Room, type Score, type Verdict } from "../types";

export const INSTRUCTIONS = `Callback tells you whether the cultural references in a piece of writing (a stand-up set, toast, keynote, sales pitch, ad) will land with a live audience in a specific US city, using Qloo's taste data rather than guesses.

How to use it:
- check_references: underline every reference in a text for one city and age band. Verdicts: lands, shaky, dies, no_data.
- find_local_swaps: for a reference that dies or is shaky, get same-category replacements that city ranks highly. Pick the one that keeps the line's meaning (a quarterback for a joke about throwing), then rewrite only that reference.
- compare_cities: the same text across up to 6 cities (a tour).
- where_it_lands: one reference ranked across all cities, plus which age bands like it.
- crowd_card: what a city over-indexes on, for openers and crowd work.
- fix_set: let Callback's own agent swap everything that dies and return the rewritten text.

Rules: swaps are scored for one city only, so read the sentence around each swap: if it is about somewhere else or sets up a story ("back home in Boston"), say so and offer to adjust the setup. Only cite rankings that a tool returned. "Lands" means widely known and this city ranks near the top of ${POOL.length} US cities for it on Qloo affinity. Qloo measures liking, not recognition, so present verdicts as strong estimates. Never rewrite more of the user's text than the reference itself and the grammar around it.`;

const VERDICT_WORD: Record<Verdict, "lands" | "shaky" | "dies"> = { green: "lands", yellow: "shaky", red: "dies" };

const City = z.enum(CITY_NAMES as [string, ...string[]]).describe(`US city the audience is in. One of: ${CITY_NAMES.join(", ")}.`);
const Age = z
  .enum(AGE_BANDS)
  .default("any")
  .describe("Audience age band (Qloo demographics): any, 35_and_younger, 36_to_55 or 55_and_older.");
const Text = z.string().min(1).max(8000).describe("The writing to check, exactly as it will be said.");

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: true } as const;

function referenceRow(r: Reference, score: Score | undefined, room: Room) {
  if (!score) {
    const fit = ageFit(r.age, room.age);
    return {
      text: r.surface,
      entity: r.entity.name,
      type: TYPE_LABEL[r.entity.type],
      verdict: "no_data" as const,
      why: `Qloo has no city-level data for it. ${explainAge(fit, room.age)}`.trim(),
    };
  }
  return {
    text: r.surface,
    entity: r.entity.name,
    type: TYPE_LABEL[r.entity.type],
    verdict: VERDICT_WORD[score.verdict],
    cityRank: score.rank,
    citiesCompared: score.of,
    vsTypicalCity: Number(score.lift.toFixed(2)),
    popularity: Number(score.known.toFixed(2)),
    ...(score.ageFit ? { ageFit: score.ageFit } : {}),
    why: `${explain(score.known, score, score.placeVerdict, room.city)} ${explainAge(score.ageFit, room.age)}`.trim(),
  };
}

const RefRow = z.object({
  text: z.string(),
  entity: z.string(),
  type: z.string(),
  verdict: z.enum(["lands", "shaky", "dies", "no_data"]),
  cityRank: z.number().optional(),
  citiesCompared: z.number().optional(),
  vsTypicalCity: z.number().optional(),
  popularity: z.number().optional(),
  ageFit: z.enum(["strong", "neutral", "weak"]).optional(),
  why: z.string(),
});

const ICON: Record<string, string> = { lands: "✅", shaky: "🟡", dies: "❌", no_data: "▫️" };
const line = (r: z.infer<typeof RefRow>) =>
  `${ICON[r.verdict]} ${r.text}${r.entity !== r.text ? ` (${r.entity})` : ""}: ${r.verdict}${r.cityRank ? `, #${r.cityRank} of ${r.citiesCompared}` : ""}. ${r.why}`;

export function registerCallback(server: McpServer) {
  server.registerTool(
    "check_references",
    {
      title: "Check references for a room",
      description:
        "Find every cultural reference (brands, TV, film, music, people, podcasts, games, books) in the text and say whether it lands with an audience in this city and age band. Each reference is resolved with Qloo search and ranked against " +
        `${POOL.length} US cities on Qloo affinity (signal.location), with Qloo's age signal (signal.demographics.age) applied on top.`,
      inputSchema: z.object({ text: Text, city: City, age: Age }),
      outputSchema: z.object({
        city: z.string(),
        age: z.string(),
        summary: z.object({ lands: z.number(), shaky: z.number(), dies: z.number(), noData: z.number() }),
        references: z.array(RefRow),
      }),
      annotations: READ_ONLY,
    },
    async ({ text, city, age }) => {
      const room: Room = { city, age: age as AgeBand };
      const res = await checkText(text, [room]);
      const references = res.references.map((r) => referenceRow(r, r.scores[0], room));
      const count = (v: string) => references.filter((r) => r.verdict === v).length;
      const out = {
        city,
        age: AGE_LABELS[room.age],
        summary: { lands: count("lands"), shaky: count("shaky"), dies: count("dies"), noData: count("no_data") },
        references,
      };
      const text_ =
        references.length === 0
          ? "No cultural references found."
          : `${city}, ${AGE_LABELS[room.age]}: ${out.summary.lands} land, ${out.summary.shaky} shaky, ${out.summary.dies} die.\n\n${references.map(line).join("\n")}`;
      return { content: [{ type: "text", text: text_ }], structuredContent: out };
    },
  );

  server.registerTool(
    "find_local_swaps",
    {
      title: "Find local swaps",
      description:
        "Same-category replacements for a reference that this city ranks highly. Candidates come from Qloo insights seeded with the original (signal.interests.entities) near the city, then each is ranked across the city pool the same way check_references does. Returns up to 5, best first.",
      inputSchema: z.object({
        reference: z.string().min(2).max(120).describe('The reference as written, e.g. "Tom Brady" or "Waffle House".'),
        city: City,
        age: Age,
      }),
      outputSchema: z.object({
        reference: z.object({ name: z.string(), type: z.string() }),
        city: z.string(),
        swaps: z.array(
          z.object({ name: z.string(), type: z.string(), verdict: z.enum(["lands", "shaky", "dies"]), cityRank: z.number(), citiesCompared: z.number(), vsTypicalCity: z.number(), sharedTags: z.array(z.string()) }),
        ),
      }),
      annotations: READ_ONLY,
    },
    async ({ reference, city, age }) => {
      const entity = await resolveName(reference);
      if (!entity) return { content: [{ type: "text", text: `Qloo has no well-known match for "${reference}".` }], isError: true };
      const swaps = await findSwaps(entity, { city, age: age as AgeBand }, 5);
      const mine = new Set(entity.tags.map((t) => t.id));
      const out = {
        reference: { name: entity.name, type: TYPE_LABEL[entity.type] },
        city,
        swaps: swaps.map((s) => ({
          name: s.entity.name,
          type: TYPE_LABEL[s.entity.type],
          verdict: VERDICT_WORD[s.score.verdict],
          cityRank: s.score.rank,
          citiesCompared: s.score.of,
          vsTypicalCity: Number(s.score.lift.toFixed(2)),
          sharedTags: s.entity.tags.filter((t) => mine.has(t.id)).map((t) => t.name).slice(0, 3),
        })),
      };
      const text =
        out.swaps.length === 0
          ? `No well-known ${out.reference.type.toLowerCase()} similar to ${entity.name} ranks well in ${city}. Consider keeping it or cutting the line.`
          : `Swaps for ${entity.name} in ${city}:\n${out.swaps.map((s, i) => `${i + 1}. ${s.name}: ${s.verdict}, #${s.cityRank} of ${s.citiesCompared}${s.sharedTags.length ? ` (shares: ${s.sharedTags.join(", ")})` : ""}`).join("\n")}`;
      return { content: [{ type: "text", text }], structuredContent: out };
    },
  );

  server.registerTool(
    "compare_cities",
    {
      title: "Compare a set across cities",
      description: "Check the same text in up to 6 cities at once (a tour). For each reference, the verdict and rank per city, and which cities need a swap.",
      inputSchema: z.object({ text: Text, cities: z.array(City).min(2).max(6).describe("Tour stops."), age: Age }),
      outputSchema: z.object({
        cities: z.array(z.string()),
        references: z.array(
          z.object({
            entity: z.string(),
            perCity: z.array(z.object({ city: z.string(), verdict: z.enum(["lands", "shaky", "dies", "no_data"]), cityRank: z.number().optional() })),
            swapIn: z.array(z.string()),
          }),
        ),
      }),
      annotations: READ_ONLY,
    },
    async ({ text, cities, age }) => {
      const rooms: Room[] = cities.map((city) => ({ city, age: age as AgeBand }));
      const res = await checkText(text, rooms);
      const seen = new Set<string>();
      const references = res.references
        .filter((r) => !seen.has(r.entity.qlooId) && seen.add(r.entity.qlooId))
        .map((r) => {
          const perCity = cities.map((city) => {
            const s = r.scores.find((x) => x.roomKey.startsWith(`${city}|`));
            return s ? { city, verdict: VERDICT_WORD[s.verdict], cityRank: s.rank } : { city, verdict: "no_data" as const };
          });
          return { entity: r.entity.name, perCity, swapIn: perCity.filter((c) => c.verdict === "dies").map((c) => c.city) };
        });
      const text_ = references
        .map((r) => `${r.entity}: ${r.perCity.map((c) => `${c.city} ${c.verdict}${c.cityRank ? ` #${c.cityRank}` : ""}`).join(" · ")}${r.swapIn.length ? ` → swap in ${r.swapIn.join(", ")}` : " → keep"}`)
        .join("\n");
      return { content: [{ type: "text", text: text_ || "No cultural references found." }], structuredContent: { cities, references } };
    },
  );

  server.registerTool(
    "where_it_lands",
    {
      title: "Where a reference lands",
      description: `Rank one reference across all ${POOL.length} pool cities on Qloo affinity, and show which age bands like it (Qloo demographics). Use it to decide where a bit will work before writing it.`,
      inputSchema: z.object({ reference: z.string().min(2).max(120).describe('e.g. "Portillo\'s" or "Yellowstone".') }),
      outputSchema: z.object({
        entity: z.object({ name: z.string(), type: z.string(), popularity: z.number() }),
        cities: z.array(z.object({ city: z.string(), rank: z.number(), verdict: z.enum(["lands", "shaky", "dies"]), vsTypicalCity: z.number() })),
        ages: z.array(z.object({ band: z.string(), affinity: z.number(), fit: z.enum(["strong", "neutral", "weak"]) })),
      }),
      annotations: READ_ONLY,
    },
    async ({ reference }) => {
      const entity = await resolveName(reference);
      if (!entity) return { content: [{ type: "text", text: `Qloo has no well-known match for "${reference}".` }], isError: true };
      const { cities, age } = await whereItLands(entity);
      const ages = (["35_and_younger", "36_to_55", "55_and_older"] as const).flatMap((band) => {
        const a = age[band];
        return a == null ? [] : [{ band: AGE_LABELS[band], affinity: Number(a.toFixed(3)), fit: (ageFit(age, band) ?? "neutral") as "strong" | "neutral" | "weak" }];
      });
      const out = {
        entity: { name: entity.name, type: TYPE_LABEL[entity.type], popularity: Number(entity.popularity.toFixed(2)) },
        cities: cities.map((c) => ({ city: c.city, rank: c.rank, verdict: VERDICT_WORD[c.verdict], vsTypicalCity: Number(c.lift.toFixed(2)) })),
        ages,
      };
      const text =
        cities.length === 0
          ? `Qloo has no city-level data for ${entity.name}.${ages.length ? ` Age: ${ages.map((a) => `${a.band} ${a.fit}`).join(", ")}.` : ""}`
          : `${entity.name} (${out.entity.type}) across ${cities.length} cities:\n${out.cities.map((c) => `#${c.rank} ${c.city}: ${c.verdict} (${c.vsTypicalCity}× typical)`).join("\n")}${ages.length ? `\nAge: ${ages.map((a) => `${a.band} ${a.fit}`).join(", ")}` : ""}`;
      return { content: [{ type: "text", text }], structuredContent: out };
    },
  );

  server.registerTool(
    "crowd_card",
    {
      title: "Crowd card",
      description:
        "What an audience in this city over-indexes on right now, by category: TV (biased toward trending with Qloo bias.trends), artists, brands, people and local places (filter.location). Material for openers and crowd work.",
      inputSchema: z.object({ city: City }),
      outputSchema: z.object({ city: z.string(), categories: z.array(z.object({ category: z.string(), items: z.array(z.string()) })) }),
      annotations: READ_ONLY,
    },
    async ({ city }) => {
      const qloo = getQloo();
      const types: QlooType[] = ["tv_show", "artist", "brand", "person", "place"];
      const lists = await Promise.all(types.map((t) => qloo.crowd(t, { city, age: "any" }, 5)));
      const categories = types.map((t, i) => ({ category: TYPE_LABEL[t], items: lists[i].map((e) => e.name) })).filter((c) => c.items.length);
      const text = `What ${city} loves:\n${categories.map((c) => `${c.category}: ${c.items.join(", ")}`).join("\n")}`;
      return { content: [{ type: "text", text }], structuredContent: { city, categories } };
    },
  );

  server.registerTool(
    "fix_set",
    {
      title: "Fix a set for a room",
      description:
        "Run Callback's agent: for every reference that dies in this city, fetch local swaps from Qloo, pick the one that fits the line, rewrite only that sentence, and re-check. Returns the rewritten text and each step. Does not change anything outside the response.",
      inputSchema: z.object({ text: Text, city: City, age: Age }),
      outputSchema: z.object({
        text: z.string(),
        swapped: z.number(),
        steps: z.array(z.object({ action: z.enum(["swap", "keep"]), reference: z.string(), replacement: z.string().optional(), why: z.string(), caution: z.string().optional() })),
        stillDies: z.array(z.string()),
      }),
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ text, city, age }) => {
      const steps: { action: "swap" | "keep"; reference: string; replacement?: string; why: string; caution?: string }[] = [];
      const out = await fixSet(text, { city, age: age as AgeBand }, {
        onStep: (s) => {
          if (s.kind === "swap") steps.push({ action: "swap", reference: s.surface, replacement: s.to, why: s.why, ...(s.note ? { caution: s.note } : {}) });
          if (s.kind === "keep") steps.push({ action: "keep", reference: s.surface, why: s.why });
        },
      });
      const stillDies = out.result.references.filter((r) => r.scores[0]?.verdict === "red").map((r) => r.surface);
      const summary = steps.map((s) => (s.action === "swap" ? `${s.reference} → ${s.replacement}: ${s.why}${s.caution ? ` ⚠ ${s.caution}` : ""}` : `kept ${s.reference}: ${s.why}`)).join("\n");
      return {
        content: [{ type: "text", text: `${out.swapped} swapped for ${city}.${summary ? `\n${summary}` : ""}\n\n${out.text}` }],
        structuredContent: { text: out.text, swapped: out.swapped, steps, stillDies },
      };
    },
  );

  server.registerPrompt(
    "localize_set",
    {
      title: "Localize a set for a city",
      description: "Adapt a set's references for one city, citing Qloo rankings for every change.",
      argsSchema: z.object({ text: z.string().describe("The set or speech."), city: z.string().describe(`One of: ${CITY_NAMES.join(", ")}`) }),
    },
    ({ text, city }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I'm performing this in ${city}. Use Callback's tools:
1. Run check_references on the text for ${city}.
2. For every reference that dies (and any shaky one central to a joke), run find_local_swaps and choose the replacement that keeps the joke's meaning and rhythm.
3. Rewrite only those references and the grammar around them; keep every other word.
4. Run check_references again on the new text to confirm.
5. Show a before/after table with each swap's ${city} rank from the tools, then the final text.

Text:
${text}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan_tour",
    {
      title: "Plan a tour",
      description: "Check one set across tour stops and list the per-city swaps.",
      argsSchema: z.object({ text: z.string().describe("The set."), cities: z.string().describe("Comma-separated tour stops, 2 to 6 of the supported cities.") }),
    },
    ({ text, cities }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Tour stops: ${cities}. Run compare_cities on this set. Then for each city, list the references that die there and suggest a swap for each with find_local_swaps. Finish with a short "keep everywhere" list.\n\nSet:\n${text}`,
          },
        },
      ],
    }),
  );

  server.registerResource(
    "method",
    "callback://method",
    { title: "How Callback scores references", description: "The scoring method, thresholds and limits.", mimeType: "text/markdown" },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `# How Callback scores references

1. **Resolve**: Qloo /search (brands, TV, film, music, people, podcasts, games, books).
2. **Rank the city**: Qloo /v2/insights with filter.results.entities and signal.location (a map point, 40 km radius) in ${POOL.length} cities: ${POOL.join(", ")}. Affinities are stretched with -log10(1 - a) and the room's city is ranked against the pool.
3. **Verdict**: dies if popularity < ${THRESHOLDS.knownLo}; shaky if it plays the same everywhere (affinity range < ${THRESHOLDS.flat}); lands if in the top ${THRESHOLDS.topShare * 100}% of cities, ${THRESHOLDS.liftHi}× the median city and popularity ≥ ${THRESHOLDS.knownHi}; dies if in the bottom ${(1 - THRESHOLDS.bottomShare) * 100}% and below the median, or under ${THRESHOLDS.farBelowTop * 100}% of the top city's strength; shaky otherwise.
4. **Age**: Qloo signal.demographics.age on its own. Affinity ≥ ${AGE_THRESHOLDS.strong} is a strong fit, < ${AGE_THRESHOLDS.weak} weak; weak turns "lands" into "shaky".
5. **Swaps**: Qloo insights seeded with the original (signal.interests.entities) near the city, then ranked the same way.

Limits: Qloo measures liking, not recognition. Some famous entities carry no city-level data and are reported as no_data.`,
        },
      ],
    }),
  );

  server.registerResource(
    "cities",
    "callback://cities",
    { title: "Supported cities", description: "Cities you can check against, and the comparison pool.", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify({ cities: CITY_NAMES, comparisonPool: POOL, ageBands: AGE_BANDS }) }] }),
  );
}
