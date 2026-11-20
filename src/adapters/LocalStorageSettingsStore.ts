import { ISettingsStore, MemorySettingsStore } from "../core/settings/OllamaSettings";

/** Adapter: browser localStorage; degrades to in-memory when unavailable. */
export class LocalStorageSettingsStore implements ISettingsStore {
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  private readonly fallback = new MemorySettingsStore();

  constructor(storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
    this.storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  }

  get(key: string): string | null {
    try {
      return this.storage ? this.storage.getItem(key) : this.fallback.get(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  set(key: string, value: string): void {
    try {
      if (this.storage) this.storage.setItem(key, value);
      else this.fallback.set(key, value);
    } catch {
      this.fallback.set(key, value);
    }
  }

  remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // ignore
    }
    this.fallback.remove(key);
  }
}
