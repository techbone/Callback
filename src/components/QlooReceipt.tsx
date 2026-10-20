import type { CheckResult } from "@/lib/types";

/** Shows exactly what was asked of Qloo for a check: the signals, and calls vs cache. */
export function QlooReceipt({ result, cities, aged }: { result: CheckResult; cities: number; aged: boolean }) {
  const t = result.trace;
  if (!t) return null;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const calls = sum(t.calls);
  const cached = sum(t.cached);
  const entities = new Set(result.references.map((r) => r.entity.qlooId)).size;
  const rows = [
    { endpoint: "/search", params: "query · types=brand, tv_show, movie, artist, person, podcast, videogame, book", what: `Matched ${entities} references to Qloo entities`, n: t.calls.search + t.cached.search },
    {
      endpoint: "/v2/insights",
      params: `filter.results.entities · signal.location=POINT(lon lat) · radius 40 km`,
      what: `Ranked each one across ${cities} US cities by affinity`,
      n: t.calls.location + t.cached.location,
    },
    ...(aged
      ? [{ endpoint: "/v2/insights", params: "filter.results.entities · signal.demographics.age", what: "Read how each age band takes to it", n: t.calls.age + t.cached.age }]
      : []),
  ];
  return (
    <details className="group mt-3 rounded-md border border-line text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-muted hover:text-ink">
        <span>
          <span className="font-medium text-ink">Scored with Qloo</span> · {entities} entities · {cities} cities{aged ? " · age bands" : ""}
        </span>
        <span className="tnum shrink-0">
          {calls} API calls · {cached} from cache <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-[110px_1fr_auto] sm:items-baseline sm:gap-3">
            <code className="tnum text-ink">{r.endpoint}</code>
            <span>
              <span className="text-ink">{r.what}</span>
              <span className="tnum mt-0.5 block text-[11px] text-muted">{r.params}</span>
            </span>
            <span className="tnum text-muted">{r.n} lookups</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
