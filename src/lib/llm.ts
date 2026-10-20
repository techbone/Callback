/**
 * Minimal client for any OpenAI-compatible chat endpoint (Groq's free tier by
 * default). JSON mode only: the agent asks for small structured decisions.
 */
export class LlmUnavailable extends Error {}

export function llmConfigured(): boolean {
  return !!process.env.LLM_API_KEY;
}

export async function chatJSON<T>(system: string, user: string, opts: { timeoutMs?: number; model?: string } = {}): Promise<{ data: T; model: string }> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmUnavailable("no LLM_API_KEY");
  const base = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const models = [opts.model ?? process.env.LLM_MODEL ?? "openai/gpt-oss-120b", process.env.LLM_FALLBACK_MODEL ?? "qwen/qwen3.8-27b"];

  let last: unknown;
  for (const model of [...new Set(models)]) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      });
      if (!res.ok) {
        last = new LlmUnavailable(`${model} ${res.status}`);
        continue; // rate limited or down: try the next model
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        last = new LlmUnavailable(`${model} empty reply`);
        continue;
      }
      return { data: JSON.parse(content) as T, model };
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof LlmUnavailable ? last : new LlmUnavailable(String(last));
}
