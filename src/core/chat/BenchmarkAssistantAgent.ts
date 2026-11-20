import {
  IBenchmarkCatalog,
  IChatSession,
  ILLMClient,
} from "../di/interfaces";
import { GeminiProvider } from "./GeminiProvider";
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

  constructor(deps: BenchmarkAssistantAgentDependencies) {
    this.session = deps.session;
    this.client = deps.client;
    this.catalog = deps.catalog;
    this.geminiProvider = deps.geminiProvider;
    this.mockProvider = deps.mockProvider;
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
