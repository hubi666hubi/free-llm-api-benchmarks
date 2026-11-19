export class MockCatalogAssistantProvider {
    name = "Benchmark Intelligence Assistant";
    defaultModel = "catalog-oracle-v1";
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    isAvailable() {
        return true;
    }
    async sendMessage(messages, _options) {
        // Simulate brief network delay for realistic feel
        await new Promise((resolve) => setTimeout(resolve, 350));
        const lastMsg = messages[messages.length - 1];
        const userQuery = (lastMsg?.content || "").trim().toLowerCase();
        // 1. Largest Context Window
        if (userQuery.includes("kontekst") ||
            userQuery.includes("context") ||
            userQuery.includes("największy") ||
            userQuery.includes("largest")) {
            const top = this.catalog.getTopByContext(5);
            return (`### Modele o największym oknie kontekstowym (1M+)\n\n` +
                `Oto modele z bazy oferujące największą pamięć roboczą:\n\n` +
                top
                    .map((m, i) => `• **${i + 1}. ${m.toolName}** (\`${m.provider}\`)\n` +
                    `  Kontekst: **${m.contextWindowTokens.toLocaleString()} tokenów** | Koszt: $${m.blendedCostPer1M.toFixed(3)}/1M | Narzędzia: ${m.supportsToolCall ? "Tak" : "Nie"} | Reasoning: ${m.supportsReasoning ? "Tak" : "Nie"}`)
                    .join("\n\n") +
                `\n\n> Liderem rankingu jest **${top[0]?.toolName}** od dostawcy **${top[0]?.provider}** z oknem ponad 2M tokenów.`);
        }
        // 2. Cheapest with Tool Calling & Reasoning
        if (userQuery.includes("najtańsz") ||
            userQuery.includes("tani") ||
            userQuery.includes("cheapest") ||
            (userQuery.includes("tool") && userQuery.includes("reasoning"))) {
            const cheapest = this.catalog.getCheapest({ minContext: 1_000_000, limit: 5 });
            return (`### Najtańsze modele 1M+ z obsługą Tool Calling & Reasoning\n\n` +
                `Jeżeli szukasz maksymalnej oszczędności przy zachowaniu zaawansowanych możliwości agentowych:\n\n` +
                cheapest
                    .map((m, i) => `• **${i + 1}. ${m.toolName}** (\`${m.provider}\` — ${m.classification})\n` +
                    `  Koszt: **$${m.blendedCostPer1M.toFixed(4)} / 1M tokenów** (Input: $${m.inputCostPer1M.toFixed(3)}, Output: $${m.outputCostPer1M.toFixed(3)})\n` +
                    `  Kontekst: ${m.contextWindowTokens.toLocaleString()} tokenów`)
                    .join("\n\n") +
                `\n\n> Te modele idealnie nadają się do budowania autonomicznych orkiestratorów bez ryzyka wysokich rachunków API.`);
        }
        // 3. Free Tier / Darmowe
        if (userQuery.includes("darmow") ||
            userQuery.includes("free") ||
            userQuery.includes("za darmo")) {
            const freeModels = this.catalog.getFreeTier();
            const topFree = freeModels.slice(0, 5);
            return (`### Dostępne modele Free-Tier ($0.00)\n\n` +
                `W katalogu znajduje się **${freeModels.length} modeli** z bezpłatnym dostępem lub pulą darmowych tokenów. Oto rekomendowane opcje:\n\n` +
                topFree
                    .map((m) => `• **${m.toolName}** (\`${m.provider}\`)\n` +
                    `  Kontekst: **${m.contextWindowTokens.toLocaleString()} tokenów** | Typ: ${m.deploymentType}\n` +
                    `  Tool Call: ${m.supportsToolCall ? "Tak" : "Nie"} | Reasoning: ${m.supportsReasoning ? "Tak" : "Nie"}`)
                    .join("\n\n") +
                `\n\nMożesz bezpośrednio wywoływać te modele w swoich prototypach i pipeline'ach testowych.`);
        }
        // 4. Arbitrage & Economics
        if (userQuery.includes("arbitraż") ||
            userQuery.includes("arbitrage") ||
            userQuery.includes("zarab") ||
            userQuery.includes("oszczęd") ||
            userQuery.includes("koszt") ||
            userQuery.includes("saas")) {
            return (`### Arbitraż cenowy: Open-Weights vs Proprietary SaaS\n\n` +
                `Analiza 11 381 modeli wykazała kolosalną dysproporcję cenową:\n\n` +
                `• **Mediana kosztu modeli Open-Weights:** $0.525 / 1M tokenów\n` +
                `• **Mediana kosztu modeli Proprietary SaaS:** $3.000 / 1M tokenów\n` +
                `• **Średnia oszczędność (Arbitraż):** **82.5% taniej** na korzyść hostowanych modeli open-weights!\n\n` +
                `### Jak na tym zarabiać w praktyce?\n\n` +
                `1. **Inteligentny Gateway (Routing):** Kierowanie zapytań wymagających dużego kontekstu do tańszych modeli 1M+, a drogich modeli SaaS używanie wyłącznie jako fallback.\n` +
                `2. **Cache i kompresja promptów:** Eliminacja powtarzających się prefiksów.\n` +
                `3. **Lokalny staging z Ollama / vLLM:** Bezkosztowe testowanie agentów przed wypuszczeniem na produkcję.`);
        }
        // 5. Specific Search (e.g. DeepSeek, Google, GLM, Alibaba, GitLab)
        const matches = this.catalog.search(userQuery);
        if (matches.length > 0 && userQuery.length > 2) {
            const topMatches = matches.slice(0, 4);
            return (`### Znaleziono ${matches.length} modeli pasujących do „${lastMsg.content}”:\n\n` +
                topMatches
                    .map((m) => `• **${m.toolName}** (\`${m.slug}\`)\n` +
                    `  Dostawca: \`${m.provider}\` | Rodzina: ${m.modelFamily}\n` +
                    `  Kontekst: ${m.contextWindowTokens.toLocaleString()} | Koszt: $${m.blendedCostPer1M.toFixed(4)}/1M | Free Tier: ${m.isFree ? "Tak" : "Nie"}`)
                    .join("\n\n"));
        }
        // Default intelligent greeting & capability overview
        const stats = this.catalog.getStats();
        return (`Cześć! Jestem asystentem bazy **Free-Tier & 1M+ Context AI/LLM APIs**.\n\n` +
            `Mam bezpośredni dostęp do bazy **${stats.totalModels} modeli** od **${stats.providersCount} dostawców** (w tym **${stats.freeTierCount} darmowych** oraz **${stats.millionPlusContextCount} z oknem 1M+**).\n\n` +
            `W czym mogę pomóc? Możesz zapytać m.in. o:\n` +
            `• *„Który model ma największy kontekst?”*\n` +
            `• *„Pokaż najtańsze modele z obsługą Tool Calling i Reasoning”*\n` +
            `• *„Jak działa arbitraż cenowy Open-Weights vs SaaS?”*\n` +
            `• *„Wyszukaj modele DeepSeek lub Google”*`);
    }
}
