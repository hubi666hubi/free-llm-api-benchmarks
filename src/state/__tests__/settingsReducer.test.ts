import { describe, it, expect } from "vitest";
import { settingsReducer, SettingsState } from "../settingsReducer";
import { DEFAULT_OLLAMA_SETTINGS } from "../../core/settings/OllamaSettings";

const initial = (): SettingsState => ({ ollama: { ...DEFAULT_OLLAMA_SETTINGS }, geminiApiKey: "" });

describe("settingsReducer", () => {
  it("patches ollama settings without mutating previous state", () => {
    const s0 = initial();
    const s1 = settingsReducer(s0, { type: "ollama/patch", patch: { baseUrl: "http://x:1", enabled: true } });
    expect(s1.ollama.baseUrl).toBe("http://x:1");
    expect(s1.ollama.enabled).toBe(true);
    expect(s1.ollama.model).toBe(DEFAULT_OLLAMA_SETTINGS.model);
    expect(s0.ollama.baseUrl).toBe(DEFAULT_OLLAMA_SETTINGS.baseUrl);
  });

  it("sets the gemini key in memory only", () => {
    const s1 = settingsReducer(initial(), { type: "gemini/setKey", key: "k" });
    expect(s1.geminiApiKey).toBe("k");
    expect(s1.ollama).toEqual(DEFAULT_OLLAMA_SETTINGS);
  });
});
