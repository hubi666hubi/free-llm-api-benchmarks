import { ChatMessage } from "../../components/GeminiChatView";
import { LLMGenerateOptions, ILLMProvider } from "../chat/LLMProvider";
import { LLMModel } from "../models/LLMModel";
import {
  CatalogFilterOptions,
  ProviderSummary,
  CatalogStats,
  ModelRequirements,
  ModelComparison,
} from "../catalog/BenchmarkCatalog";

export interface IClock {
  now(): Date;
  timestamp(): number;
}

export interface IIdGenerator {
  generateId(prefix?: string): string;
}

export interface HttpResponse<T = any> {
  ok: boolean;
  status: number;
  json(): Promise<T>;
  text(): Promise<string>;
}

export interface IHttpClient {
  post<T = any>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>>;
}

export interface IGeminiConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export type SessionListener = (messages: ChatMessage[]) => void;

export interface IChatSession {
  readonly id: string;
  title: string;
  readonly messages: ChatMessage[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  addMessage(role: ChatMessage["role"], content: string): ChatMessage;
  updateMessage(id: string, newContent: string): void;
  clear(): void;
  estimateTokens(): number;
  subscribe(listener: SessionListener): () => void;
  toJSON(): string;
}

export interface ILLMClient {
  getActiveProviderName(): string;
  setPrimaryProvider(provider: ILLMProvider): void;
  setFallbackProvider(provider?: ILLMProvider): void;
  dispatchMessage(session: IChatSession, options?: LLMGenerateOptions): Promise<string>;
}

export interface IBenchmarkCatalog {
  readonly models: LLMModel[];
  readonly length: number;
  getAll(): LLMModel[];
  findBySlug(slug: string): LLMModel | undefined;
  search(query: string): LLMModel[];
  getFreeTier(): LLMModel[];
  getMillionPlus(): LLMModel[];
  getTopByContext(limit?: number): LLMModel[];
  getCheapest(options: {
    minContext?: number;
    requireTools?: boolean;
    requireReasoning?: boolean;
    limit?: number;
  }): LLMModel[];
  filter(options: CatalogFilterOptions): LLMModel[];
  getProviders(): string[];
  getProviderSummary(provider: string): ProviderSummary | undefined;
  getStats(): CatalogStats;
  recommend(requirements: ModelRequirements): LLMModel[];
  getParetoFrontier(): LLMModel[];
  compareModels(modelA: LLMModel, modelB: LLMModel): ModelComparison;
  getModelsByProvider(): Record<string, LLMModel[]>;
}

export type Factory<T> = (container: IDependencyContainer) => T;

export interface RegistrationOptions {
  singleton?: boolean;
}

export interface IDependencyContainer {
  registerInstance<T>(token: string | symbol, instance: T): this;
  registerFactory<T>(token: string | symbol, factory: Factory<T>, options?: RegistrationOptions): this;
  resolve<T>(token: string | symbol): T;
  has(token: string | symbol): boolean;
  clear(): void;
  createChild(): IDependencyContainer;
}
