import seed from "./seed.json";
import { record, type QlooOp } from "./trace";

/**
 * Cache for Qloo responses. The hackathon key allows 10,000 calls a month, shared
 * by development and judging, so nothing is fetched twice:
 *   1. memory (per server instance)
 *   2. seed.json, committed snapshot warmed by scripts (covers the presets)
 *   3. Upstash Redis, when UPSTASH_REDIS_REST_URL/TOKEN are set (shared across instances)
 */
type Entry = { at: number; ttl: number; value: unknown };

const memory = new Map<string, Entry>();
const seeded = seed as Record<string, unknown>;

/**
 * Local development only: persist everything fetched to .cache/qloo.json so
 * restarts and test runs don't spend the monthly quota again. Never on Vercel.
 */
const DISK = !process.env.VERCEL && process.env.CALLBACK_DISK_CACHE !== "0" ? ".cache/qloo.json" : null;
let diskLoaded = false;
let diskTimer: ReturnType<typeof setTimeout> | null = null;

async function loadDisk() {
  if (!DISK || diskLoaded) return;
  diskLoaded = true;
  try {
    const { readFile } = await import("node:fs/promises");
    const data = JSON.parse(await readFile(DISK, "utf8")) as Record<string, unknown>;
    for (const [k, value] of Object.entries(data)) memory.set(k, { at: Date.now(), ttl: Number.POSITIVE_INFINITY, value });
  } catch {
    // no cache yet
  }
}

function saveDiskSoon() {
  if (!DISK || diskTimer) return;
  diskTimer = setTimeout(async () => {
    diskTimer = null;
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(".cache", { recursive: true });
    await writeFile(DISK, JSON.stringify(dumpMemory()));
  }, 200);
}

/** Wait for pending disk writes (scripts and tests). */
export async function flushDisk() {
  if (!diskTimer) return;
  clearTimeout(diskTimer);
  diskTimer = null;
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(".cache", { recursive: true });
  await writeFile(DISK!, JSON.stringify(dumpMemory()));
}

let redis: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown, o: { ex: number }) => Promise<unknown> } | null | undefined;
async function getRedis() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (redis = null);
  const { Redis } = await import("@upstash/redis");
  return (redis = new Redis({ url, token }));
}

const MISS = Symbol("miss");

export async function cacheGet(key: string): Promise<unknown | typeof MISS> {
  await loadDisk();
  const m = memory.get(key);
  if (m && Date.now() - m.at < m.ttl) return m.value;
  if (key in seeded) return seeded[key];
  const r = await getRedis();
  if (r) {
    try {
      const v = await r.get(`cb:${key}`);
      if (v !== null && v !== undefined) {
        memory.set(key, { at: Date.now(), ttl: 60 * 60 * 1000, value: v });
        return v;
      }
    } catch (err) {
      console.warn("redis get failed", err);
    }
  }
  return MISS;
}

export async function cacheSet(key: string, value: unknown, ttlMs: number) {
  memory.set(key, { at: Date.now(), ttl: ttlMs, value });
  saveDiskSoon();
  const r = await getRedis();
  if (r) {
    try {
      await r.set(`cb:${key}`, value, { ex: Math.ceil(ttlMs / 1000) });
    } catch (err) {
      console.warn("redis set failed", err);
    }
  }
}

export const isMiss = (v: unknown): v is typeof MISS => v === MISS;

/** Everything fetched this process, for writing a new seed snapshot. */
export function dumpMemory(): Record<string, unknown> {
  return Object.fromEntries([...memory].map(([k, e]) => [k, e.value]));
}

const inflight = new Map<string, Promise<unknown>>();

/** Cached call with in-flight de-duplication. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, op?: QlooOp): Promise<T> {
  const hit = await cacheGet(key);
  if (!isMiss(hit)) {
    if (op) record(op, true);
    return hit as T;
  }
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then(async (v) => {
      await cacheSet(key, v, ttlMs);
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
