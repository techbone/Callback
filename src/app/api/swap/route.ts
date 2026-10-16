import { NextResponse } from "next/server";
import { z } from "zod";
import { getQloo } from "@/lib/qloo";
import { AGE_BANDS, QLOO_TYPES } from "@/lib/types";

const Body = z.object({
  entity: z.object({
    qlooId: z.string(),
    type: z.enum(QLOO_TYPES),
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  room: z.object({ city: z.string().min(1), venue: z.string().optional(), age: z.enum(AGE_BANDS) }),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { entity, room } = parsed.data;
  try {
    const swaps = await getQloo().localCandidates(entity.type, entity.tags, room, [entity.qlooId], 3);
    return NextResponse.json({ swaps });
  } catch (err) {
    console.error("swap failed", err);
    return NextResponse.json({ error: "Swap lookup failed" }, { status: 502 });
  }
}
