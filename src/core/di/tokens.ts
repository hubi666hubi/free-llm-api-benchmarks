export const TOKENS = {
  Clock: "Clock",
  IdGenerator: "IdGenerator",
  HttpClient: "HttpClient",
  GeminiConfig: "GeminiConfig",
  OllamaConfig: "OllamaConfig",
  Catalog: "Catalog",
  OllamaProvider: "OllamaProvider",
  GeminiProvider: "GeminiProvider",
  MockProvider: "MockProvider",
  LLMClient: "LLMClient",
  ChatSession: "ChatSession",
  BenchmarkAgent: "BenchmarkAgent",
} as const;

export type TokenKey = keyof typeof TOKENS;
