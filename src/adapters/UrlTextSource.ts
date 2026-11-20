import { ITextSource } from "../core/catalog/CatalogRepository";

/** Adapter: reads catalog text over HTTP(S) (the only place doing a GET fetch). */
export class UrlTextSource implements ITextSource {
  constructor(
    private readonly url: string,
    private readonly fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {}

  async readText(): Promise<string> {
    const res = await this.fetchFn(this.url);
    if (!res.ok) throw new Error(`Nie można pobrać katalogu (${res.status}) z ${this.url}`);
    return res.text();
  }
}
