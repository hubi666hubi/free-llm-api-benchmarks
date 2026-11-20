import { Container } from "./container";
import { TOKENS } from "./tokens";
import {
  IClock,
  IIdGenerator,
  IHttpClient,
  IGeminiConfig,
  IBenchmarkCatalog,
  IChatSession,
  ILLMClient,
} from "./interfaces";
import { SystemClock, DefaultIdGenerator, FetchHttpClient } from "./defaults";
import { ChatSession } from "../chat/ChatSession";
import { GeminiProvider } from "../chat/GeminiProvider";
import { MockCatalogAssistantProvider } from "../chat/MockCatalogAssistantProvider";
import { LLMClient } from "../chat/LLMClient";
import { BenchmarkAssistantAgent } from "../chat/BenchmarkAssistantAgent";

export interface ContainerBootstrapOptions {
  catalog?: IBenchmarkCatalog;
  geminiApiKey?: string;
  geminiConfig?: IGeminiConfig;
  clock?: IClock;
  idGenerator?: IIdGenerator;
  httpClient?: IHttpClient;
  session?: IChatSession;
  llmClient?: ILLMClient;
}

export function createBenchmarkContainer(options: ContainerBootstrapOptions = {}): Container {
  const container = new Container();

  // Foundational infrastructure abstractions
  container.registerInstance<IClock>(TOKENS.Clock, options.clock || new SystemClock());
  container.registerInstance<IIdGenerator>(TOKENS.IdGenerator, options.idGenerator || new DefaultIdGenerator());
  container.registerInstance<IHttpClient>(TOKENS.HttpClient, options.httpClient || new FetchHttpClient());

  // Configuration
  const geminiConfig: IGeminiConfig = options.geminiConfig || {
    apiKey: options.geminiApiKey || "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-flash",
  };
  container.registerInstance<IGeminiConfig>(TOKENS.GeminiConfig, geminiConfig);

  // Catalog
  if (options.catalog) {
    container.registerInstance<IBenchmarkCatalog>(TOKENS.Catalog, options.catalog);
  }

  // ChatSession
  if (options.session) {
    container.registerInstance<IChatSession>(TOKENS.ChatSession, options.session);
  } else {
    container.registerFactory<IChatSession>(
      TOKENS.ChatSession,
      (c) => {
        return new ChatSession(
          "benchmark-agent-session",
          [],
          "Nowa konwersacja",
          c.resolve<IClock>(TOKENS.Clock),
          c.resolve<IIdGenerator>(TOKENS.IdGenerator)
        );
      },
      { singleton: true }
    );
  }

  // Gemini Provider
  container.registerFactory<GeminiProvider>(
    TOKENS.GeminiProvider,
    (c) => {
      return new GeminiProvider(
        c.resolve<IGeminiConfig>(TOKENS.GeminiConfig),
        c.resolve<IHttpClient>(TOKENS.HttpClient)
      );
    },
    { singleton: true }
  );

  // Mock Provider
  container.registerFactory<MockCatalogAssistantProvider>(
    TOKENS.MockProvider,
    (c) => {
      const catalog = c.resolve<IBenchmarkCatalog>(TOKENS.Catalog);
      return new MockCatalogAssistantProvider(catalog);
    },
    { singleton: true }
  );

  // LLM Client
  if (options.llmClient) {
    container.registerInstance<ILLMClient>(TOKENS.LLMClient, options.llmClient);
  } else {
    container.registerFactory<ILLMClient>(
      TOKENS.LLMClient,
      (c) => {
        const gemini = c.resolve<GeminiProvider>(TOKENS.GeminiProvider);
        const mock = c.resolve<MockCatalogAssistantProvider>(TOKENS.MockProvider);
        return new LLMClient({
          primaryProvider: gemini.isAvailable() ? gemini : mock,
          fallbackProvider: mock,
        });
      },
      { singleton: true }
    );
  }

  // Benchmark Agent
  container.registerFactory<BenchmarkAssistantAgent>(
    TOKENS.BenchmarkAgent,
    (c) => {
      return new BenchmarkAssistantAgent({
        session: c.resolve<IChatSession>(TOKENS.ChatSession),
        client: c.resolve<ILLMClient>(TOKENS.LLMClient),
        catalog: c.has(TOKENS.Catalog) ? c.resolve<IBenchmarkCatalog>(TOKENS.Catalog) : undefined,
        geminiProvider: c.resolve<GeminiProvider>(TOKENS.GeminiProvider),
        mockProvider: c.resolve<MockCatalogAssistantProvider>(TOKENS.MockProvider),
      });
    },
    { singleton: true }
  );

  return container;
}
