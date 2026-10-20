import { NextResponse } from "next/server";
import { QuotaLow } from "@/lib/qloo/live";
import { z } from "zod";
import { findSwaps } from "@/lib/agent/check";
import { cityByName } from "@/lib/cities";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { AGE_BANDS, QLOO_TYPES } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  entity: z.object({
    qlooId: z.string(),
    name: z.string(),
    type: z.enum(QLOO_TYPES),
    popularity: z.number(),
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  room: z.object({ city: z.string().refine((c) => !!cityByName(c)), venue: z.string().optional(), age: z.enum(AGE_BANDS) }),
});

export async function POST(req: Request) {
  const rl = rateLimit(`swap:${clientKey(req)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json({ swaps: await findSwaps(parsed.data.entity, parsed.data.room) });
  } catch (err) {
    if (err instanceof QuotaLow) return NextResponse.json({ error: "quota" }, { status: 503 });
    console.error("swap failed", err);
    return NextResponse.json({ error: "Swap lookup failed" }, { status: 502 });
  }
}
