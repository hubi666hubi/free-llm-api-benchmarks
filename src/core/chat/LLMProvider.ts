import { ChatMessage } from "../models/ChatMessage";

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  numCtx?: number;
  format?: "json" | Record<string, unknown>;
  keepAlive?: string | number;
  systemInstruction?: string;
}

export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  sendMessage(messages: ChatMessage[], options?: LLMGenerateOptions): Promise<string>;
}

/** Domain representation of a locally installed model (decoupled from runtime wire format). */
export interface LocalModelInfo {
  name: string;
  sizeBytes?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  modifiedAt?: string;
}

/** Domain health probe result for local/remote LLM runtimes. */
export interface ProviderHealth {
  ok: boolean;
  provider: string;
  latencyMs: number;
  version?: string;
  modelsCount?: number;
  error?: string;
}

/** Segregated Port for local LLM runtimes (e.g. Ollama, llama.cpp). */
export interface ILocalLLMProvider extends ILLMProvider {
  readonly baseUrl: string;
  readonly numCtx: number;
  setModel(model: string): void;
  setBaseUrl(baseUrl: string): void;
  setEnabled(enabled: boolean): void;
  setNumCtx(numCtx: number): void;
  listModels(): Promise<LocalModelInfo[]>;
  checkHealth(): Promise<ProviderHealth>;
}

export interface HexagonalOllamaPreset {
  model: string;
  tier: string;
  minRamVram: string;
  recommendedNumCtx: number;
  notes: string;
}

/** Recommended local Ollama models tuned for Hexagonal Architecture (Ports & Adapters). */
export const RECOMMENDED_HEXAGONAL_OLLAMA_MODELS: readonly HexagonalOllamaPreset[] = [
  {
    model: "qwen3-coder:30b",
    tier: "Sweet Spot (24GB VRAM / 32GB Mac)",
    minRamVram: "24 GB",
    recommendedNumCtx: 32768,
    notes: "MoE 30B (256K ctx) — najlepszy stosunek jakości architektury, tool-callingu i szybkości lokalnie.",
  },
  {
    model: "qwen2.5-coder:14b",
    tier: "Mid-Range (12-16GB VRAM)",
    minRamVram: "12–16 GB",
    recommendedNumCtx: 32768,
    notes: "Bardzo czysty TypeScript/Python, świetne trzymanie granic portów i adapterów oraz JSON Schema.",
  },
  {
    model: "qwen2.5-coder:7b",
    tier: "Lekki / Laptop (8GB VRAM)",
    minRamVram: "8 GB",
    recommendedNumCtx: 16384,
    notes: "Szybki lokalny model do refaktoryzacji portów, DTO i testów kontraktowych.",
  },
  {
    model: "qwen3-coder-next",
    tier: "Workstation (64GB+ RAM/VRAM)",
    minRamVram: "64 GB+",
    recommendedNumCtx: 65536,
    notes: "Flagowy MoE (~80B) do analizy całych repozytoriów, granic domenowych i ADR.",
  },
  {
    model: "deepseek-coder-v2:16b",
    tier: "Alternatywa MoE (16GB VRAM)",
    minRamVram: "16 GB",
    recommendedNumCtx: 32768,
    notes: "Mocny reasoning nad grafem zależności i rozbijaniem monolitu na porty/adaptery.",
  },
];

export const HEXAGONAL_ARCHITECT_SYSTEM_PROMPT = `Jesteś ekspertem architektury heksagonalnej (Ports & Adapters / Clean Architecture).
Zawsze pilnuj żelaznych zasad:
1. Dependency Rule: rdzeń domeny (core/) NIE importuje frameworków UI, adapterów, SDK dostawców ani globalnego I/O (fetch, fs, DB).
2. Porty (interfejsy) należą do rdzenia; adaptery (HTTP, Ollama, Gemini, DB, pliki) żyją na zewnątrz i implementują porty.
3. Anti-Corruption Layer: każdy adapter tłumaczy format zewnętrzny na czyste modele domenowe.
4. Composition Root: całe okablowanie DI dzieje się wyłącznie w jednym miejscu poza rdzeniem.
5. Testy kontraktowe: każdy adapter tego samego portu musi przechodzić ten sam zestaw testów bez sieci.`;
