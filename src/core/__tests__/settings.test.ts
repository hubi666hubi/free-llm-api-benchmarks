import { describe, it, expect } from "vitest";
import {
  OllamaSettingsRepository,
  MemorySettingsStore,
  ISettingsStore,
  DEFAULT_OLLAMA_SETTINGS,
  OLLAMA_SETTINGS_KEY,
} from "../settings/OllamaSettings";
import { LocalStorageSettingsStore } from "../../adapters/LocalStorageSettingsStore";

const fakeStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const stores: [string, () => ISettingsStore][] = [
  ["Memory", () => new MemorySettingsStore()],
  ["LocalStorage", () => new LocalStorageSettingsStore(fakeStorage())],
];

describe.each(stores)("OllamaSettingsRepository contract: %s", (_n, make) => {
  it("returns defaults when empty, round-trips, and resets", () => {
    const repo = new OllamaSettingsRepository(make());
    expect(repo.load()).toEqual(DEFAULT_OLLAMA_SETTINGS);
    const s = { enabled: true, baseUrl: "http://10.0.0.5:11434", model: "hex-architect", numCtx: 65536 };
    repo.save(s);
    expect(repo.load()).toEqual(s);
    repo.reset();
    expect(repo.load()).toEqual(DEFAULT_OLLAMA_SETTINGS);
  });

  it("falls back to defaults on corrupt or invalid data", () => {
    const store = make();
    store.set(OLLAMA_SETTINGS_KEY, "{broken");
    expect(new OllamaSettingsRepository(store).load()).toEqual(DEFAULT_OLLAMA_SETTINGS);
    store.set(OLLAMA_SETTINGS_KEY, JSON.stringify({ enabled: "yes", model: "", numCtx: 3 }));
    expect(new OllamaSettingsRepository(store).load()).toEqual(DEFAULT_OLLAMA_SETTINGS);
  });
});

describe("LocalStorageSettingsStore resilience", () => {
  it("keeps working in memory when storage throws", () => {
    const bad = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("denied"); },
    };
    const repo = new OllamaSettingsRepository(new LocalStorageSettingsStore(bad));
    repo.save({ ...DEFAULT_OLLAMA_SETTINGS, model: "x" });
    expect(repo.load().model).toBe("x");
  });
});
