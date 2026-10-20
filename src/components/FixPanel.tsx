"use client";

import { ArrowRight, Check, LoaderCircle, Undo2 } from "lucide-react";
import type { FixStep } from "@/lib/agent/fix";

export type FixState = { status: "running" | "done" | "error"; steps: FixStep[]; message?: string };

export function FixPanel({ state, onUndo, onClose }: { state: FixState; onUndo: () => void; onClose: () => void }) {
  const done = state.steps.find((s) => s.kind === "done");
  return (
    <section className="mt-6 rounded-lg border border-line bg-surface" aria-live="polite" aria-label="Fix my set">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {state.status === "running" ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          {state.status === "running" ? "Fixing your set" : state.status === "error" ? "Stopped" : "Fixed"}
        </div>
        <div className="flex items-center gap-2">
          {state.status === "done" && done?.kind === "done" && done.swapped > 0 && (
            <button onClick={onUndo} className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-muted hover:border-muted hover:text-ink">
              <Undo2 size={12} /> Undo
            </button>
          )}
          {state.status !== "running" && (
            <button onClick={onClose} className="h-7 rounded-md px-2.5 text-xs text-muted hover:text-ink">
              Close
            </button>
          )}
        </div>
      </header>
      <ol className="divide-y divide-line">
        {state.steps.map((s, i) => (
          <li key={i} className="px-5 py-3 text-sm">
            {s.kind === "plan" && (
              <p className="text-muted">
                {s.red === 0
                  ? `Nothing dies in ${s.city}. ${s.total} references checked.`
                  : `${s.red} of ${s.total} references die in ${s.city}. Working through them.`}
              </p>
            )}
            {s.kind === "swap" && (
              <div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="cb-mark cb-red !cursor-default px-1">{s.surface}</span>
                  <ArrowRight size={14} className="text-muted" />
                  <span className="cb-mark cb-green !cursor-default px-1">{s.to}</span>
                  <span className="tnum text-xs text-muted">
                    #{s.rank} of {s.of}
                  </span>
                </p>
                {s.why && <p className="mt-1 text-muted">{s.why}</p>}
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">{s.by === "rules" ? "Picked by rule" : `Picked by ${s.by}`}</p>
              </div>
            )}
            {s.kind === "keep" && (
              <div>
                <p>
                  Kept <span className="cb-mark cb-red !cursor-default px-1">{s.surface}</span>
                </p>
                <p className="mt-1 text-muted">{s.why}</p>
              </div>
            )}
            {s.kind === "done" && (
              <p className="tnum text-xs text-muted">
                {s.swapped} swapped · {s.result.references.filter((r) => r.scores[0]?.verdict === "red").length} still die ·{" "}
                {s.result.references.filter((r) => r.scores[0]?.verdict === "green").length} land
              </p>
            )}
          </li>
        ))}
        {state.status === "running" && <li className="px-5 py-3 text-sm text-muted">Checking with Qloo…</li>}
        {state.status === "error" && <li className="px-5 py-3 text-sm text-red">{state.message ?? "Something went wrong."}</li>}
      </ol>
    </section>
  );
}
