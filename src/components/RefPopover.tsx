"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { TYPE_LABEL } from "@/lib/labels";
import { ageFit, explain, explainAge } from "@/lib/scoring";
import type { Candidate, Reference, Room, Score } from "@/lib/types";
import { WhereItLands } from "./WhereItLands";

const pct = (n: number) => Math.round(n * 100);

export function RefPopover({
  reference,
  score,
  room,
  onSwap,
}: {
  reference: Reference;
  score: Score | undefined;
  room: Room;
  onSwap: (c: Candidate) => void;
}) {
  const entity = reference.entity;
  const [swaps, setSwaps] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const needsSwap = !!score && score.verdict !== "green";
  const mine = new Set(entity.tags.map((t) => t.id));
  const shared = (c: Candidate) => c.entity.tags.filter((t) => mine.has(t.id)).map((t) => t.name);

  useEffect(() => {
    if (!needsSwap) return;
    let live = true;
    fetch("/api/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, room }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { swaps: Candidate[] }) => live && setSwaps(d.swaps))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [needsSwap, entity, room]);

  return (
    <div className="w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-line bg-surface p-4 shadow-[0_8px_30px_rgb(0_0_0/0.12)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-semibold leading-tight tracking-tight">{entity.name}</p>
        <span className="shrink-0 text-xs text-muted">{TYPE_LABEL[entity.type]}</span>
      </div>

      {!score ? (
        <p className="mt-1.5 text-sm text-muted">
          Qloo has no city-level data for this one, so Callback can’t rank it in {room.city}.{" "}
          {explainAge(ageFit(reference.age, room.age), room.age) || `Popularity ${pct(entity.popularity)} out of 100.`}
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-muted">
            {explain(score.known, score, score.placeVerdict, room.city)} {explainAge(score.ageFit, room.age)}
          </p>
          <dl className="tnum mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
            {[
              ["Known", `${pct(score.known)}`],
              ["Rank here", `#${score.rank} of ${score.of}`],
              ["Vs typical", `${score.lift.toFixed(1)}×`],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-2 py-2">
                <dt className="truncate font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
                <dd className="text-base">{v}</dd>
              </div>
            ))}
          </dl>
          {reference.cities && <WhereItLands rows={reference.cities} city={room.city} />}
          <p className="mt-2 text-[11px] text-muted">Qloo affinity across {score.of} US cities. “Vs typical” compares with the median city.</p>
        </>
      )}

      {needsSwap && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Try instead</p>
          {swaps === null && !failed && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <LoaderCircle size={14} className="animate-spin" /> Finding what {room.city} loves
            </p>
          )}
          {failed && <p className="mt-2 text-sm text-red">Couldn’t look up swaps. Try again.</p>}
          {swaps?.length === 0 && <p className="mt-2 text-sm text-muted">No stronger local match in this category.</p>}
          <ul className="mt-1 space-y-1">
            {swaps?.map((c) => (
              <li key={c.entity.qlooId}>
                <button onClick={() => onSwap(c)} className="group w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span className={`inline-block size-1.5 shrink-0 rounded-full ${c.score.verdict === "green" ? "bg-green" : "bg-yellow"}`} />
                      {c.entity.name}
                    </span>
                    <span className="tnum shrink-0 text-xs text-muted group-hover:text-ink">
                      #{c.score.rank} here · {c.score.lift.toFixed(1)}×
                    </span>
                  </span>
                  {shared(c).length > 0 && <span className="mt-0.5 block truncate pl-3.5 text-[11px] text-muted">Shares: {shared(c).slice(0, 2).join(", ")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
