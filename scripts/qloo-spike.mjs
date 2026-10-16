#!/usr/bin/env node
// M1 API spike: run this once your Qloo hackathon key arrives.
//
//   QLOO_API_KEY=... node scripts/qloo-spike.mjs
//
// It exercises every call Callback depends on and writes the raw responses to
// scripts/spike-out/, so we can confirm field names before writing the live client:
//   1. /search           name -> entity (does it return popularity and tags?)
//   2. /v2/insights      filter.results.entities + signal.location.query (local affinity)
//   3. /v2/insights      same, no location (national baseline)
//   4. /v2/insights      age band signal
//   5. /v2/insights      same-tag candidates for swaps (filter.tags)
//   6. /v2/insights      bias.trends for the Crowd Card
//   7. /v2/tags          tag id lookup
import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.QLOO_API_KEY;
const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
if (!KEY) {
  console.error("Set QLOO_API_KEY (hackathon keys only work against https://hackathon.api.qloo.com).");
  process.exit(1);
}
const out = new URL("./spike-out/", import.meta.url);
mkdirSync(out, { recursive: true });

async function call(name, path, params) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "X-Api-Key": KEY } });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = { raw: body }; }
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify(json, null, 2));
  console.log(`${res.status} ${name}  ${url.replace(KEY, "***")}`);
  return json;
}

const search = await call("1-search", "/search", { query: "Waffle House", types: "urn:entity:brand", take: "3" });
const hit = search?.results?.[0];
console.log("   first hit:", hit ? { id: hit.entity_id ?? hit.id, name: hit.name, keys: Object.keys(hit) } : "none");
const id = hit?.entity_id ?? hit?.id;
if (!id) {
  console.error("No entity id found: inspect scripts/spike-out/1-search.json and adjust the spike.");
  process.exit(1);
}

const type = { "filter.type": "urn:entity:brand", "filter.results.entities": id };
await call("2-local-atlanta", "/v2/insights", { ...type, "signal.location.query": "Atlanta" });
await call("3-national", "/v2/insights", type);
await call("4-age", "/v2/insights", { ...type, "signal.location.query": "Atlanta", "signal.demographics.age": "35_and_younger" });
await call("5-same-tag", "/v2/insights", {
  "filter.type": "urn:entity:brand",
  "signal.location.query": "Atlanta",
  "signal.interests.entities": id,
  take: "10",
});
await call("6-trends", "/v2/insights", {
  "filter.type": "urn:entity:tv_show",
  "signal.location.query": "Atlanta",
  "bias.trends": "high",
  take: "5",
});
await call("7-tags", "/v2/tags", { "filter.query": "diner", take: "5" });

console.log("\nDone. Check the following in scripts/spike-out/:");
console.log(" - where per-entity affinity lives (2 vs 3: local vs national)");
console.log(" - whether popularity comes back from /search, /v2/insights, or neither");
console.log(" - whether 4 changes the numbers (age signal) and 6 returns trending flags");
