import { ChatSession } from "./ChatSession";
import { LLMClient } from "./LLMClient";
import { GeminiProvider } from "./GeminiProvider";
import { MockCatalogAssistantProvider } from "./MockCatalogAssistantProvider";
export class BenchmarkAssistantAgent {
    catalog;
    session;
    client;
    geminiProvider;
    mockProvider;
    constructor(catalog, geminiApiKey) {
        this.catalog = catalog;
        this.session = new ChatSession("benchmark-agent-session");
        this.geminiProvider = new GeminiProvider(geminiApiKey);
        this.mockProvider = new MockCatalogAssistantProvider(catalog);
        // Primary: Gemini if key provided, otherwise MockCatalogAssistantProvider
        this.client = new LLMClient({
            primary: this.geminiProvider.isAvailable() ? this.geminiProvider : this.mockProvider,
            fallback: this.mockProvider,
        });
        // If Gemini key is set, update primary
        if (this.geminiProvider.isAvailable()) {
            this.client.setPrimaryProvider(this.geminiProvider);
            this.client.setFallbackProvider(this.mockProvider);
        }
        else {
            this.client.setPrimaryProvider(this.mockProvider);
        }
    }
    setGeminiApiKey(key) {
        this.geminiProvider.setApiKey(key);
        if (this.geminiProvider.isAvailable()) {
            this.client.setPrimaryProvider(this.geminiProvider);
        }
        else {
            this.client.setPrimaryProvider(this.mockProvider);
        }
    }
    /**
     * Processes a user question, updates session history, and returns the assistant's answer.
     */
    async ask(userQuestion) {
        const trimmed = userQuestion.trim();
        if (!trimmed)
            return "";
        this.session.addMessage("user", trimmed);
        try {
            const response = await this.client.dispatchMessage(this.session);
            this.session.addMessage("assistant", response);
            return response;
        }
        catch (err) {
            const errorMsg = `Wystąpił błąd podczas generowania odpowiedzi: ${err?.message || String(err)}`;
            this.session.addMessage("assistant", errorMsg);
            return errorMsg;
        }
    }
    reset() {
        this.session.clear();
    }
}
