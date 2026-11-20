import { describe, it, expect, afterAll, beforeAll } from "vitest";
// @ts-ignore node builtin (no @types/node in tsconfig)
import { createServer } from "node:http";
import { OllamaProvider } from "../../adapters/OllamaProvider";
import { FetchHttpClient } from "../../adapters/FetchHttpClient";

/** Real HTTP round-trip: FetchHttpClient + OllamaProvider against a fake Ollama server. */
let server: any;
let base = "";
let lastChat: any = null;

beforeAll(async () => {
  server = createServer((req: any, res: any) => {
    let body = "";
    req.on("data", (c: any) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/version") return res.end(JSON.stringify({ version: "0.0.test" }));
      if (req.url === "/api/tags")
        return res.end(JSON.stringify({ models: [{ name: "hex-architect:latest", details: { parameter_size: "30B" } }] }));
      if (req.url === "/api/chat") {
        lastChat = JSON.parse(body);
        return res.end(JSON.stringify({ message: { role: "assistant", content: "port w core, adapter na zewnątrz" } }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("Ollama end-to-end over real HTTP", () => {
  it("health, models and chat work through FetchHttpClient", async () => {
    const o = new OllamaProvider({ baseUrl: base, defaultModel: "hex-architect" }, new FetchHttpClient());
    const h = await o.checkHealth();
    expect(h).toMatchObject({ ok: true, version: "0.0.test", modelsCount: 1 });
    expect((await o.listModels())[0]).toMatchObject({ name: "hex-architect:latest", parameterSize: "30B" });
    const reply = await o.sendMessage([{ id: "1", role: "user", content: "Zaprojektuj port" }]);
    expect(reply).toBe("port w core, adapter na zewnątrz");
    expect(lastChat.model).toBe("hex-architect");
    expect(lastChat.options.num_ctx).toBe(32768);
    expect(lastChat.messages[0].role).toBe("system");
  });

  it("fails fast on a closed port (well under chat timeout)", async () => {
    const o = new OllamaProvider({ baseUrl: "http://127.0.0.1:1", healthTimeoutMs: 1000 }, new FetchHttpClient());
    const t = Date.now();
    await expect(o.sendMessage([{ id: "1", role: "user", content: "x" }])).rejects.toThrow(/Ollama/);
    expect(Date.now() - t).toBeLessThan(3000);
    expect(o.isAvailable()).toBe(false);
  });
});
