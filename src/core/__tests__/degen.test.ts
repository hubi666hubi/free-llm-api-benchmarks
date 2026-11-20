import { describe, it, expect, beforeEach } from "vitest";
import { DegenKeyPooler } from "../degen/DegenKeyPooler";
import { ZERO_AUTH_ENDPOINTS, ABLITERATED_PRESETS, calculatePromptCacheSavings } from "../degen/zeroAuthEndpoints";

describe("DegenKeyPooler Engine Tests", () => {
  let pooler: DegenKeyPooler;

  beforeEach(() => {
    pooler = new DegenKeyPooler(["key_alpha", "key_beta", "key_gamma"], 60);
  });

  it("should initialize with given keys and aliases", () => {
    const keys = pooler.getKeys();
    expect(keys.length).toBe(3);
    expect(keys[0].key).toBe("key_alpha");
    expect(keys[0].status).toBe("healthy");
    expect(keys[1].key).toBe("key_beta");
  });

  it("should acquire keys round-robin with zero failover when healthy", () => {
    const r1 = pooler.acquireKey();
    expect(r1.selectedKey.key).toBe("key_alpha");
    expect(r1.failoversRequired).toBe(0);

    const r2 = pooler.acquireKey();
    expect(r2.selectedKey.key).toBe("key_beta");

    const r3 = pooler.acquireKey();
    expect(r3.selectedKey.key).toBe("key_gamma");

    const r4 = pooler.acquireKey();
    expect(r4.selectedKey.key).toBe("key_alpha");
  });

  it("should automatically isolate a key on 429 and failover to next healthy key", () => {
    const keys = pooler.getKeys();
    const firstKey = keys[0];

    // Simulate 429 on first key
    pooler.reportRateLimit(firstKey.id, 60);

    const updatedKeys = pooler.getKeys();
    expect(updatedKeys[0].status).toBe("cooldown");
    expect(updatedKeys[0].totalErrors).toBe(1);

    // Next acquire should bypass key_alpha and return key_beta with failover count
    const result = pooler.acquireKey();
    expect(result.selectedKey.key).toBe("key_beta");
    expect(result.failoversRequired).toBeGreaterThanOrEqual(1);
  });

  it("should throw informative error if all keys are quarantined in cooldown", () => {
    const keys = pooler.getKeys();
    keys.forEach((k) => pooler.reportRateLimit(k.id, 60));

    expect(() => pooler.acquireKey()).toThrowError(/Wszystkie klucze .* w stanie 429 Cooldown/);
  });

  it("should automatically restore key status after cooldown expiration", () => {
    const keys = pooler.getKeys();
    const now = Date.now();
    pooler.reportRateLimit(keys[0].id, 30, now);

    expect(pooler.getKeys()[0].status).toBe("cooldown");

    // After 31 seconds:
    pooler.refreshCooldowns(now + 31000);
    expect(pooler.getKeys()[0].status).toBe("healthy");
  });

  it("should generate valid Python FastAPI proxy snippet with all keys", () => {
    const script = pooler.generatePythonFastApiProxy("google", "gemini-2.0-flash-exp");
    expect(script).toContain("Degen Anti-429 Proxy");
    expect(script).toContain("key_alpha");
    expect(script).toContain("key_beta");
    expect(script).toContain("/v1/chat/completions");
  });

  it("should generate LiteLLM YAML config", () => {
    const yaml = pooler.generateLiteLLMConfig("gemini/gemini-2.0-flash-exp");
    expect(yaml).toContain("model_list:");
    expect(yaml).toContain("key_alpha");
    expect(yaml).toContain("latency-based-routing");
  });
});

describe("Zero-Auth & Degen Presets Tests", () => {
  it("should contain Puter and Pollinations zero-auth endpoints", () => {
    expect(ZERO_AUTH_ENDPOINTS.length).toBeGreaterThanOrEqual(4);
    const puter = ZERO_AUTH_ENDPOINTS.find((e) => e.id === "puter-js");
    expect(puter).toBeDefined();
    expect(puter?.corsEnabled).toBe(true);

    const pollinations = ZERO_AUTH_ENDPOINTS.find((e) => e.id === "pollinations-ai");
    expect(pollinations).toBeDefined();
  });

  it("should contain abliterated models presets", () => {
    expect(ABLITERATED_PRESETS.length).toBeGreaterThanOrEqual(3);
    const deepseek = ABLITERATED_PRESETS.find((p) => p.slug.includes("deepseek"));
    expect(deepseek).toBeDefined();
    expect(deepseek?.refusalScore).toBeGreaterThan(90);
  });

  it("should calculate prompt cache savings accurately", () => {
    // 100k tokens prompt, 50 requests/day, $0.14 base vs $0.014 cached
    const calc = calculatePromptCacheSavings(0.14, 0.014, 100_000, 50);
    expect(calc.dailyUncachedCost).toBeCloseTo(0.70, 2);
    expect(calc.dailyCachedCost).toBeLessThan(calc.dailyUncachedCost);
    expect(calc.discountPercent).toBeGreaterThan(80);
  });
});
