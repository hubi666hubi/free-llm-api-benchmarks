import { describe, it, expect, vi } from "vitest";
import {
  Container,
  TOKENS,
  IClock,
  IIdGenerator,
  IHttpClient,
  IChatSession,
  ILLMClient,
  HttpResponse,
} from "../di";
import { createBenchmarkContainer } from "../../adapters/bootstrap";
import { ChatSession } from "../chat/ChatSession";
import { GeminiProvider } from "../chat/GeminiProvider";
import { BenchmarkAssistantAgent } from "../chat/BenchmarkAssistantAgent";
import { defaultCatalog } from "../../data/catalog";
import { ILLMProvider } from "../chat/LLMProvider";

// Test Mocks
class MockClock implements IClock {
  private currentTime: Date;

  constructor(initialIso: string = "2026-11-20T12:00:00.000Z") {
    this.currentTime = new Date(initialIso);
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  timestamp(): number {
    return this.currentTime.getTime();
  }

  advanceSeconds(seconds: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }
}

class MockIdGenerator implements IIdGenerator {
  private seq = 0;

  generateId(prefix: string = "test"): string {
    this.seq++;
    return `${prefix}-mock-${this.seq}`;
  }
}

class MockHttpClient implements IHttpClient {
  public lastUrl: string | null = null;
  public lastBody: any = null;
  public lastHeaders: Record<string, string> | undefined;
  public mockResponse: HttpResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: "Mocked Gemini Response from Injected Client" }],
          },
        },
      ],
    }),
    text: async () => "{}",
  };

  async post<T = any>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    this.lastUrl = url;
    this.lastBody = body;
    this.lastHeaders = headers;
    return this.mockResponse as HttpResponse<T>;
  }
}

describe("DI Container System", () => {
  it("should register and resolve singleton instances", () => {
    const container = new Container();
    const clock = new MockClock();
    container.registerInstance(TOKENS.Clock, clock);

    expect(container.has(TOKENS.Clock)).toBe(true);
    expect(container.resolve<IClock>(TOKENS.Clock)).toBe(clock);
  });

  it("should cache instances for singleton factories and recreate for transient factories", () => {
    const container = new Container();
    let singletonCount = 0;
    let transientCount = 0;

    container.registerFactory(
      "singleton_test",
      () => ({ id: ++singletonCount }),
      { singleton: true }
    );
    container.registerFactory(
      "transient_test",
      () => ({ id: ++transientCount }),
      { singleton: false }
    );

    const s1 = container.resolve<{ id: number }>("singleton_test");
    const s2 = container.resolve<{ id: number }>("singleton_test");
    expect(s1).toBe(s2);
    expect(singletonCount).toBe(1);

    const t1 = container.resolve<{ id: number }>("transient_test");
    const t2 = container.resolve<{ id: number }>("transient_test");
    expect(t1).not.toBe(t2);
    expect(transientCount).toBe(2);
  });

  it("should throw a clear error when resolving an unregistered token", () => {
    const container = new Container();
    expect(() => container.resolve("NonExistent")).toThrowError(
      /DI Container: No registration found for token "NonExistent"/
    );
  });

  it("should support child containers with fallback and override", () => {
    const parent = new Container();
    parent.registerInstance("config", { env: "production" });

    const child = parent.createChild();
    expect(child.resolve<{ env: string }>("config").env).toBe("production");

    child.registerInstance("config", { env: "testing" });
    expect(child.resolve<{ env: string }>("config").env).toBe("testing");
    expect(parent.resolve<{ env: string }>("config").env).toBe("production");
  });
});

describe("Injected Infrastructure (Clock & IdGenerator)", () => {
  it("should use injected MockClock and MockIdGenerator in ChatSession", () => {
    const mockClock = new MockClock("2026-01-01T00:00:00.000Z");
    const mockIdGen = new MockIdGenerator();

    const session = new ChatSession(
      undefined,
      [],
      "Test Title",
      mockClock,
      mockIdGen
    );

    expect(session.id).toBe("session-mock-1");
    expect(session.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    mockClock.advanceSeconds(10);
    const msg = session.addMessage("user", "Hello DI");

    expect(msg.id).toBe("msg-mock-2");
    expect(msg.timestamp).toEqual(new Date("2026-01-01T00:00:10.000Z"));
    expect(session.updatedAt).toEqual(new Date("2026-01-01T00:00:10.000Z"));
  });
});

describe("GeminiProvider with Injected IHttpClient", () => {
  it("should dispatch network request via injected IHttpClient without hitting real network", async () => {
    const mockHttp = new MockHttpClient();
    const provider = new GeminiProvider(
      { apiKey: "test_key_12345", baseUrl: "https://api.example.com" },
      mockHttp
    );

    expect(provider.isAvailable()).toBe(true);

    const reply = await provider.sendMessage([
      { id: "1", role: "user", content: "Tell me a joke" },
    ]);

    expect(reply).toBe("Mocked Gemini Response from Injected Client");
    expect(mockHttp.lastUrl).toBe("https://api.example.com/models/gemini-1.5-flash:generateContent");
    expect(mockHttp.lastHeaders?.["x-goog-api-key"]).toBe("test_key_12345");
    expect(mockHttp.lastBody.contents[0].parts[0].text).toBe("Tell me a joke");
  });

  it("should handle HTTP errors gracefully via injected IHttpClient", async () => {
    const mockHttp = new MockHttpClient();
    mockHttp.mockResponse = {
      ok: false,
      status: 403,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { message: "API key expired or invalid" } }),
    };

    const provider = new GeminiProvider("valid_key_string", mockHttp);

    await expect(
      provider.sendMessage([{ id: "1", role: "user", content: "Hi" }])
    ).rejects.toThrowError("API key expired or invalid");
  });
});

