import {
  IBenchmarkCatalog,
  IChatSession,
  ILLMClient,
} from "../di/interfaces";
import { GeminiProvider } from "./GeminiProvider";
import {
  ILLMProvider,
  ILocalLLMProvider,
  LocalModelInfo,
  ProviderHealth,
} from "./LLMProvider";

export interface BenchmarkAssistantAgentDependencies {
  session: IChatSession;
  client: ILLMClient;
  catalog?: IBenchmarkCatalog;
  ollamaProvider?: ILocalLLMProvider;
  geminiProvider?: GeminiProvider;
  mockProvider?: ILLMProvider;
}

export interface OllamaRuntimeOptions {
  baseUrl?: string;
  model?: string;
  numCtx?: number;
  enabled?: boolean;
}

export class BenchmarkAssistantAgent {
  readonly catalog?: IBenchmarkCatalog;
  readonly session: IChatSession;
  readonly client: ILLMClient;
  readonly ollamaProvider?: ILocalLLMProvider;
  readonly geminiProvider?: GeminiProvider;
  readonly mockProvider?: ILLMProvider;

  constructor(deps: BenchmarkAssistantAgentDependencies) {
    this.session = deps.session;
    this.client = deps.client;
    this.catalog = deps.catalog;
    this.ollamaProvider = deps.ollamaProvider;
    this.geminiProvider = deps.geminiProvider;
    this.mockProvider = deps.mockProvider;
  }

  /**
   * Configures local Ollama runtime and prioritizes it (Local-First) when enabled.
   */
  configureOllama(options: OllamaRuntimeOptions): void {
    if (!this.ollamaProvider) return;

    if (options.baseUrl !== undefined) {
      this.ollamaProvider.setBaseUrl(options.baseUrl);
    }
    if (options.model !== undefined) {
      this.ollamaProvider.setModel(options.model);
    }
    if (options.numCtx !== undefined) {
      this.ollamaProvider.setNumCtx(options.numCtx);
    }
    if (options.enabled !== undefined) {
      this.ollamaProvider.setEnabled(options.enabled);
    }

    this.syncProviderOrder("ollama");
  }

  async checkOllamaHealth(): Promise<ProviderHealth> {
    if (!this.ollamaProvider) {
      return {
        ok: false,
        provider: "Ollama (Local)",
        latencyMs: 0,
        error: "Adapter Ollama nie został wstrzyknięty do agenta.",
      };
    }
    return this.ollamaProvider.checkHealth();
  }

  async listOllamaModels(): Promise<LocalModelInfo[]> {
    if (!this.ollamaProvider) return [];
    return this.ollamaProvider.listModels();
  }

  setGeminiApiKey(key: string): void {
    if (this.geminiProvider) {
      this.geminiProvider.setApiKey(key);
      if (this.geminiProvider.isAvailable()) {
        this.client.setPrimaryProvider(this.geminiProvider);
      } else if (this.ollamaProvider?.isAvailable()) {
        this.client.setPrimaryProvider(this.ollamaProvider);
      } else if (this.mockProvider) {
        this.client.setPrimaryProvider(this.mockProvider);
      }
    }
  }

  private syncProviderOrder(preferred: "ollama" | "gemini" | "mock"): void {
    const chain: ILLMProvider[] = [];
    const add = (p?: ILLMProvider) => {
      if (p && !chain.includes(p)) chain.push(p);
    };

    if (preferred === "ollama") {
      add(this.ollamaProvider);
      add(this.geminiProvider);
      add(this.mockProvider);
    } else if (preferred === "gemini") {
      add(this.geminiProvider);
      add(this.ollamaProvider);
      add(this.mockProvider);
    } else {
      add(this.mockProvider);
      add(this.ollamaProvider);
      add(this.geminiProvider);
    }

    if (this.client.setProviders && chain.length > 0) {
      this.client.setProviders(chain);
    } else {
      const firstAvailable = chain.find((p) => p.isAvailable());
      if (firstAvailable) {
        this.client.setPrimaryProvider(firstAvailable);
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
