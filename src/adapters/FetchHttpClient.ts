import { IHttpClient, HttpResponse, HttpRequestOptions } from "../core/di/interfaces";

export class FetchHttpClient implements IHttpClient {
  private readonly fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.fetchFn = fetchFn;
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const controller = options?.timeoutMs ? new AbortController() : undefined;
    const timer =
      controller && options?.timeoutMs
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : undefined;

    try {
      const response = await this.fetchFn(url, {
        ...init,
        signal: controller?.signal ?? init.signal,
      });

      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
        text: () => response.text(),
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async post<T = any>(
    url: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      },
      options
    );
  }

  async get<T = any>(
    url: string,
    headers?: Record<string, string>,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    return this.request<T>(
      url,
      {
        method: "GET",
        headers,
      },
      options
    );
  }
}
