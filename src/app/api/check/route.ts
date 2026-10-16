import { NextResponse } from "next/server";
import { z } from "zod";
import { checkText } from "@/lib/agent/check";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { AGE_BANDS } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(8000),
  rooms: z
    .array(z.object({ city: z.string().min(1), venue: z.string().optional(), age: z.enum(AGE_BANDS) }))
    .min(1)
    .max(6),
});

export async function POST(req: Request) {
  const rl = rateLimit(`check:${clientKey(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many checks. Try again shortly." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await checkText(parsed.data.text, parsed.data.rooms));
  } catch (err) {
    console.error("check failed", err);
    return NextResponse.json({ error: "Check failed" }, { status: 502 });
  }
}
