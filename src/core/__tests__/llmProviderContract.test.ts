import { describe, it, expect, vi } from "vitest";
import { OllamaProvider } from "../../adapters/OllamaProvider";
import { FetchHttpClient } from "../../adapters/FetchHttpClient";
import { createBenchmarkContainer } from "../../adapters/bootstrap";
import { GeminiProvider } from "../chat/GeminiProvider";
import { MockCatalogAssistantProvider } from "../chat/MockCatalogAssistantProvider";
import {
  ILLMProvider,
  ILocalLLMProvider,
  RECOMMENDED_HEXAGONAL_OLLAMA_MODELS,
} from "../chat/LLMProvider";
import { LLMClient } from "../chat/LLMClient";
import { ChatSession } from "../chat/ChatSession";
import { BenchmarkAssistantAgent } from "../chat/BenchmarkAssistantAgent";
import { IClock, IHttpClient, HttpResponse, HttpRequestOptions } from "../di/interfaces";
import { TOKENS } from "../di/tokens";
import { defaultCatalog } from "../../data/catalog";

class DeterministicClock implements IClock {
  private ms: number;
  private stepMs: number;

  constructor(startMs = 1_700_000_000_000, stepMs = 42) {
    this.ms = startMs;
    this.stepMs = stepMs;
  }

  now(): Date {
    return new Date(this.ms);
  }

  timestamp(): number {
    const current = this.ms;
    this.ms += this.stepMs;
    return current;
  }
}

class FakeHttpClient implements IHttpClient {
  postCalls: Array<{
    url: string;
    body: any;
    headers?: Record<string, string>;
    options?: HttpRequestOptions;
  }> = [];
  getCalls: Array<{
    url: string;
    headers?: Record<string, string>;
    options?: HttpRequestOptions;
  }> = [];

  constructor(
    private readonly handlers: {
      post?: (url: string, body: any) => Promise<HttpResponse> | HttpResponse;
      get?: (url: string) => Promise<HttpResponse> | HttpResponse;
    } = {}
  ) {}

  async post<T = any>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    this.postCalls.push({ url, body, headers, options });
    if (this.handlers.post) {
      return (await this.handlers.post(url, body)) as HttpResponse<T>;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ message: { role: "assistant", content: "OK" } }) as T,
      text: async () => "{}",
    };
  }

  async get<T = any>(
    url: string,
    headers?: Record<string, string>,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    this.getCalls.push({ url, headers, options });
    if (this.handlers.get) {
      return (await this.handlers.get(url)) as HttpResponse<T>;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}) as T,
      text: async () => "{}",
    };
  }
}

function jsonResponse(payload: unknown, status = 200): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

// ---------------------------------------------------------------------------
// 1. HEXAGONAL CONTRACT TESTS: every ILLMProvider adapter obeys the same port
// ---------------------------------------------------------------------------
const providerAdapters: Array<[string, () => ILLMProvider]> = [
  [
    "OllamaProvider (Adapter)",
    () =>
      new OllamaProvider(
        { baseUrl: "http://localhost:11434", defaultModel: "qwen3-coder:30b" },
        new FakeHttpClient({
          post: () =>
            jsonResponse({
              message: {
                role: "assistant",
                content: "Porty w core/, adaptery w adapters/.",
              },
            }),
        })
      ),
  ],
  [
    "GeminiProvider (Adapter)",
    () =>
      new GeminiProvider(
        { apiKey: "test-gemini-key-123", baseUrl: "https://api.example.com" },
        new FakeHttpClient({
          post: () =>
            jsonResponse({
              candidates: [
                {
                  content: {
                    parts: [{ text: "Porty w core/, adaptery w adapters/." }],
                  },
                },
              ],
            }),
        })
      ),
  ],
  [
    "MockCatalogAssistantProvider (Offline Domain)",
    () => new MockCatalogAssistantProvider(defaultCatalog),
  ],
];

