import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { flushDisk } from "../qloo/store";
import { fixSet, type FixStep } from "./fix";

// Live Qloo + live LLM. Writes .cache/fix-report.txt
describe.runIf(!!process.env.QLOO_API_KEY && !!process.env.LLM_API_KEY)("fixSet (live)", () => {
  it("fixes the stand-up set for Atlanta and Boston", { timeout: 300_000 }, async () => {
    const p = PRESETS[0];
    const lines: string[] = [];
    for (const city of ["Atlanta", "Boston"]) {
      const steps: FixStep[] = [];
      const out = await fixSet(p.text, { city, age: "any" }, { onStep: (s) => steps.push(s) });
      lines.push(`== ${city}`);
      for (const s of steps) {
        if (s.kind === "plan") lines.push(`plan: ${s.red} of ${s.total} die in ${s.city}`);
        if (s.kind === "swap") lines.push(`swap [${s.by}]: ${s.surface} -> ${s.to} (#${s.rank}/${s.of}) — ${s.why}\n   before: ${s.before}\n   after:  ${s.after}`);
        if (s.kind === "keep") lines.push(`keep [${s.by}]: ${s.surface} — ${s.why}`);
        if (s.kind === "done") lines.push(`done: ${s.swapped} swapped; reds left: ${s.result.references.filter((r) => r.scores[0]?.verdict === "red").map((r) => r.surface).join(", ") || "none"}`);
      }
      expect(out.text.length).toBeGreaterThan(0);
    }
    writeFileSync(".cache/fix-report.txt", lines.join("\n") + "\n");
    await flushDisk();
  });
});
