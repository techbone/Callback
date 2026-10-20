"use client";

import { useEffect, useState } from "react";
import { TYPE_LABEL } from "@/lib/labels";
import type { AgeBand, Entity, QlooType } from "@/lib/types";

type Data = Partial<Record<QlooType, Entity[]>>;

export function CrowdCard({ city, age }: { city: string; age: AgeBand }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch(`/api/crowd?city=${encodeURIComponent(city)}&age=${age}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { byType: Data }) => live && setData(d.byType))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [city, age]);

  return (
    <aside className="rounded-lg border border-line bg-surface p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Crowd card</p>
      <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">What {city} loves</h2>
      <p className="mt-1 text-sm text-muted">What this city over-indexes on, from Qloo. TV leans toward what’s trending. Good for openers and crowd work.</p>

      {failed && <p className="mt-4 text-sm text-red">Couldn’t load the crowd card.</p>}
      {!data && !failed && (
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-bg" />
          ))}
        </div>
      )}
      {data && (
        <div className="mt-4 space-y-4">
          {(Object.entries(data) as [QlooType, Entity[]][])
            .filter(([, list]) => list.length > 0)
            .map(([type, list]) => (
              <section key={type}>
                <h3 className="text-xs font-medium text-muted">{TYPE_LABEL[type]}</h3>
                <ul className="mt-1.5 divide-y divide-line border-y border-line">
                  {list.map((e) => (
                    <li key={e.qlooId} className="py-1.5 text-sm">
                      {e.name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </aside>
  );
}