describe("BenchmarkAssistantAgent Main Flow Unit Tests (Pure DI)", () => {
  it("should execute main chat flow: add user message, dispatch to injected client, add assistant message", async () => {
    const mockClock = new MockClock("2026-11-20T10:00:00.000Z");
    const mockIdGen = new MockIdGenerator();
    const session = new ChatSession("test-session", [], "Test", mockClock, mockIdGen);

    let dispatchedSession: IChatSession | null = null;
    const mockClient: ILLMClient = {
      getActiveProviderName: () => "MockLLMClient",
      setPrimaryProvider: vi.fn(),
      setFallbackProvider: vi.fn(),
      dispatchMessage: vi.fn(async (sess: IChatSession) => {
        dispatchedSession = sess;
        return "Top recommendation is Gemini Exp 1206 with 2M context.";
      }),
    };

    const agent = new BenchmarkAssistantAgent({
      session,
      client: mockClient,
      catalog: defaultCatalog,
    });

    const result = await agent.ask("Which model is the best?");

    expect(result).toBe("Top recommendation is Gemini Exp 1206 with 2M context.");
    expect(mockClient.dispatchMessage).toHaveBeenCalledTimes(1);
    expect(dispatchedSession).toBe(session);

    // Verify session contains both user and assistant messages
    expect(session.messages.length).toBe(2);
    expect(session.messages[0].role).toBe("user");
    expect(session.messages[0].content).toBe("Which model is the best?");
    expect(session.messages[1].role).toBe("assistant");
    expect(session.messages[1].content).toBe("Top recommendation is Gemini Exp 1206 with 2M context.");
  });

  it("should catch client dispatch errors and record an error message in session without throwing", async () => {
    const session = new ChatSession("test-error-session");
    const mockClient: ILLMClient = {
      getActiveProviderName: () => "FailingClient",
      setPrimaryProvider: vi.fn(),
      setFallbackProvider: vi.fn(),
      dispatchMessage: vi.fn(async () => {
        throw new Error("HTTP 429: Rate limit exceeded");
      }),
    };

    const agent = new BenchmarkAssistantAgent({
      session,
      client: mockClient,
    });

    const result = await agent.ask("Trigger failure");

    expect(result).toContain("Wystąpił błąd podczas generowania odpowiedzi: HTTP 429: Rate limit exceeded");
    expect(session.messages.length).toBe(2);
    expect(session.messages[1].role).toBe("assistant");
    expect(session.messages[1].content).toContain("HTTP 429: Rate limit exceeded");
  });

  it("should ignore empty and whitespace-only queries", async () => {
    const session = new ChatSession("empty-test");
    const mockClient: ILLMClient = {
      getActiveProviderName: () => "Mock",
      setPrimaryProvider: vi.fn(),
      setFallbackProvider: vi.fn(),
      dispatchMessage: vi.fn(),
    };

    const agent = new BenchmarkAssistantAgent({
      session,
      client: mockClient,
    });

    const result = await agent.ask("   \n\t  ");
    expect(result).toBe("");
    expect(mockClient.dispatchMessage).not.toHaveBeenCalled();
    expect(session.messages.length).toBe(0);
  });

  it("should clear session when reset() is called", () => {
    const session = new ChatSession("reset-test");
    session.addMessage("user", "Hello");

    const mockClient: ILLMClient = {
      getActiveProviderName: () => "Mock",
      setPrimaryProvider: vi.fn(),
      setFallbackProvider: vi.fn(),
      dispatchMessage: vi.fn(),
    };

    const agent = new BenchmarkAssistantAgent({
      session,
      client: mockClient,
    });

    expect(agent.session.messages.length).toBe(1);
    agent.reset();
    expect(agent.session.messages.length).toBe(0);
  });

  it("should update provider when setGeminiApiKey is called", () => {
    const mockProvider: ILLMProvider = {
      name: "MockProvider",
      defaultModel: "mock-1",
      isAvailable: () => true,
      sendMessage: vi.fn(),
    };

    const geminiProvider = new GeminiProvider();
    const setPrimarySpy = vi.fn();

    const mockClient: ILLMClient = {
      getActiveProviderName: () => "Client",
      setPrimaryProvider: setPrimarySpy,
      setFallbackProvider: vi.fn(),
      dispatchMessage: vi.fn(),
    };

    const agent = new BenchmarkAssistantAgent({
      session: new ChatSession("key-test"),
      client: mockClient,
      geminiProvider,
      mockProvider,
    });

    agent.setGeminiApiKey("my-new-secret-gemini-key");
    expect(geminiProvider.isAvailable()).toBe(true);
    expect(setPrimarySpy).toHaveBeenCalledWith(geminiProvider);
  });
});

describe("DI Container Bootstrap & Integration", () => {
  it("should assemble and run full agent via createBenchmarkContainer()", async () => {
    const container = createBenchmarkContainer({
      catalog: defaultCatalog,
    });

    const agent = container.resolve<BenchmarkAssistantAgent>(TOKENS.BenchmarkAgent);
    expect(agent).toBeDefined();

    const reply = await agent.ask("Który model ma największy kontekst?");
    expect(reply).toContain("gemini-exp-1206");
    expect(agent.session.messages.length).toBe(2);
  });
});
