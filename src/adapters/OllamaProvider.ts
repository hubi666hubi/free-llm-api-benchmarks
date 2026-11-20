import {
  ILocalLLMProvider,
  LLMGenerateOptions,
  LocalModelInfo,
  ProviderHealth,
  HEXAGONAL_ARCHITECT_SYSTEM_PROMPT,
} from "../core/chat/LLMProvider";
import { ChatMessage } from "../core/models/ChatMessage";
import { IClock, IHttpClient, IOllamaConfig } from "../core/di/interfaces";
import { SystemClock } from "../core/di/defaults";

interface OllamaWireTagModel {
  name?: string;
  size?: number;
  modified_at?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaWireTagsResponse {
  models?: OllamaWireTagModel[];
}

interface OllamaWireChatResponse {
  message?: {
    role?: string;
    content?: string;
  };
  error?: string;
}

interface OllamaWireVersionResponse {
  version?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Hexagonal Driven Adapter for a local (or self-hosted) Ollama runtime.
 *
 * Implements the pure core port `ILocalLLMProvider` (extends `ILLMProvider`)
 * while isolating all Ollama HTTP wire formats behind an Anti-Corruption Layer.
 * Never calls global `fetch` directly — always routes through injected `IHttpClient`.
 */
export class OllamaProvider implements ILocalLLMProvider {
  static readonly REACHABILITY_TTL_MS = 5_000;
  readonly name = "Ollama (Local)";
  private reachability?: { url: string; at: number; ok: boolean; error: string };
  private _baseUrl: string;
  private _defaultModel: string;
  private _numCtx: number;
  private _enabled: boolean;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly defaultKeepAlive?: string | number;
  private readonly timeoutMs: number;
  private readonly healthTimeoutMs: number;
  private readonly defaultSystemInstruction?: string;
  private readonly headers?: Record<string, string>;
  private readonly httpClient?: IHttpClient;
  private readonly clock: IClock;

  constructor(
    config: IOllamaConfig = {},
    httpClient?: IHttpClient,
    clock: IClock = new SystemClock()
  ) {
    this._baseUrl = normalizeBaseUrl(config.baseUrl || "http://localhost:11434");
    this._defaultModel = (config.defaultModel || "qwen3-coder:30b").trim();
    this._numCtx = config.numCtx ?? 32768;
    this._enabled = config.enabled ?? true;
    this.defaultTemperature = config.temperature ?? 0.2;
    this.defaultMaxTokens = config.maxTokens ?? 4096;
    this.defaultKeepAlive = config.keepAlive ?? "10m";
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.healthTimeoutMs = config.healthTimeoutMs ?? 2_500;
    this.defaultSystemInstruction = config.systemInstruction ?? HEXAGONAL_ARCHITECT_SYSTEM_PROMPT;
    this.headers = config.headers;
    this.httpClient = httpClient;
    this.clock = clock;
  }

  get baseUrl(): string {
    return this._baseUrl;
  }

  get defaultModel(): string {
    return this._defaultModel;
  }

  get numCtx(): number {
    return this._numCtx;
  }

  setModel(model: string): void {
    const trimmed = model.trim();
    if (trimmed) this._defaultModel = trimmed;
  }

  setBaseUrl(baseUrl: string): void {
    const normalized = normalizeBaseUrl(baseUrl);
    if (normalized) this._baseUrl = normalized;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  setNumCtx(numCtx: number): void {
    if (Number.isFinite(numCtx) && numCtx >= 512) {
      this._numCtx = Math.floor(numCtx);
    }
  }

  isAvailable(): boolean {
    return Boolean(this._enabled && this._baseUrl.length > 0 && this._defaultModel.length > 0);
  }

  async sendMessage(messages: ChatMessage[], options?: LLMGenerateOptions): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error("OllamaProvider jest wyłączony lub niekompletnie skonfigurowany.");
    }
    if (!this.httpClient) {
      throw new Error("OllamaProvider: brak wstrzykniętego IHttpClient.");
    }

    const model = (options?.model || this._defaultModel).trim();
    const systemPrompt = options?.systemInstruction ?? this.defaultSystemInstruction;
    const hasSystemInMessages = messages.some((m) => m.role === "system");

    const ollamaMessages = [
      ...(systemPrompt && !hasSystemInMessages
        ? [{ role: "system" as const, content: systemPrompt }]
        : []),
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const ollamaOptions: Record<string, unknown> = {
      temperature: options?.temperature ?? this.defaultTemperature,
      num_predict: options?.maxTokens ?? this.defaultMaxTokens,
      num_ctx: options?.numCtx ?? this._numCtx,
    };

    if (options?.topP !== undefined) ollamaOptions.top_p = options.topP;
    if (options?.seed !== undefined) ollamaOptions.seed = options.seed;

    const payload: Record<string, unknown> = {
      model,
      stream: false,
      messages: ollamaMessages,
      options: ollamaOptions,
    };

    if (options?.format !== undefined) {
      payload.format = options.format;
    }

    const keepAlive = options?.keepAlive ?? this.defaultKeepAlive;
    if (keepAlive !== undefined) {
      payload.keep_alive = keepAlive;
    }

    await this.ensureReachable();

    const url = `${this._baseUrl}/api/chat`;
    let response;
    try {
      response = await this.httpClient.post<OllamaWireChatResponse>(url, payload, this.headers, {
        timeoutMs: this.timeoutMs,
      });
    } catch (err: any) {
      throw new Error(
        `Nie można połączyć z Ollama pod ${this._baseUrl}. Uruchom "ollama serve" (w przeglądarce ustaw OLLAMA_ORIGINS="*"). Szczegóły: ${err?.message || String(err)}`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      let wireError = "";
      try {
        const parsed = JSON.parse(errorText);
        if (typeof parsed?.error === "string") wireError = parsed.error;
      } catch {
        wireError = errorText;
      }

      if (response.status === 404 || /model .* not found/i.test(wireError)) {
        throw new Error(
          `Model Ollama "${model}" nie jest pobrany lokalnie. Uruchom: ollama pull ${model}`
        );
      }

      throw new Error(
        `Ollama API Error (${response.status}): ${wireError || "Nieznany błąd serwera Ollama."}`
      );
    }

    const data = await response.json();
    const content = data?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("Pusta odpowiedź z lokalnego serwera Ollama.");
    }

    return content;
  }

