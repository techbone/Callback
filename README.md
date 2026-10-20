# Callback

A spell-checker for cultural references. Paste a stand-up set, toast, keynote or sales pitch, pick the room (city and age band), and every reference is underlined:

- **Green, solid**: this crowd knows it and likes it more than the country does.
- **Yellow, dashed**: they know it, but they're no keener than anyone else.
- **Red, wavy**: it will die here. Click it to see local swaps from the same category, and replace it in one click.

A **Crowd Card** beside the editor lists what the room loves right now, for openers and crowd work.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

**Live demo:** _coming with the first deploy_

## How it works

1. **Find the references.** Capitalised phrases are pulled from the text and resolved with Qloo `/search` (brands, TV, film, music, people, podcasts, games and books). No LLM is involved.
2. **Rank the city.** For each reference, Qloo `/v2/insights` gives its affinity in a pool of 8 US cities (`signal.location` as a map point). A reference **lands** when it's widely known and this city ranks near the top of the pool for it. It **dies** when this city sits well below the rest.
3. **Apply the age band.** Age is scored separately (`signal.demographics.age`). A weak fit stops a reference being a sure thing.
4. **Swap.** For a weak reference, Qloo suggests similar entities near the city (`signal.interests.entities`), and each one is ranked the same way before it's offered.
5. **Crowd Card.** What the city over-indexes on right now, with TV biased toward trending (`bias.trends`).

A plain LLM can only guess clichés. Qloo knows that Wawa is #1 in New York and dies in Atlanta, and that Waffle House is Atlanta's while Boston doesn't care.

### An honest limitation

Qloo affinity measures *liking*, not *recognition*. "Lands" is a proxy: popularity says people probably know it, and the city rank says this room likes it more than most. The numbers are shown on every underline. A few famous entities (*The Office*, Drake) have no city-level data in Qloo; they're marked grey rather than guessed.

## Status

| Piece | State |
|---|---|
| Editor, underlines, swap popover, Crowd Card | Working on live Qloo data |
| Tour mode, share links | Working |
| Reference extraction | Working, with no LLM (Qloo search) |
| "Fix my set" agent (free LLM on Groq, rules fallback) | Working |
| MCP server for Claude Desktop, Cursor and other agents | Planned |

Qloo's hackathon key allows 10,000 calls a month, so responses are cached per entity and city, and `src/lib/qloo/seed.json` ships a snapshot that covers the examples.

## Run locally

```bash
npm install
cp .env.example .env.local   # all keys are optional
npm run dev
```

With no keys it runs on invented demo fixtures. Add `QLOO_API_KEY` for live Qloo scoring (hackathon keys only work against `https://hackathon.api.qloo.com`). In development, Qloo responses are cached in `.cache/qloo.json` so restarts don't spend quota.

```bash
npm test        # unit and pipeline tests; live Qloo tests run only when QLOO_API_KEY is set
npm run typecheck
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and milestone plan.

## License

MIT
