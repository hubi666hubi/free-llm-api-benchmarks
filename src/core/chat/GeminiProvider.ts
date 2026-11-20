import { ILLMProvider, LLMGenerateOptions } from "./LLMProvider";
import { ChatMessage } from "../../components/GeminiChatView";
import { IHttpClient, IGeminiConfig } from "../di/interfaces";
import { FetchHttpClient } from "../di/defaults";

export class GeminiProvider implements ILLMProvider {
  readonly name = "Google Gemini API";
  defaultModel = "gemini-1.5-flash";
  private apiKey: string | null = null;
  private readonly baseUrl: string;
  private readonly httpClient: IHttpClient;

  constructor(
    configOrApiKey?: string | IGeminiConfig,
    httpClient?: IHttpClient
  ) {
    this.httpClient = httpClient || new FetchHttpClient();

    if (typeof configOrApiKey === "string") {
      this.apiKey = configOrApiKey.trim() || null;
      this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    } else if (configOrApiKey) {
      this.apiKey = configOrApiKey.apiKey?.trim() || null;
      this.baseUrl = configOrApiKey.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
      if (configOrApiKey.defaultModel) {
        this.defaultModel = configOrApiKey.defaultModel;
      }
    } else {
      this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async sendMessage(messages: ChatMessage[], options?: LLMGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "Brak klucza Google Gemini API. Wprowadź klucz w ustawieniach lub skorzystaj z wbudowanego asystenta bazy."
      );
    }

    const model = options?.model || this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini API format
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction = options?.systemInstruction
      ? { parts: [{ text: options.systemInstruction }] }
      : undefined;

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const response = await this.httpClient.post(url, payload);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Gemini API Error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {
        // use default errorMsg
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;

    if (!textPart) {
      throw new Error("Pusta odpowiedź z Gemini API.");
    }

    return textPart;
  }
}
