import type { CityRow } from "@/lib/types";

const BAR: Record<CityRow["verdict"], string> = { green: "bg-green", yellow: "bg-yellow", red: "bg-red" };

/** One reference ranked across the city pool, from the same Qloo data as the verdict. */
export function WhereItLands({ rows, city }: { rows: CityRow[]; city: string }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.lift));
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Where it lands</p>
      <ol className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.city} className={`grid grid-cols-[18px_88px_1fr] items-center gap-2 text-xs ${r.city === city ? "font-semibold text-ink" : "text-muted"}`}>
            <span className="tnum text-right">{r.rank}</span>
            <span className="truncate">{r.city}</span>
            <span className="h-1.5 rounded-full bg-line">
              <span className={`block h-full rounded-full ${BAR[r.verdict]} ${r.city === city ? "" : "opacity-60"}`} style={{ width: `${Math.max(6, (r.lift / max) * 100)}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
