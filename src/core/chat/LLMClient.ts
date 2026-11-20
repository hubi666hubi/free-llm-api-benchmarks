import { ILLMProvider, LLMGenerateOptions } from "./LLMProvider";
import { IChatSession, ILLMClient } from "../di/interfaces";

export interface LLMClientConfig {
  primaryProvider?: ILLMProvider;
  fallbackProvider?: ILLMProvider;
  /** Ordered provider chain (e.g. [Ollama, Gemini, Mock]). Takes precedence if provided. */
  providers?: ILLMProvider[];
}

export class LLMClient implements ILLMClient {
  private providers: ILLMProvider[];

  constructor(config: LLMClientConfig) {
    if (config.providers && config.providers.length > 0) {
      this.providers = this.deduplicate(config.providers);
    } else {
      const list: ILLMProvider[] = [];
      if (config.primaryProvider) list.push(config.primaryProvider);
      if (config.fallbackProvider) list.push(config.fallbackProvider);
      this.providers = this.deduplicate(list);
    }
  }

  private deduplicate(list: ILLMProvider[]): ILLMProvider[] {
    const seen = new Set<ILLMProvider>();
    return list.filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  }

  setProviders(providers: ILLMProvider[]): void {
    this.providers = this.deduplicate(providers);
  }

  setPrimaryProvider(provider: ILLMProvider): void {
    const rest = this.providers.filter((p) => p !== provider);
    this.providers = [provider, ...rest];
  }

  setFallbackProvider(provider?: ILLMProvider): void {
    const primary = this.providers[0];
    if (!primary) {
      this.providers = provider ? [provider] : [];
      return;
    }
    const middle = this.providers.slice(1, -1).filter((p) => p !== provider);
    this.providers = provider ? this.deduplicate([primary, ...middle, provider]) : [primary, ...middle];
  }

  getActiveProviderName(): string {
    const active = this.providers.find((p) => p.isAvailable());
    return active ? active.name : "Brak dostępnego providera";
  }

  /**
   * Dispatches conversation through the ordered provider chain with automatic fallback.
   */
  async dispatchMessage(session: IChatSession, options?: LLMGenerateOptions): Promise<string> {
    const messages = session.messages;
    if (messages.length === 0) {
      throw new Error("Brak wiadomości w sesji do wysłania.");
    }

    const available = this.providers.filter((p) => p.isAvailable());
    if (available.length === 0) {
      if (this.providers.length > 0) {
        return await this.providers[0].sendMessage(messages, options);
      }
      throw new Error("Brak skonfigurowanego providera LLM.");
    }

    let lastError: unknown;
    for (let i = 0; i < available.length; i++) {
      const provider = available[i];
      try {
        return await provider.sendMessage(messages, options);
      } catch (err) {
        lastError = err;
        if (i < available.length - 1) {
          console.warn(
            `Provider "${provider.name}" failed, falling back to "${available[i + 1].name}":`,
            err
          );
        }
      }
    }

    throw lastError;
  }
}
