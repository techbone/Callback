import { describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { flushDisk } from "../qloo/store";
import { checkText, findSwaps } from "./check";
import { writeFileSync } from "node:fs";

// Hits the real Qloo API. Run with: QLOO_API_KEY=... npx vitest run check.live
describe.runIf(!!process.env.QLOO_API_KEY)("checkText (live Qloo)", () => {
  it("scores the stand-up set in Atlanta and Boston", { timeout: 120_000 }, async () => {
    const p = PRESETS.find((x) => x.id === "standup")!;
    const res = await checkText(p.text, [p.room, { city: "Boston", age: p.room.age }]);
    expect(res.source).toBe("live");
    const rows = res.references.map((r) => {
      const [atl, bos] = [r.scores.find((s) => s.roomKey.startsWith("Atlanta|")), r.scores.find((s) => s.roomKey.startsWith("Boston|"))];
      const f = (s?: typeof atl) => (s ? `${s.verdict.padEnd(6)} #${s.rank}/${s.of} ${s.lift.toFixed(2)}x age:${s.ageFit ?? "-"}` : "no data                    ");
      return `${r.surface.padEnd(18)} ${r.entity.name.slice(0, 18).padEnd(19)} ${r.entity.type.padEnd(8)} pop ${r.entity.popularity.toFixed(2)} | ATL ${f(atl)} | BOS ${f(bos)}`;
    });
    const report = [rows.join("\n")];
    expect(res.references.length).toBeGreaterThan(4);

    const waffle = res.references.find((r) => r.surface === "Waffle House");
    if (waffle) {
      const swaps = await findSwaps(waffle.entity, { city: "Boston", age: p.room.age });
      report.push("Waffle House swaps in Boston: " + swaps.map((s) => `${s.entity.name} (${s.score.verdict} #${s.score.rank}, ${s.score.lift.toFixed(2)}x)`).join(", "));
    }
    writeFileSync(".cache/live-report.txt", report.join("\n") + "\n");
    await flushDisk();
  });
});