describe.each(providerAdapters)("ILLMProvider Hexagonal Contract: %s", (_label, makeProvider) => {
  it("exposes non-empty identity metadata and reports availability", () => {
    const provider = makeProvider();
    expect(provider.name.trim().length).toBeGreaterThan(0);
    expect(provider.defaultModel.trim().length).toBeGreaterThan(0);
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns a non-empty response for a valid conversation with options", async () => {
    const provider = makeProvider();
    const reply = await provider.sendMessage(
      [{ id: "1", role: "user", content: "Który model ma największy kontekst?" }],
      { temperature: 0.2, maxTokens: 512, systemInstruction: "Odpowiadaj zwięźle." }
    );
    expect(typeof reply).toBe("string");
    expect(reply.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. OLLAMA ADAPTER: Anti-Corruption Layer, /api/chat, /api/tags, /api/version
// ---------------------------------------------------------------------------
describe("OllamaProvider Hexagonal Adapter", () => {
  it("maps domain messages & hexagonal options (num_ctx, format, seed, keep_alive) to /api/chat", async () => {
    const http = new FakeHttpClient({
      post: () =>
        jsonResponse({
          message: { role: "assistant", content: '{"ports":["ILLMProvider"]}' },
        }),
    });

    const ollama = new OllamaProvider(
      {
        baseUrl: "http://127.0.0.1:11434///",
        defaultModel: "qwen3-coder:30b",
        numCtx: 32768,
        keepAlive: "15m",
        headers: { Authorization: "Bearer local-proxy-token" },
      },
      http
    );

    const schema = {
      type: "object",
      properties: { ports: { type: "array", items: { type: "string" } } },
      required: ["ports"],
    };

    const reply = await ollama.sendMessage(
      [{ id: "u1", role: "user", content: "Wypisz porty jako JSON." }],
      {
        temperature: 0.1,
        maxTokens: 1024,
        topP: 0.85,
        seed: 7,
        numCtx: 65536,
        format: schema,
      }
    );

    expect(reply).toBe('{"ports":["ILLMProvider"]}');
    expect(http.postCalls).toHaveLength(1);

    const call = http.postCalls[0];
    expect(call.url).toBe("http://127.0.0.1:11434/api/chat");
    expect(call.headers).toEqual({ Authorization: "Bearer local-proxy-token" });
    expect(call.body.model).toBe("qwen3-coder:30b");
    expect(call.body.stream).toBe(false);
    expect(call.body.keep_alive).toBe("15m");
    expect(call.body.format).toEqual(schema);
    expect(call.body.options).toEqual({
      temperature: 0.1,
      num_predict: 1024,
      num_ctx: 65536,
      top_p: 0.85,
      seed: 7,
    });
    expect(call.body.messages[0].role).toBe("system");
    expect(call.body.messages[1]).toEqual({
      role: "user",
      content: "Wypisz porty jako JSON.",
    });
  });

  it("provides actionable error message when model is not pulled locally (404)", async () => {
    const http = new FakeHttpClient({
      post: () => jsonResponse({ error: "model 'hex-architect' not found" }, 404),
    });
    const ollama = new OllamaProvider({ defaultModel: "hex-architect" }, http);

    await expect(
      ollama.sendMessage([{ id: "1", role: "user", content: "Hej" }])
    ).rejects.toThrow(/ollama pull hex-architect/);
  });

  it("provides actionable CORS/daemon hint when Ollama server is unreachable", async () => {
    const http = new FakeHttpClient({
      post: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const ollama = new OllamaProvider({}, http);

    await expect(
      ollama.sendMessage([{ id: "1", role: "user", content: "Hej" }])
    ).rejects.toThrow(/OLLAMA_ORIGINS/);
  });

  it("fails fast via preflight (no long chat request) when server is unreachable, and caches the verdict", async () => {
    const http = new FakeHttpClient({
      get: async () => {
        throw new Error("timeout");
      },
    });
    const ollama = new OllamaProvider({ healthTimeoutMs: 1500 }, http, new DeterministicClock(0, 1));
    const msg = [{ id: "1", role: "user" as const, content: "Hej" }];

    await expect(ollama.sendMessage(msg)).rejects.toThrow(/limit 1500 ms/);
    await expect(ollama.sendMessage(msg)).rejects.toThrow(/limit 1500 ms/);
    expect(http.postCalls).toHaveLength(0);
    expect(http.getCalls).toHaveLength(1);
    expect(http.getCalls[0].options?.timeoutMs).toBe(1500);
  });

  it("reports unavailable after a failed probe so router/UI skip it, then recovers after TTL", async () => {
    let up = false;
    const http = new FakeHttpClient({
      get: async () => {
        if (!up) throw new Error("down");
        return jsonResponse({ version: "1" });
      },
    });
    const clock = new DeterministicClock(0, 1);
    const ollama = new OllamaProvider({}, http, clock);
    expect(ollama.isAvailable()).toBe(true);
    await expect(ollama.sendMessage([{ id: "1", role: "user", content: "x" }])).rejects.toThrow();
    expect(ollama.isAvailable()).toBe(false);
    up = true;
    (clock as any).ms += OllamaProvider.REACHABILITY_TTL_MS + 1;
    expect(ollama.isAvailable()).toBe(true);
  });

  it("throws clear error when IHttpClient is not injected", async () => {
    const ollama = new OllamaProvider({ enabled: true });
    await expect(
      ollama.sendMessage([{ id: "1", role: "user", content: "Hej" }])
    ).rejects.toThrow(/brak wstrzykniętego IHttpClient/);
  });

  it("translates GET /api/tags wire format into pure domain LocalModelInfo[]", async () => {
    const http = new FakeHttpClient({
      get: () =>
        jsonResponse({
          models: [
            {
              name: "qwen3-coder:30b",
              size: 18_500_000_000,
              modified_at: "2026-11-20T12:00:00Z",
              details: {
                family: "qwen3moe",
                parameter_size: "30.5B",
                quantization_level: "Q4_K_M",
              },
            },
            {
              name: "hex-architect:latest",
              size: 9_000_000_000,
              details: { family: "qwen2", parameter_size: "14.8B" },
            },
          ],
        }),
    });

    const ollama = new OllamaProvider({ baseUrl: "http://localhost:11434" }, http);
    const models = await ollama.listModels();

    expect(http.getCalls[0].url).toBe("http://localhost:11434/api/tags");
    expect(models).toEqual([
      {
        name: "qwen3-coder:30b",
        sizeBytes: 18_500_000_000,
        family: "qwen3moe",
        parameterSize: "30.5B",
        quantizationLevel: "Q4_K_M",
        modifiedAt: "2026-11-20T12:00:00Z",
      },
      {
        name: "hex-architect:latest",
        sizeBytes: 9_000_000_000,
        family: "qwen2",
        parameterSize: "14.8B",
        quantizationLevel: undefined,
        modifiedAt: undefined,
      },
    ]);
  });

  it("probes /api/version & /api/tags in checkHealth() with deterministic latency and never throws", async () => {
    const http = new FakeHttpClient({
      get: (url) => {
        if (url.endsWith("/api/version")) return jsonResponse({ version: "0.12.3" });
        return jsonResponse({ models: [{ name: "qwen3-coder:30b" }, { name: "qwen2.5-coder:14b" }] });
      },
    });
    const clock = new DeterministicClock(1000, 35);
    const ollama = new OllamaProvider({}, http, clock);

    const okHealth = await ollama.checkHealth();
    expect(okHealth).toEqual({
      ok: true,
      provider: "Ollama (Local)",
      latencyMs: 35,
      version: "0.12.3",
      modelsCount: 2,
    });

    const failingOllama = new OllamaProvider(
      {},
      new FakeHttpClient({
        get: async () => {
          throw new Error("socket hang up");
        },
      }),
      new DeterministicClock(2000, 15)
    );
    const failHealth = await failingOllama.checkHealth();
    expect(failHealth.ok).toBe(false);
    expect(failHealth.latencyMs).toBe(15);
    expect(failHealth.error).toContain("socket hang up");
  });

  it("ships curated recommended hexagonal Ollama presets with expanded numCtx", () => {
    expect(RECOMMENDED_HEXAGONAL_OLLAMA_MODELS.length).toBeGreaterThanOrEqual(4);
    for (const preset of RECOMMENDED_HEXAGONAL_OLLAMA_MODELS) {
      expect(preset.recommendedNumCtx).toBeGreaterThanOrEqual(16384);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. SOVEREIGN ROUTING & COMPOSITION ROOT INTEGRATION
// ---------------------------------------------------------------------------
describe("Sovereign Local-First Routing (Ollama -> Gemini -> Offline Catalog)", () => {
  it("routes Ollama -> Gemini -> Mock in order when upstream providers fail", async () => {
    const session = new ChatSession("chain-test");
    session.addMessage("user", "Który model ma największy kontekst?");

    const failingOllama: ILLMProvider = {
      name: "Ollama (Local)",
      defaultModel: "qwen3-coder:30b",
      isAvailable: () => true,
      sendMessage: vi.fn(async () => {
        throw new Error("Ollama offline");
      }),
    };
    const failingGemini: ILLMProvider = {
      name: "Google Gemini API",
      defaultModel: "gemini-1.5-flash",
      isAvailable: () => true,
      sendMessage: vi.fn(async () => {
        throw new Error("429 quota");
      }),
    };
    const offlineMock = new MockCatalogAssistantProvider(defaultCatalog);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const client = new LLMClient({
        providers: [failingOllama, failingGemini, offlineMock],
      });

      expect(client.getActiveProviderName()).toBe("Ollama (Local)");
      const reply = await client.dispatchMessage(session);
      expect(reply).toContain("gemini-exp-1206");
      expect(failingOllama.sendMessage).toHaveBeenCalledTimes(1);
      expect(failingGemini.sendMessage).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("wires local-first Ollama in createBenchmarkContainer when ollamaConfig is passed", async () => {
    const http = new FakeHttpClient({
      post: () =>
        jsonResponse({
          message: { role: "assistant", content: "Odpowiedź z lokalnej Ollamy!" },
        }),
    });

    const container = createBenchmarkContainer({
      catalog: defaultCatalog,
      httpClient: http,
      ollamaConfig: {
        baseUrl: "http://localhost:11434",
        defaultModel: "hex-architect",
        numCtx: 32768,
      },
    });

    const ollama = container.resolve<ILocalLLMProvider>(TOKENS.OllamaProvider);
    const agent = container.resolve<BenchmarkAssistantAgent>(TOKENS.BenchmarkAgent);

    expect(ollama.isAvailable()).toBe(true);
    expect(agent.client.getActiveProviderName()).toBe("Ollama (Local)");

    const reply = await agent.ask("Zaprojektuj port repozytorium.");
    expect(reply).toBe("Odpowiedź z lokalnej Ollamy!");
    expect(http.postCalls[0].body.model).toBe("hex-architect");

    // Disable Ollama at runtime -> falls back cleanly to offline Catalog Oracle
    agent.configureOllama({ enabled: false });
    expect(agent.client.getActiveProviderName()).toBe("Benchmark Intelligence Assistant");
  });
});

// ---------------------------------------------------------------------------
// 4. FETCH HTTP CLIENT ADAPTER (GET + POST + TIMEOUT)
// ---------------------------------------------------------------------------
describe("FetchHttpClient Adapter", () => {
  it("executes GET and POST with headers and AbortSignal when timeoutMs is set", async () => {
    let lastInit: RequestInit | undefined;
    let lastUrl = "";
    const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      lastUrl = String(url);
      lastInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new FetchHttpClient(fakeFetch);

    const getRes = await client.get("http://localhost:11434/api/tags", { "X-Test": "1" }, { timeoutMs: 500 });
    expect(getRes.ok).toBe(true);
    expect(lastUrl).toBe("http://localhost:11434/api/tags");
    expect(lastInit?.method).toBe("GET");
    expect(lastInit?.signal).toBeInstanceOf(AbortSignal);

    const postRes = await client.post("http://localhost:11434/api/chat", { model: "qwen3-coder:30b" });
    expect(postRes.ok).toBe(true);
    expect(lastInit?.method).toBe("POST");
  });
});
