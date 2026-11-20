/** Port: minimal synchronous key-value store (localStorage, memory, file...). */
export interface ISettingsStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface OllamaSettings {
  enabled: boolean;
  baseUrl: string;
  model: string;
  numCtx: number;
}

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
  enabled: false,
  baseUrl: "http://localhost:11434",
  model: "qwen3-coder:30b",
  numCtx: 32768,
};

export const OLLAMA_SETTINGS_KEY = "ollama.settings.v1";

/** Validates unknown data; invalid fields fall back to defaults. */
export function sanitizeOllamaSettings(raw: unknown): OllamaSettings {
  const d = DEFAULT_OLLAMA_SETTINGS;
  if (typeof raw !== "object" || raw === null) return { ...d };
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    baseUrl: str(o.baseUrl, d.baseUrl),
    model: str(o.model, d.model),
    numCtx:
      typeof o.numCtx === "number" && Number.isFinite(o.numCtx) && o.numCtx >= 512
        ? Math.floor(o.numCtx)
        : d.numCtx,
  };
}

export class OllamaSettingsRepository {
  constructor(private readonly store: ISettingsStore) {}

  load(): OllamaSettings {
    try {
      const text = this.store.get(OLLAMA_SETTINGS_KEY);
      return sanitizeOllamaSettings(text ? JSON.parse(text) : null);
    } catch {
      return { ...DEFAULT_OLLAMA_SETTINGS };
    }
  }

  save(settings: OllamaSettings): void {
    try {
      this.store.set(OLLAMA_SETTINGS_KEY, JSON.stringify(sanitizeOllamaSettings(settings)));
    } catch {
      // storage unavailable/full: settings stay session-only
    }
  }

  reset(): void {
    this.store.remove(OLLAMA_SETTINGS_KEY);
  }
}

export class MemorySettingsStore implements ISettingsStore {
  private readonly data = new Map<string, string>();
  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}
