"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { explain } from "@/lib/scoring";
import type { Candidate, Reference, Room, Score } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/labels";

const pct = (n: number) => Math.round(n * 100);

export function RefPopover({
  reference,
  score,
  room,
  onSwap,
}: {
  reference: Reference;
  score: Score;
  room: Room;
  onSwap: (c: Candidate) => void;
}) {
  const entity = reference.entity!;
  const [swaps, setSwaps] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const needsSwap = score.verdict !== "green";

  useEffect(() => {
    if (!needsSwap) return;
    let live = true;
    fetch("/api/swap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: { qlooId: entity.qlooId, type: entity.type, tags: entity.tags }, room }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { swaps: Candidate[] }) => live && setSwaps(d.swaps))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [needsSwap, entity.qlooId, entity.type, entity.tags, room]);

  return (
    <div className="w-[340px] rounded-lg border border-line bg-surface p-4 shadow-[0_8px_30px_rgb(0_0_0/0.12)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-semibold leading-tight tracking-tight">{entity.name}</p>
        <span className="shrink-0 text-xs text-muted">{TYPE_LABEL[entity.type]}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted">{explain(score.known, score.lift, score.verdict)}</p>

      <dl className="tnum mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center">
        {[
          ["Known", `${pct(score.known)}`],
          [room.city, `${pct(score.local)}`],
          ["Lift", `${score.lift.toFixed(1)}×`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-2 py-2">
            <dt className="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
            <dd className="text-base">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[11px] text-muted">
        National affinity <span className="tnum">{pct(score.baseline)}</span>. Lift is local over national.
      </p>

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
                <button
                  onClick={() => onSwap(c)}
                  className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg"
                >
                  <span className="font-medium">{c.entity.name}</span>
                  <span className="tnum text-xs text-muted group-hover:text-ink">{c.lift.toFixed(1)}× here</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