  /**
   * Fail-fast preflight: a dead/hung server is detected within `healthTimeoutMs`
   * (not the long generation timeout), so the router can fall back immediately.
   * Result is cached briefly to avoid probing on every message.
   */
  private async ensureReachable(): Promise<void> {
    const http = this.httpClient;
    if (!http?.get) return;

    const now = this.clock.timestamp();
    const cached = this.reachability;
    if (cached && cached.url === this._baseUrl && now - cached.at < OllamaProvider.REACHABILITY_TTL_MS) {
      if (cached.ok) return;
      throw new Error(cached.error);
    }

    let error = "";
    try {
      const res = await http.get(`${this._baseUrl}/api/version`, this.headers, {
        timeoutMs: this.healthTimeoutMs,
      });
      if (!res.ok) error = `Ollama odpowiada błędem HTTP (${res.status}) pod ${this._baseUrl}.`;
    } catch (err: any) {
      error = `Nie można połączyć z Ollama pod ${this._baseUrl} (limit ${this.healthTimeoutMs} ms). Uruchom "ollama serve" (w przeglądarce ustaw OLLAMA_ORIGINS="*"). Szczegóły: ${err?.message || String(err)}`;
    }

    this.reachability = { url: this._baseUrl, at: now, ok: !error, error };
    if (error) throw new Error(error);
  }

  /**
   * Anti-Corruption Layer: queries GET /api/tags and maps Ollama wire objects
   * into pure domain `LocalModelInfo[]`.
   */
  async listModels(): Promise<LocalModelInfo[]> {
    if (!this.httpClient?.get) {
      throw new Error("OllamaProvider: wstrzyknięty IHttpClient nie obsługuje metody GET.");
    }

    const url = `${this._baseUrl}/api/tags`;
    const response = await this.httpClient.get<OllamaWireTagsResponse>(url, this.headers, {
      timeoutMs: this.healthTimeoutMs,
    });

    if (!response.ok) {
      throw new Error(`Nie można pobrać listy modeli Ollama (${response.status}).`);
    }

    const data = await response.json();
    const rawModels = Array.isArray(data?.models) ? data.models : [];

    return rawModels
      .filter((m): m is OllamaWireTagModel & { name: string } => typeof m?.name === "string" && m.name.length > 0)
      .map((m) => ({
        name: m.name,
        sizeBytes: typeof m.size === "number" ? m.size : undefined,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
        quantizationLevel: m.details?.quantization_level,
        modifiedAt: m.modified_at,
      }));
  }

  /**
   * Non-throwing health probe measuring latency via injected IClock.
   */
  async checkHealth(): Promise<ProviderHealth> {
    const start = this.clock.timestamp();

    if (!this.httpClient?.get) {
      return {
        ok: false,
        provider: this.name,
        latencyMs: Math.max(0, this.clock.timestamp() - start),
        error: "Brak wsparcia GET w wstrzykniętym IHttpClient.",
      };
    }

    try {
      const [versionRes, tagsRes] = await Promise.all([
        this.httpClient.get<OllamaWireVersionResponse>(`${this._baseUrl}/api/version`, this.headers, {
          timeoutMs: this.healthTimeoutMs,
        }),
        this.httpClient.get<OllamaWireTagsResponse>(`${this._baseUrl}/api/tags`, this.headers, {
          timeoutMs: this.healthTimeoutMs,
        }),
      ]);

      const latencyMs = Math.max(0, this.clock.timestamp() - start);

      if (!versionRes.ok && !tagsRes.ok) {
        return {
          ok: false,
          provider: this.name,
          latencyMs,
          error: `Ollama odpowiedziała błędem HTTP (${versionRes.status}).`,
        };
      }

      let version: string | undefined;
      if (versionRes.ok) {
        try {
          const v = await versionRes.json();
          version = v?.version;
        } catch {
          // ignore non-json version
        }
      }

      let modelsCount: number | undefined;
      if (tagsRes.ok) {
        try {
          const t = await tagsRes.json();
          if (Array.isArray(t?.models)) modelsCount = t.models.length;
        } catch {
          // ignore non-json tags
        }
      }

      return {
        ok: true,
        provider: this.name,
        latencyMs,
        version,
        modelsCount,
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: this.name,
        latencyMs: Math.max(0, this.clock.timestamp() - start),
        error: `Brak połączenia z ${this._baseUrl} (${err?.message || String(err)})`,
      };
    }
  }
}
