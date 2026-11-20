import { ILLMProvider, LLMGenerateOptions } from "./LLMProvider";
import { IChatSession, ILLMClient } from "../di/interfaces";

export interface LLMClientConfig {
  primaryProvider: ILLMProvider;
  fallbackProvider?: ILLMProvider;
}

export class LLMClient implements ILLMClient {
  private primaryProvider: ILLMProvider;
  private fallbackProvider?: ILLMProvider;

  constructor(config: LLMClientConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProvider = config.fallbackProvider;
  }

  setPrimaryProvider(provider: ILLMProvider): void {
    this.primaryProvider = provider;
  }

  setFallbackProvider(provider?: ILLMProvider): void {
    this.fallbackProvider = provider;
  }

  getActiveProviderName(): string {
    if (this.primaryProvider.isAvailable()) {
      return this.primaryProvider.name;
    }
    if (this.fallbackProvider && this.fallbackProvider.isAvailable()) {
      return this.fallbackProvider.name;
    }
    return "Brak dostępnego providera";
  }

  /**
   * Dispatches conversation to the active provider and handles fallback if needed.
   */
  async dispatchMessage(session: IChatSession, options?: LLMGenerateOptions): Promise<string> {
    const messages = session.messages;
    if (messages.length === 0) {
      throw new Error("Brak wiadomości w sesji do wysłania.");
    }

    let providerToUse = this.primaryProvider;
    if (!providerToUse.isAvailable() && this.fallbackProvider && this.fallbackProvider.isAvailable()) {
      providerToUse = this.fallbackProvider;
    }

    try {
      return await providerToUse.sendMessage(messages, options);
    } catch (primaryError) {
      if (this.fallbackProvider && providerToUse !== this.fallbackProvider && this.fallbackProvider.isAvailable()) {
        console.warn("Primary provider failed, switching to fallback:", primaryError);
        return await this.fallbackProvider.sendMessage(messages, options);
      }
      throw primaryError;
    }
  }
}
