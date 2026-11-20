import { IClock, IIdGenerator, IHttpClient, HttpResponse } from "./interfaces";

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  timestamp(): number {
    return Date.now();
  }
}

export class DefaultIdGenerator implements IIdGenerator {
  private counter = 0;

  generateId(prefix: string = "id"): string {
    this.counter = (this.counter + 1) % 1_000_000;
    const rand = Math.random().toString(36).substring(2, 7);
    return `${prefix}-${Date.now()}-${rand}-${this.counter}`;
  }
}

export class FetchHttpClient implements IHttpClient {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = globalThis.fetch) {
    this.fetchFn = fetchFn;
  }

  async post<T = any>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
      text: () => response.text(),
    };
  }
}
