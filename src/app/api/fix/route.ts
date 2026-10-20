import { z } from "zod";
import { fixSet, type FixStep } from "@/lib/agent/fix";
import { cityByName } from "@/lib/cities";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { AGE_BANDS } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(8000),
  room: z.object({ city: z.string().refine((c) => !!cityByName(c)), age: z.enum(AGE_BANDS) }),
});

/** Streams agent steps as newline-delimited JSON, ending with a "done" step. */
export async function POST(req: Request) {
  const rl = rateLimit(`fix:${clientKey(req)}`, 6, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many fixes. Try again shortly." }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: FixStep | { kind: "error"; message: string }) => controller.enqueue(enc.encode(JSON.stringify(s) + "\n"));
      try {
        await fixSet(parsed.data.text, parsed.data.room, { onStep: send });
      } catch (err) {
        console.error("fix failed", err);
        send({ kind: "error", message: "The agent stopped early. Try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
