import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { z } from "zod";
import { AGE_BANDS } from "./types";

const Shared = z.object({
  t: z.string().max(8000),
  r: z.object({ city: z.string().min(1), age: z.enum(AGE_BANDS) }),
  m: z.enum(["room", "tour"]),
  c: z.array(z.string()).min(1).max(6),
});
export type SharedState = z.infer<typeof Shared>;

const PREFIX = "#s=";

export function encodeShare(state: SharedState): string {
  return PREFIX + compressToEncodedURIComponent(JSON.stringify(state));
}

/** Returns null for anything that isn't a valid share hash. */
export function decodeShare(hash: string): SharedState | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const raw = decompressFromEncodedURIComponent(hash.slice(PREFIX.length));
    if (!raw) return null;
    const parsed = Shared.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
