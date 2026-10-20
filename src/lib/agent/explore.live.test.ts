import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { flushDisk } from "../qloo/store";
import { checkText } from "./check";

// Exploration only: which references carry city data, and where they land. Writes .cache/explore.txt
describe.runIf(!!process.env.QLOO_API_KEY && !!process.env.EXPLORE)("explore references (live)", () => {
  it("scores a batch of candidates", { timeout: 300_000 }, async () => {
    const names = (process.env.EXPLORE ?? "").split("|");
    const text = names.map((n) => `we talked about ${n} again`).join(", ") + ".";
    const cities = ["Atlanta", "Boston", "Chicago", "Denver", "Houston", "New York"];
    const res = await checkText(text, cities.map((city) => ({ city, age: "any" as const })));
    const lines = res.references.map((r) => {
      const cells = cities.map((c) => {
        const s = r.scores.find((x) => x.roomKey.startsWith(`${c}|`));
        return s ? `${c.slice(0, 3)} ${s.verdict[0].toUpperCase()}#${s.rank}` : `${c.slice(0, 3)} --  `;
      });
      return `${r.surface.slice(0, 20).padEnd(21)} ${r.entity.type.padEnd(10)} ${r.entity.popularity.toFixed(2)} | ${cells.join(" ")}`;
    });
    const unresolved = names.filter((n) => !res.references.some((r) => r.surface === n));
    writeFileSync(".cache/explore.txt", lines.join("\n") + `\nunresolved: ${unresolved.join(", ")}\n`);
    await flushDisk();
  });
});
