"use client";

import { Check, Link as LinkIcon, LoaderCircle, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrowdCard } from "./CrowdCard";
import { FixPanel, type FixState } from "./FixPanel";
import { Logo } from "./Logo";
import { Editor, type EditorHandle, type Mark, type MarkClick } from "./Editor";
import { QlooReceipt } from "./QlooReceipt";
import { RefPopover } from "./RefPopover";
import { Select } from "./Select";
import { TourGrid, worst } from "./TourGrid";
import { PRESETS } from "@/lib/presets";
import { decodeShare, encodeShare } from "@/lib/share";
import type { FixStep } from "@/lib/agent/fix";
import { CITY_NAMES, POOL } from "@/lib/cities";
import { AGE_BANDS, AGE_LABELS, type AgeBand, type Candidate, type CheckResult, type Reference, type Room, roomKey } from "@/lib/types";

type Status = "idle" | "loading" | "error";
type Mode = "room" | "tour";
const DEFAULT_TOUR = ["Atlanta", "Boston", "Chicago", "Houston"];
type Open = MarkClick & { reference: Reference };

const LEGEND = [
  { cls: "cb-green", label: "Lands" },
  { cls: "cb-yellow", label: "Known, no heat" },
  { cls: "cb-red", label: "Dies here" },
];

