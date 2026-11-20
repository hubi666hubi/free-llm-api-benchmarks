import {
  IBenchmarkCatalog,
  IChatSession,
  ILLMClient,
} from "../di/interfaces";
import { createBenchmarkContainer } from "../di/bootstrap";
import { TOKENS } from "../di/tokens";
import { GeminiProvider } from "./GeminiProvider";
import { MockCatalogAssistantProvider } from "./MockCatalogAssistantProvider";
import { ILLMProvider } from "./LLMProvider";

export interface BenchmarkAssistantAgentDependencies {
  session: IChatSession;
  client: ILLMClient;
  catalog?: IBenchmarkCatalog;
  geminiProvider?: GeminiProvider;
  mockProvider?: ILLMProvider;
}

export class BenchmarkAssistantAgent {
  readonly catalog?: IBenchmarkCatalog;
  readonly session: IChatSession;
  readonly client: ILLMClient;
  readonly geminiProvider?: GeminiProvider;
  readonly mockProvider?: ILLMProvider;

  constructor(
    catalogOrDeps: IBenchmarkCatalog | BenchmarkAssistantAgentDependencies,
    geminiApiKey?: string
  ) {
    if ("session" in catalogOrDeps && "client" in catalogOrDeps) {
      // Pure Dependency Injection via constructor
      this.session = catalogOrDeps.session;
      this.client = catalogOrDeps.client;
      this.catalog = catalogOrDeps.catalog;
      this.geminiProvider = catalogOrDeps.geminiProvider;
      this.mockProvider = catalogOrDeps.mockProvider;
      return;
    }

    // Composition root via DI container for default/backwards-compatible wiring
    const catalog = catalogOrDeps as IBenchmarkCatalog;
    const container = createBenchmarkContainer({
      catalog,
      geminiApiKey,
    });

    this.catalog = catalog;
    this.session = container.resolve<IChatSession>(TOKENS.ChatSession);
    this.geminiProvider = container.resolve<GeminiProvider>(TOKENS.GeminiProvider);
    this.mockProvider = container.resolve<MockCatalogAssistantProvider>(TOKENS.MockProvider);
    this.client = container.resolve<ILLMClient>(TOKENS.LLMClient);
  }

  setGeminiApiKey(key: string): void {
    if (this.geminiProvider) {
      this.geminiProvider.setApiKey(key);
      if (this.geminiProvider.isAvailable()) {
        this.client.setPrimaryProvider(this.geminiProvider);
      } else if (this.mockProvider) {
        this.client.setPrimaryProvider(this.mockProvider);
      }
    }
  }

  /**
   * Processes a user question, updates session history, and returns the assistant's answer.
   */
  async ask(userQuestion: string): Promise<string> {
    const trimmed = userQuestion.trim();
    if (!trimmed) return "";

    this.session.addMessage("user", trimmed);

    try {
      const response = await this.client.dispatchMessage(this.session);
      this.session.addMessage("assistant", response);
      return response;
    } catch (err: any) {
      const errorMsg = `Wystąpił błąd podczas generowania odpowiedzi: ${err?.message || String(err)}`;
      this.session.addMessage("assistant", errorMsg);
      return errorMsg;
    }
  }

  reset(): void {
    this.session.clear();
  }
}
