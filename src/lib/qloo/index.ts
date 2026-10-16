import type { QlooClient } from "./client";
import { MockQlooClient } from "./mock";

/**
 * Returns the live client when QLOO_API_KEY is set, otherwise the demo-data
 * client. The live client lands in M1 once the hackathon key arrives.
 */
export function getQloo(): QlooClient {
  return new MockQlooClient();
}

export type { QlooClient } from "./client";
