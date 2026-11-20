import { ILLMProvider, LLMGenerateOptions } from "./LLMProvider";
import { ChatMessage } from "../../components/GeminiChatView";
import { IBenchmarkCatalog } from "../di/interfaces";

export class MockCatalogAssistantProvider implements ILLMProvider {
  readonly name = "Benchmark Intelligence Assistant";
  readonly defaultModel = "catalog-oracle-v1";
  private readonly catalog: IBenchmarkCatalog;

  constructor(catalog: IBenchmarkCatalog) {
    this.catalog = catalog;
  }

  isAvailable(): boolean {
    return true;
  }

  async sendMessage(messages: ChatMessage[], _options?: LLMGenerateOptions): Promise<string> {
    // Simulate brief network delay for realistic feel
    await new Promise((resolve) => setTimeout(resolve, 350));

    const lastMsg = messages[messages.length - 1];
    const userQuery = (lastMsg?.content || "").trim().toLowerCase();

    // 1. Largest Context Window
    if (
      userQuery.includes("kontekst") ||
      userQuery.includes("context") ||
      userQuery.includes("największy") ||
      userQuery.includes("largest")
    ) {
      const top = this.catalog.getTopByContext(5);
      return (
        `### Modele o największym oknie kontekstowym (1M+)\n\n` +
        `Oto modele z bazy oferujące największą pamięć roboczą:\n\n` +
        top
          .map(
            (m, i) =>
              `• **${i + 1}. ${m.toolName}** (\`${m.provider}\`)\n` +
              `  Kontekst: **${m.contextWindowTokens.toLocaleString()} tokenów** | Koszt: $${m.blendedCostPer1M.toFixed(3)}/1M | Narzędzia: ${m.supportsToolCall ? "Tak" : "Nie"} | Reasoning: ${m.supportsReasoning ? "Tak" : "Nie"}`
          )
          .join("\n\n") +
        `\n\n> Liderem rankingu jest **${top[0]?.toolName}** od dostawcy **${top[0]?.provider}** z oknem ponad 2M tokenów.`
      );
    }

    // 2. Cheapest with Tool Calling & Reasoning
    if (
      userQuery.includes("najtańsz") ||
      userQuery.includes("tani") ||
      userQuery.includes("cheapest") ||
      (userQuery.includes("tool") && userQuery.includes("reasoning"))
    ) {
      const cheapest = this.catalog.getCheapest({ minContext: 1_000_000, limit: 5 });
      return (
        `### Najtańsze modele 1M+ z obsługą Tool Calling & Reasoning\n\n` +
        `Jeżeli szukasz maksymalnej oszczędności przy zachowaniu zaawansowanych możliwości agentowych:\n\n` +
        cheapest
          .map(
            (m, i) =>
              `• **${i + 1}. ${m.toolName}** (\`${m.provider}\` — ${m.classification})\n` +
              `  Koszt: **$${m.blendedCostPer1M.toFixed(4)} / 1M tokenów** (Input: $${m.inputCostPer1M.toFixed(3)}, Output: $${m.outputCostPer1M.toFixed(3)})\n` +
              `  Kontekst: ${m.contextWindowTokens.toLocaleString()} tokenów`
          )
          .join("\n\n") +
        `\n\n> Te modele idealnie nadają się do budowania autonomicznych orkiestratorów bez ryzyka wysokich rachunków API.`
      );
    }

    // 3. Free Tier / Darmowe
    if (
      userQuery.includes("darmow") ||
      userQuery.includes("free") ||
      userQuery.includes("za darmo")
    ) {
      const freeModels = this.catalog.getFreeTier();
      const topFree = freeModels.slice(0, 5);
      return (
        `### Dostępne modele Free-Tier ($0.00)\n\n` +
        `W katalogu znajduje się **${freeModels.length} modeli** z bezpłatnym dostępem lub pulą darmowych tokenów. Oto rekomendowane opcje:\n\n` +
        topFree
          .map(
            (m) =>
              `• **${m.toolName}** (\`${m.provider}\`)\n` +
              `  Kontekst: **${m.contextWindowTokens.toLocaleString()} tokenów** | Typ: ${m.deploymentType}\n` +
              `  Tool Call: ${m.supportsToolCall ? "Tak" : "Nie"} | Reasoning: ${m.supportsReasoning ? "Tak" : "Nie"}`
          )
          .join("\n\n") +
        `\n\nMożesz bezpośrednio wywoływać te modele w swoich prototypach i pipeline'ach testowych.`
      );
    }

    // 4. Arbitrage & Economics
    if (
      userQuery.includes("arbitraż") ||
      userQuery.includes("arbitrage") ||
      userQuery.includes("zarab") ||
      userQuery.includes("oszczęd") ||
      userQuery.includes("koszt") ||
      userQuery.includes("saas")
    ) {
      return (
        `### Monetyzacja i Arbitraż Kosztów AI\n\n` +
        `Katalog pozwala zredukować koszty infrastruktury AI nawet o **90-99%** względem modeli komercyjnych (np. GPT-4o czy Claude 3.5 Sonnet):\n\n` +
        `1. **Zero-Cost Routing:** Kierowanie powtarzalnych promptów do darmowych modeli z 1M+ kontekstem (np. Google Gemini Exp / Flash z darmowym RPS).\n` +
        `2. **Lokalny fallback / Open Weights:** Hostowanie lub korzystanie z DeepSeek V3 / Qwen 2.5 po cenach $0.14 - $0.28 / 1M tokenów.\n` +
        `3. **Degen Proxy:** Wykorzystanie puli wielu rotowanych darmowych kluczy w architekturze round-robin z automatycznym przełączaniem po kodzie HTTP 429.`
      );
    }

    // Default conversational reply
    return (
      `Jestem inteligentnym asystentem bazy **100+ Free-Tier & 1M+ Context AI APIs**.\n\n` +
      `Mogę odpowiedzieć na Twoje pytania dotyczące:\n` +
      `• Modeli o największym oknie kontekstowym (np. *„który model ma największy kontekst?”*)\n` +
      `• Najtańszych modeli z obsługą Tool Calling & Reasoning (np. *„pokaż najtańsze modele do agentów”*)\n` +
      `• Dostępnych darmowych modeli ($0.00 Free Tier)\n` +
      `• Strategii arbitrażu cenowego tokenów i ochrony przed rate limitami 429\n\n` +
      `W czym mogę Ci dzisiaj pomóc?`
    );
  }
}
