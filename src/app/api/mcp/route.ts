import { createMcpHandler } from "mcp-handler";
import { INSTRUCTIONS, registerCallback } from "@/lib/mcp/server";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const handler = createMcpHandler(registerCallback, {
  serverInfo: { name: "callback", version: "1.0.0" },
  instructions: INSTRUCTIONS,
});

async function serve(req: Request): Promise<Response> {
  const rl = rateLimit(`mcp:${clientKey(req)}`, 60, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  return handler(req);
}

export { serve as GET, serve as POST, serve as DELETE };
