# Devpost submission text: Callback

Paste-ready. Fill in the two links at the top.

- **Live demo:** https://callback-ecru-one.vercel.app
- **Repo:** https://github.com/techbone/Callback
- **MCP endpoint (add as a custom connector):** https://callback-ecru-one.vercel.app/api/mcp

---

## Tagline

A spell-checker for cultural references. Paste what you're about to say; Callback underlines every reference by whether this room will get it.

## Inspiration

Every comic, best man, keynote speaker and sales rep has made a reference that went silent. The reference was fine. The room was wrong. A Dunkin' joke works in Boston and dies in Houston. Nobody can tell you that in advance, and an LLM can only guess clichés ("deep dish for Chicago"). Qloo can actually answer it, because it measures what a specific place and age group over-indexes on.

## What it does

You paste anything written for an audience (a stand-up set, a toast, a pitch), pick a city and an age band, and every cultural reference is underlined:

- **Green, solid:** this city is one of the ones that likes it most.
- **Yellow, dashed:** everyone knows it, and it plays about the same everywhere.
- **Red, wavy:** this city is one of the ones that likes it least.
- **Grey, dotted:** Qloo has no city data for it, so we say so instead of guessing.

Click any underline to see why: its rank among 8 US cities, a bar chart of where it lands, how each age band takes to it, and (for the weak ones) same-category swaps this city loves, with the Qloo tags they share. One click swaps it in and re-checks.

Beyond that:

- **Fix my set**, an agent that works through everything that dies in the room, picks the swap that fits each joke (a quarterback for a line about throwing, not a running back), rewrites only that sentence, re-checks, and shows every step. It warns when a swap sits in a paragraph about another city.
- **Tour mode**: one set against up to 6 cities, as a reference × city grid with "keep" or "swap in Atlanta, Boston" per row.
- **Crowd Card**: what the city over-indexes on right now (TV biased toward trending), for openers and crowd work.
- **An MCP server** with six tools, two prompts and two resources, so Claude Desktop, Cursor or any MCP client can check and fix text with the same Qloo-backed scoring.
- **A Qloo receipt** under every check shows exactly which endpoints and signals were used and how many were live calls versus cache.

## How we built it (and how it uses Qloo)

The scoring is Qloo end to end, with no LLM involved.

1. **Find references.** Capitalised phrases are extracted and resolved with Qloo `/search` across brand, TV, film, music, people, podcast, game and book entities. No LLM is needed, which makes it fast and free to run.
2. **Rank the city.** `/v2/insights` with `filter.results.entities` and `signal.location` (a map point, 40 km radius) returns each entity's affinity in 8 cities. Qloo affinities bunch near 1 (0.96 vs 0.9998), so we stretch them with −log10(1 − a) and rank the room's city against the pool. A reference lands when it's widely known *and* the city ranks near the top.
3. **Apply age.** `signal.demographics.age` is scored on its own, because combined with location it drowns out the city.
4. **Swaps.** `signal.interests.entities` seeded with the original, near the city, then every candidate is re-ranked the same way before it's offered, so a swap is never worse than what it replaces.
5. **Crowd Card.** `signal.location`, `bias.trends` for TV and `filter.location` for places.

The agent loop is plain code. A free OpenAI-compatible model (Groq's `gpt-oss-120b`) makes the judgement calls Qloo can't: does this swap fit the line, and what's the rewritten sentence. Rewrites that drift from the writer's words are rejected, and if the model fails or runs out of quota, rules take over, so the demo never breaks.

Stack: Next.js 15, TypeScript, CodeMirror 6, Tailwind, MCP SDK v2 with `mcp-handler`, deployed on Vercel. Scoring thresholds are pinned by tests on real Qloo numbers.

## Challenges

- **Qloo has no national baseline.** An insights call with no signal returns no affinity at all, so we can't say "Atlanta is 2.6× the national average". We rank a city against a pool of cities instead.
- **Location queries silently drop entities.** `signal.location.query=Atlanta` returned nothing for Starbucks; a map point with a radius doesn't.
- **Age swamps location** when both signals are sent together, so we score them separately and let age only knock a green down to yellow.
- **A 10,000-call monthly quota** shared by development and judging. Every entity/city pair is cached once, a snapshot of live responses ships with the app so the examples cost nothing, and a guard stops making new calls before the quota is gone.
- **Some famous entities have no city data** (*The Office*, Drake). We mark them grey.

## Accomplishments

- It's an editor, not a report page: you see the verdict in your own text.
- Every number on screen traces to a Qloo call, and the receipt proves it.
- The same engine works three ways: the web app, an agent that fixes your set, and an MCP server other agents can call.
- It works end to end on a free model with no paid APIs.

## What we learned

Liking isn't recognition. Qloo measures what a place loves, and "will it land" is a proxy for that: popularity says people probably know it, and the city rank says this room likes it more than most. We say that plainly in the app, and we show the numbers behind every underline.

## What's next

More cities and a venue-level signal; a Google Docs add-on; per-city "house style" for recurring shows; letting a comic save a set and see it re-ranked as the Qloo data moves.

## Built with

Qloo Taste AI API (`/search`, `/v2/insights`: `filter.results.entities`, `signal.location`, `signal.demographics.age`, `signal.interests.entities`, `bias.trends`, `filter.location`), Next.js, TypeScript, CodeMirror, Tailwind CSS, Model Context Protocol, Groq (gpt-oss-120b), Vercel.

## Try it

1. Open the demo. The stand-up set loads in Atlanta. Waffle House, Outkast and *P-Valley* are green; Tom Brady and Wawa are red.
2. Switch the city to Boston. It nearly inverts.
3. Click **Tom Brady**, look at the city bars, take a swap.
4. Click **Fix my set** and watch the agent work.
5. Switch to **Tour** and add Chicago, Denver and Houston.
6. Optional: add the MCP endpoint as a custom connector in Claude and ask "Will this set work in Houston? Fix whatever dies."
