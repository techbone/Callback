import { NextResponse } from "next/server";
import { z } from "zod";
import { cityByName } from "@/lib/cities";
import { getQloo } from "@/lib/qloo";
import { AGE_BANDS, type Entity, type QlooType } from "@/lib/types";

export const maxDuration = 60;

const Query = z.object({ city: z.string().refine((c) => !!cityByName(c)), age: z.enum(AGE_BANDS) });
const CARD_TYPES: QlooType[] = ["tv_show", "artist", "brand", "person", "place"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({ city: url.searchParams.get("city"), age: url.searchParams.get("age") });
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const qloo = getQloo();
  try {
    const entries = await Promise.all(CARD_TYPES.map(async (t) => [t, await qloo.crowd(t, parsed.data, 4)] as const));
    const byType = Object.fromEntries(entries) as Partial<Record<QlooType, Entity[]>>;
    return NextResponse.json({ byType, source: qloo.source });
  } catch (err) {
    console.error("crowd failed", err);
    return NextResponse.json({ error: "Crowd lookup failed" }, { status: 502 });
  }
}
