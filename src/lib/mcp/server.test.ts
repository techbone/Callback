import type { McpServer } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { z } from "zod";
import { setQloo } from "../qloo";
import { MockQlooClient } from "../qloo/mock";
import { registerCallback } from "./server";

type Tool = { config: { inputSchema: z.ZodType; outputSchema: z.ZodType; annotations?: Record<string, boolean> }; handler: (args: unknown) => Promise<{ content: { text: string }[]; structuredContent?: unknown; isError?: boolean }> };

/** Captures registrations so each tool can be called directly, as the SDK would after validation. */
function capture() {
  const tools = new Map<string, Tool>();
  const prompts = new Map<string, unknown>();
  const resources = new Map<string, unknown>();
  const fake = {
    registerTool: (name: string, config: Tool["config"], handler: Tool["handler"]) => tools.set(name, { config, handler }),
    registerPrompt: (name: string, config: unknown) => prompts.set(name, config),
    registerResource: (name: string, uri: string) => resources.set(name, uri),
  };
  registerCallback(fake as unknown as McpServer);
  const call = async (name: string, args: unknown) => {
    const t = tools.get(name)!;
    return t.handler(t.config.inputSchema.parse(args));
  };
  return { tools, prompts, resources, call };
}

describe("MCP server (demo data)", () => {
  beforeAll(() => setQloo(new MockQlooClient()));
  afterAll(() => setQloo(null));
  const mcp = capture();
  const text = "Back home, Dunkin' is a personality. I walked into a Waffle House at 3 a.m.";

  it("registers the tools, prompts and resources", () => {
    expect([...mcp.tools.keys()]).toEqual(["check_references", "find_local_swaps", "compare_cities", "where_it_lands", "crowd_card", "fix_set"]);
    expect([...mcp.prompts.keys()]).toEqual(["localize_set", "plan_tour"]);
    expect([...mcp.resources.values()]).toEqual(["callback://method", "callback://cities"]);
    for (const [name, t] of mcp.tools) expect(t.config.annotations?.readOnlyHint, name).toBe(true);
  });

  it.each([
    ["check_references", { text, city: "Atlanta" }],
    ["find_local_swaps", { reference: "Dunkin'", city: "Atlanta" }],
    ["compare_cities", { text, cities: ["Atlanta", "Boston"] }],
    ["where_it_lands", { reference: "Waffle House" }],
    ["crowd_card", { city: "Boston" }],
    ["fix_set", { text, city: "Boston" }],
  ])("%s returns text and structured content that matches its output schema", async (name, args) => {
    const res = await mcp.call(name, args);
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text.length).toBeGreaterThan(0);
    expect(() => mcp.tools.get(name)!.config.outputSchema.parse(res.structuredContent)).not.toThrow();
  });

  it("gives verdicts an agent can act on", async () => {
    const res = await mcp.call("check_references", { text, city: "Atlanta" });
    const out = res.structuredContent as { references: { entity: string; verdict: string }[] };
    expect(out.references.find((r) => r.entity === "Waffle House")?.verdict).toBe("lands");
  });

  it("reports an unknown reference as a tool error, not a crash", async () => {
    const res = await mcp.call("where_it_lands", { reference: "Zzqxv Plorbington" });
    expect(res.isError).toBe(true);
  });

  it("rejects cities outside the supported list at the schema", () => {
    expect(() => mcp.tools.get("crowd_card")!.config.inputSchema.parse({ city: "Paris" })).toThrow();
  });
});
