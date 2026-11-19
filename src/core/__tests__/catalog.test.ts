import { describe, it, expect } from "vitest";
import { defaultCatalog } from "../../data/catalog";
import { ChatSession } from "../chat/ChatSession";
import { MockCatalogAssistantProvider } from "../chat/MockCatalogAssistantProvider";
import { LLMClient } from "../chat/LLMClient";

describe("BenchmarkCatalog & LLMModel Domain Tests", () => {
  it("should have parsed 100 benchmark models into defaultCatalog", () => {
    expect(defaultCatalog.length).toBe(100);
  });

  it("should find Google Gemini Exp model by slug", () => {
    const model = defaultCatalog.findBySlug("google/gemini-exp-1206");
    expect(model).toBeDefined();
    expect(model?.toolName).toBe("gemini-exp-1206");
    expect(model?.provider).toBe("google");
    expect(model?.contextWindowTokens).toBe(2097152);
    expect(model?.isFree).toBe(true);
    expect(model?.isMillionPlus).toBe(true);
    expect(model?.supportsToolCall).toBe(true);
    expect(model?.supportsReasoning).toBe(true);
  });

  it("should calculate cost estimates correctly", () => {
    const model = defaultCatalog.findBySlug("google/gemini-exp-1206");
    expect(model?.estimateCost(500000, 100000)).toBe(0);

    const paidModel = defaultCatalog.findBySlug("kyma/glm-5.3");
    expect(paidModel).toBeDefined();
    if (paidModel) {
      // 1M input ($1.178) + 1M output ($3.702) = 4.88
      const cost = paidModel.estimateCost(1000000, 1000000);
      expect(cost).toBeCloseTo(4.88, 2);
    }
  });

  it("should calculate cost arbitrage against $3.00/1M baseline", () => {
    const model = defaultCatalog.findBySlug("kyma/glm-5.3-flash");
    expect(model).toBeDefined();
    if (model) {
      const arb = model.calculateArbitrageVs(3.00);
      expect(arb.dollarDiff).toBeGreaterThan(2.5);
      expect(arb.percentSavings).toBeGreaterThan(80);
    }
  });

  it("should return top models by context window in descending order", () => {
    const top10 = defaultCatalog.getTopByContext(10);
    expect(top10.length).toBe(10);
    for (let i = 0; i < top10.length - 1; i++) {
      expect(top10[i].contextWindowTokens).toBeGreaterThanOrEqual(top10[i + 1].contextWindowTokens);
    }
    expect(top10[0].contextWindowTokens).toBeGreaterThanOrEqual(2000000);
  });

  it("should return cheapest models supporting tools and reasoning", () => {
    const cheapest = defaultCatalog.getCheapest({ minContext: 1000000, limit: 5 });
    expect(cheapest.length).toBe(5);
    for (const m of cheapest) {
      expect(m.supportsToolCall).toBe(true);
      expect(m.supportsReasoning).toBe(true);
      expect(m.contextWindowTokens).toBeGreaterThanOrEqual(1000000);
    }
    for (let i = 0; i < cheapest.length - 1; i++) {
      expect(cheapest[i].blendedCostPer1M).toBeLessThanOrEqual(cheapest[i + 1].blendedCostPer1M);
    }
  });

  it("should search models by keyword", () => {
    const matches = defaultCatalog.search("deepseek");
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      const match = m.slug.includes("deepseek") || m.toolName.toLowerCase().includes("deepseek");
      expect(match).toBe(true);
    }
  });

  it("should compute provider summary accurately", () => {
    const summary = defaultCatalog.getProviderSummary("google");
    expect(summary).toBeDefined();
    expect(summary?.provider).toBe("google");
    expect(summary?.modelCount).toBeGreaterThanOrEqual(1);
    expect(summary?.maxContextWindowTokens).toBe(2097152);
  });

  it("should compute global catalog statistics", () => {
    const stats = defaultCatalog.getStats();
    expect(stats.totalModels).toBe(100);
    expect(stats.providersCount).toBeGreaterThan(10);
    expect(stats.freeTierCount).toBeGreaterThan(10);
    expect(stats.millionPlusContextCount).toBeGreaterThan(50);
  });
});

describe("ChatSession & Assistant Tests", () => {
  it("should record messages and notify subscribers", () => {
    const session = new ChatSession("test-session");
    let notifyCount = 0;
    const unsubscribe = session.subscribe(() => {
      notifyCount++;
    });

    session.addMessage("user", "Witaj!");
    session.addMessage("assistant", "Cześć! W czym mogę pomóc?");

    expect(session.messages.length).toBe(2);
    expect(notifyCount).toBe(2);

    unsubscribe();
    session.addMessage("user", "Kolejne pytanie");
    expect(notifyCount).toBe(2);
  });

  it("should serialize and deserialize session state", () => {
    const session = new ChatSession("s-1");
    session.addMessage("user", "Test message");
    const jsonStr = session.toJSON();

    const restored = ChatSession.fromJSON(jsonStr);
    expect(restored.id).toBe("s-1");
    expect(restored.messages.length).toBe(1);
    expect(restored.messages[0].content).toBe("Test message");
  });

  it("should generate answers with MockCatalogAssistantProvider", async () => {
    const provider = new MockCatalogAssistantProvider(defaultCatalog);
    const session = new ChatSession("test-chat");

    session.addMessage("user", "Jaki model ma największy kontekst?");
    const response = await provider.sendMessage(session.messages);

    expect(response).toContain("Modele o największym oknie kontekstowym");
    expect(response).toContain("gemini-exp-1206");
  });

  it("should dispatch message through LLMClient with fallback", async () => {
    const mockProvider = new MockCatalogAssistantProvider(defaultCatalog);
    const client = new LLMClient({
      primaryProvider: mockProvider,
    });

    const session = new ChatSession("client-test");
    session.addMessage("user", "Pokaż modele darmowe");

    const response = await client.dispatchMessage(session);
    expect(response).toContain("Free-Tier");
  });
});