export function CallbackApp() {
  const first = PRESETS[0];
  const [presetId, setPresetId] = useState(first.id);
  const [docKey, setDocKey] = useState(`${first.id}-0`);
  const [initialDoc, setInitialDoc] = useState(first.text);
  const [room, setRoom] = useState<Room>(first.room);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [stale, setStale] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [quota, setQuota] = useState(false);
  const [open, setOpen] = useState<Open | null>(null);
  const [mode, setMode] = useState<Mode>("room");
  const [tour, setTour] = useState<string[]>(DEFAULT_TOUR);
  const [copied, setCopied] = useState(false);
  const [fix, setFix] = useState<FixState | null>(null);
  const beforeFix = useRef<string | null>(null);

  const text = useRef(first.text);
  const editor = useRef<EditorHandle>(null);
  const frame = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const run = useCallback(async (t: string, rooms: Room[]) => {
    if (!t.trim()) {
      setResult(null);
      setStatus("idle");
      return;
    }
    const mine = ++seq.current;
    setStatus("loading");
    setOpen(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, rooms }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as CheckResult;
      if (mine !== seq.current) return;
      setResult(data);
      setStale(false);
      setQuota(false);
      setStatus("idle");
    } catch (err) {
      if (mine !== seq.current) return;
      setQuota(err instanceof Error && err.message === "503");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const shared = decodeShare(window.location.hash);
    if (!shared) {
      void run(first.text, [first.room]);
      return;
    }
    const r: Room = { city: shared.r.city, age: shared.r.age };
    setPresetId("");
    setInitialDoc(shared.t);
    setDocKey(`shared-${Date.now()}`);
    setRoom(r);
    setMode(shared.m);
    setTour(shared.c);
    text.current = shared.t;
    void run(shared.t, shared.m === "tour" ? shared.c.map((city) => ({ ...r, city })) : [r]);
  }, [run, first]);

  const replaceDoc = (t: string, key: string) => {
    setInitialDoc(t);
    setDocKey(key);
    text.current = t;
  };

  const runFix = async () => {
    if (!text.current.trim()) return;
    beforeFix.current = text.current;
    setOpen(null);
    setFix({ status: "running", steps: [] });
    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.current, room }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const steps: FixStep[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const step = JSON.parse(line) as FixStep | { kind: "error"; message: string };
          if (step.kind === "error") {
            setFix({ status: "error", steps: [...steps], message: step.message });
            return;
          }
          steps.push(step);
          if (step.kind === "done") {
            replaceDoc(step.text, `fix-${Date.now()}`);
            setResult(step.result);
            setStale(false);
            setFix({ status: "done", steps: [...steps] });
            return;
          }
          setFix({ status: "running", steps: [...steps] });
        }
      }
      setFix({ status: "error", steps, message: "The agent stopped early. Try again." });
    } catch {
      setFix((f) => ({ status: "error", steps: f?.steps ?? [], message: "Couldn’t reach the agent. Try again." }));
    }
  };

  const undoFix = () => {
    if (beforeFix.current === null) return;
    replaceDoc(beforeFix.current, `undo-${Date.now()}`);
    setFix(null);
    void run(beforeFix.current, activeRooms);
  };

  const copyLink = async () => {
    const hash = encodeShare({ t: text.current, r: { city: room.city, age: room.age }, m: mode, c: tour });
    window.history.replaceState(null, "", hash);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the address bar now holds the link
    }
  };

  const roomsFor = useCallback(
    (m: Mode, r: Room, cities: string[]): Room[] => (m === "tour" ? cities.map((city) => ({ ...r, city })) : [r]),
    [],
  );
  const activeRooms = useMemo(() => roomsFor(mode, room, tour), [mode, room, tour, roomsFor]);
  const keys = useMemo(() => new Set(activeRooms.map(roomKey)), [activeRooms]);

  /** In one-room mode the score for that room; in tour mode the weakest room. */
  const scoreFor = useCallback(
    (ref: Reference) => {
      const mine = ref.scores.filter((s) => keys.has(s.roomKey));
      const w = worst(mine.map((s) => s.verdict));
      return mine.find((s) => s.verdict === w);
    },
    [keys],
  );
  const roomOf = (score: { roomKey: string }) => activeRooms.find((r) => roomKey(r) === score.roomKey) ?? room;

  const marks: Mark[] = useMemo(
    () =>
      (result?.references ?? []).map((ref) => ({ id: ref.id, from: ref.start, to: ref.end, verdict: scoreFor(ref)?.verdict ?? "none" })),
    [result, scoreFor],
  );

  const tally = useMemo(() => {
    const t = { green: 0, yellow: 0, red: 0, none: 0 };
    for (const m of marks) t[m.verdict]++;
    return t;
  }, [marks]);

  const changeRoom = (patch: Partial<Room>) => {
    const next = { ...room, ...patch };
    setRoom(next);
    void run(text.current, roomsFor(mode, next, tour));
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    void run(text.current, roomsFor(m, room, tour));
  };

  const toggleCity = (city: string) => {
    const next = tour.includes(city) ? tour.filter((c) => c !== city) : [...tour, city];
    if (next.length === 0 || next.length > 6) return;
    setTour(next);
    void run(text.current, roomsFor("tour", room, next));
  };

  const openCity = (city: string) => {
    const next = { ...room, city };
    setRoom(next);
    setMode("room");
    void run(text.current, [next]);
  };

  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setFix(null);
    setPresetId(id);
    setInitialDoc(p.text);
    setDocKey(`${id}-${Date.now()}`);
    setRoom(p.room);
    text.current = p.text;
    setResult(null);
    void run(p.text, roomsFor(mode, p.room, tour));
  };

  const onSwap = (c: Candidate) => {
    if (!open) return;
    editor.current?.replace(open.from, open.to, c.entity.name);
    void run(text.current, activeRooms);
  };

  const onMarkClick = (click: MarkClick) => {
    const reference = result?.references.find((r) => r.id === click.id);
    if (reference) setOpen({ ...click, reference });
  };

  const openScore = open ? scoreFor(open.reference) : undefined;
  const pos = (() => {
    if (!open || !frame.current) return null;
    const f = frame.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(open.rect.left - f.left, f.width - 348));
    return { top: open.rect.bottom - f.top + 10, left };
  })();

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-tight">Callback</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-muted transition-colors hover:border-muted hover:text-ink"
            title="Copy a link to this set, room and tour"
          >
            {copied ? <Check size={13} /> : <LinkIcon size={13} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
          </button>
          {result && (
            <span
              title={
                result.source === "live"
                  ? "Scores come from Qloo's Taste AI API in real time."
                  : "Scores come from built-in sample data until a Qloo key is connected."
              }
              className="flex h-8 items-center gap-2 rounded-md border border-line px-2.5 text-xs text-muted"
            >
              <span className={`size-1.5 rounded-full ${result.source === "live" ? "bg-green" : "bg-yellow"}`} />
              {result.source === "live" ? "Live Qloo data" : "Demo data"}
            </span>
          )}
        </div>
      </header>

      <div className={`grid gap-6 ${mode === "room" ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <main>
          <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
            Will this reference land in the room?
          </h1>
          <p className="mt-2 max-w-[56ch] text-[15px] text-muted">
            Paste what you’re going to say, pick the room, and every cultural reference is underlined by how it will play there.
          </p>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-3 gap-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Select
                label="Example"
                value={presetId}
                options={[...(presetId ? [] : [{ value: "", label: "Shared set" }]), ...PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
                onChange={loadPreset}
              />
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Mode</span>
                <div role="group" aria-label="Mode" className="flex h-9 overflow-hidden rounded-md border border-line bg-surface text-sm">
                  {(["room", "tour"] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      onClick={() => changeMode(m)}
                      className={`px-2.5 transition-colors ${mode === m ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                    >
                      {m === "room" ? "One room" : "Tour"}
                    </button>
                  ))}
                </div>
              </div>
              {mode === "room" && (
                <Select label="City" value={room.city} options={CITY_NAMES.map((c) => ({ value: c, label: c }))} onChange={(city) => changeRoom({ city })} />
              )}
              <Select
                label="Age"
                value={room.age}
                options={AGE_BANDS.map((a) => ({ value: a, label: AGE_LABELS[a] }))}
                onChange={(age) => changeRoom({ age: age as AgeBand })}
              />
            </div>
            <div className="flex items-center gap-2">
              {mode === "room" && (
                <button
                  onClick={runFix}
                  disabled={fix?.status === "running" || status === "loading"}
                  className="flex h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {fix?.status === "running" ? <LoaderCircle size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Fix my set
                </button>
              )}
            </div>
          </div>

          {mode === "tour" && (
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Tour stops">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Stops</span>
              {CITY_NAMES.map((c) => (
                <button
                  key={c}
                  aria-pressed={tour.includes(c)}
                  onClick={() => toggleCity(c)}
                  className={`h-7 rounded-full border px-3 text-xs transition-colors ${
                    tour.includes(c) ? "border-ink bg-ink text-bg" : "border-line text-muted hover:border-muted hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div ref={frame} className="relative mt-4 rounded-lg border border-line bg-surface">
            <Editor
              ref={editor}
              initialDoc={initialDoc}
              docKey={docKey}
              marks={marks}
              active={open?.id ?? null}
              onChange={(t) => {
                text.current = t;
                if (result) setStale(true);
              }}
              onMarkClick={onMarkClick}
            />
            {open && pos && (
              <>
                <div className="fixed inset-0 z-10" onMouseDown={() => setOpen(null)} />
                <div className="absolute z-20" style={{ top: pos.top, left: pos.left }}>
                  <RefPopover reference={open.reference} score={openScore} room={openScore ? roomOf(openScore) : room} onSwap={onSwap} />
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {LEGEND.map((l) => (
                <li key={l.cls}>
                  <span className={`cb-mark !cursor-default px-1 ${l.cls}`}>{l.label}</span>
                </li>
              ))}
            </ul>
            <p className="tnum flex items-center gap-2 text-xs text-muted" aria-live="polite">
              {status === "loading" ? (
                <>
                  <LoaderCircle size={12} className="animate-spin" /> Checking with Qloo
                </>
              ) : status === "error" ? (
                <>
                  {quota ? "Qloo’s monthly limit is nearly used. The examples still work." : "Check failed."}
                  {!quota && (
                    <button onClick={() => run(text.current, activeRooms)} className="rounded border border-line px-2 py-0.5 text-ink hover:border-muted">
                      Try again
                    </button>
                  )}
                </>
              ) : stale ? (
                <>
                  Edited since last check
                  <button onClick={() => run(text.current, activeRooms)} className="rounded border border-ink px-2 py-0.5 text-ink hover:bg-ink hover:text-bg">
                    Check now
                  </button>
                </>
              ) : result ? (
                mode === "tour" ? (
                  `${marks.length} references · ${tally.green} land everywhere · ${tally.yellow} shaky · ${tally.red} die somewhere${tally.none ? ` · ${tally.none} no data` : ""}`
                ) : (
                  `${marks.length} references · ${tally.green} land · ${tally.yellow} shaky · ${tally.red} die${tally.none ? ` · ${tally.none} no data` : ""}`
                )
              ) : null}
            </p>
          </div>

          {result && !stale && (
            <QlooReceipt
              result={result}
              cities={new Set([...POOL, ...activeRooms.map((r) => r.city)]).size}
              aged={activeRooms.some((r) => r.age !== "any")}
            />
          )}

          {fix && mode === "room" && <FixPanel state={fix} onUndo={undoFix} onClose={() => setFix(null)} />}

          {mode === "tour" && result && <TourGrid references={result.references} cities={tour} onPick={openCity} />}

          <footer className="mt-10 max-w-[62ch] space-y-2 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            <p>
              <span className="font-medium text-ink">How it works.</span> Each reference is matched to a Qloo entity, then ranked by how much this city likes it
              compared with seven other US cities, with the age band applied on top. Qloo measures liking, not recognition, so “lands” is a strong estimate, not a
              guarantee.
            </p>
            <p>
              Powered by Qloo’s Taste AI API · Built for the Qloo Agentic Hackathon ·{" "}
              <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/techbone/Callback">
                Source
              </a>{" "}
              ·{" "}
              <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/techbone/Callback#use-callback-inside-your-agent-mcp">
                Use it in Claude via MCP
              </a>
            </p>
          </footer>
        </main>

        {mode === "room" && (
          <div className="lg:pt-[7px]">
            <CrowdCard city={room.city} age={room.age} />
          </div>
        )}
      </div>
    </div>
  );
}
