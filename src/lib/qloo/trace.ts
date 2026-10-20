import { AsyncLocalStorage } from "node:async_hooks";

/** What a request asked of Qloo: network calls and cache hits per kind of lookup. */
export type QlooOp = "search" | "location" | "age" | "similar" | "crowd";
export type Trace = { calls: Record<QlooOp, number>; cached: Record<QlooOp, number> };

const empty = (): Trace => ({
  calls: { search: 0, location: 0, age: 0, similar: 0, crowd: 0 },
  cached: { search: 0, location: 0, age: 0, similar: 0, crowd: 0 },
});

const als = new AsyncLocalStorage<Trace>();

export async function withTrace<T>(fn: () => Promise<T>): Promise<{ value: T; trace: Trace }> {
  const trace = empty();
  const value = await als.run(trace, fn);
  return { value, trace };
}

/** Count a network call (cached = false) or items served from cache (cached = true). */
export function record(op: QlooOp, cached: boolean, n = 1) {
  const t = als.getStore();
  if (t && n > 0) (cached ? t.cached : t.calls)[op] += n;
}
