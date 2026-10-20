import type { QlooClient } from "./client";
import { LiveQlooClient } from "./live";
import { MockQlooClient } from "./mock";

let client: QlooClient | null = null;

/** Live Qloo when QLOO_API_KEY is set, otherwise the labelled demo fixtures. */
export function getQloo(): QlooClient {
  if (!client) {
    const key = process.env.QLOO_API_KEY;
    client = key ? new LiveQlooClient(key, process.env.QLOO_BASE_URL || undefined) : new MockQlooClient();
  }
  return client;
}

/** Tests only. */
export function setQloo(c: QlooClient | null) {
  client = c;
}

export type { QlooClient } from "./client";
