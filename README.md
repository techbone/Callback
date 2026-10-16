# Callback

A spell-checker for cultural references. Paste a stand-up set, toast, keynote or sales pitch, pick the room (city and age band), and every reference is underlined:

- **Green, solid**: this crowd knows it and likes it more than the country does.
- **Yellow, dashed**: they know it, but they're no keener than anyone else.
- **Red, wavy**: it will die here. Click it to see local swaps from the same category, and replace it in one click.

A **Crowd Card** beside the editor lists what the room loves right now, for openers and crowd work.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

**Live demo:** _coming with the first deploy_

## How it works

1. An LLM pulls the cultural references out of your text (Claude, structured output).
2. Each reference is resolved to a Qloo entity with `/search`.
3. Entities are scored against the room in batches, one `/v2/insights` call per room and entity type, using `signal.location.query` and `signal.demographics.age`, then compared with the national baseline.
4. A reference **lands** only if it is both widely known (popularity) and loved locally (local affinity above the national baseline).
5. For weak references, the agent takes the original entity's tags and asks Qloo for same-tag entities this room over-indexes on.

A plain LLM can only guess clichés ("deep-dish for Chicago"). It can't say whether *this* reference works for *this* crowd. That comparison is what Qloo's taste graph provides.

### An honest limitation

Qloo affinity measures *liking*, not *recognition*. "Lands" is therefore a proxy: popularity says people probably know it, and local lift over the national baseline says this room likes it more than average. Both numbers are shown on every underline so you can judge for yourself.

## Status

| Piece | State |
|---|---|
| Editor, underlines, swap popover, Crowd Card | Working |
| Reference extraction (Claude) | Working; falls back to a keyword matcher without `ANTHROPIC_API_KEY` |
| Qloo scoring | **Running on built-in demo data** (labelled "Demo data" in the UI). The live client lands once the hackathon key arrives |
| Tour mode (one set across several cities) | Planned |

The demo fixtures in `src/lib/qloo/fixtures.ts` are invented numbers for development. They are not Qloo data.

## Run locally

```bash
npm install
cp .env.example .env.local   # all keys are optional
npm run dev
```

With no keys it runs on demo data and the keyword extractor. Add `ANTHROPIC_API_KEY` for real reference extraction, and `QLOO_API_KEY` for live Qloo scoring once available (hackathon keys only work against `https://hackathon.api.qloo.com`).

```bash
npm test        # unit and pipeline tests
npm run typecheck
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and milestone plan.

## License

MIT
