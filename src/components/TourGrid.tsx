import { TYPE_LABEL } from "@/lib/labels";
import type { Reference, Verdict } from "@/lib/types";

const RANK: Record<Verdict, number> = { green: 0, yellow: 1, red: 2 };
export const worst = (vs: Verdict[]): Verdict | null => vs.reduce<Verdict | null>((w, v) => (w === null || RANK[v] > RANK[w] ? v : w), null);

export function TourGrid({
  references,
  cities,
  onPick,
}: {
  references: Reference[];
  cities: string[];
  onPick: (city: string) => void;
}) {
  const rows = references.filter((r) => r.entity && r.scores.length);
  if (rows.length === 0) return null;
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            <th className="px-4 py-2.5 font-medium">Reference</th>
            {cities.map((c) => (
              <th key={c} className="px-2 py-2.5 text-center font-medium">
                <button onClick={() => onPick(c)} className="uppercase tracking-[0.08em] underline-offset-4 hover:text-ink hover:underline" title={`Open the set in ${c}`}>
                  {c}
                </button>
              </th>
            ))}
            <th className="px-4 py-2.5 font-medium">On tour</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ref) => {
            const redCities = cities.filter((c) => ref.scores.find((s) => s.roomKey.startsWith(`${c}|`))?.verdict === "red");
            return (
              <tr key={ref.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{ref.entity!.name}</span>
                  <span className="ml-2 text-xs text-muted">{TYPE_LABEL[ref.entity!.type]}</span>
                </td>
                {cities.map((c) => {
                  const s = ref.scores.find((x) => x.roomKey.startsWith(`${c}|`));
                  return (
                    <td key={c} className="px-2 py-2.5 text-center">
                      {s ? (
                        <span className={`cb-mark tnum !cursor-default px-1.5 text-xs cb-${s.verdict}`} title={`${s.verdict}: lift ${s.lift.toFixed(1)}×`}>
                          {s.lift.toFixed(1)}×
                        </span>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-xs text-muted">
                  {redCities.length > 0 ? `Swap in ${redCities.join(", ")}` : "Keep"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
