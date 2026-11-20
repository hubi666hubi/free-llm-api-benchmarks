import { describe, it, expect } from "vitest";
import { rawBenchmarkCsv } from "../../data/rawCsv";
import { UrlTextSource } from "../../adapters/UrlTextSource";
import {
  CatalogRepository,
  CsvCatalogRepository,
  JsonCatalogRepository,
  FallbackCatalogRepository,
  StringTextSource,
  CatalogValidationError,
  serializeCatalogJson,
  parseCatalogJson,
} from "../catalog/CatalogRepository";
import { BenchmarkCatalog } from "../catalog/BenchmarkCatalog";

const baseCatalog = BenchmarkCatalog.parseCSV(rawBenchmarkCsv);
const json = serializeCatalogJson(baseCatalog);

const fakeFetch = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as unknown as typeof fetch;

// Contract: every repository must return the same catalog for the same data.
const adapters: [string, () => CatalogRepository][] = [
  ["CSV (string)", () => new CsvCatalogRepository(new StringTextSource(rawBenchmarkCsv))],
  ["JSON (string)", () => new JsonCatalogRepository(new StringTextSource(json))],
  ["CSV (URL)", () => new CsvCatalogRepository(new UrlTextSource("http://x/c.csv", fakeFetch(rawBenchmarkCsv)))],
  ["JSON (URL)", () => new JsonCatalogRepository(new UrlTextSource("http://x/c.json", fakeFetch(json)))],
];

describe.each(adapters)("CatalogRepository contract: %s", (_n, make) => {
  it("loads 100 models identical to the bundled catalog", async () => {
    const c = await make().load();
    expect(c.length).toBe(100);
    expect(c.findBySlug("google/gemini-exp-1206")?.contextWindowTokens).toBe(2097152);
    expect(c.models.map((m) => m.slug)).toEqual(baseCatalog.models.map((m) => m.slug));
  });
});

describe("JSON validation", () => {
  const doc = (models: unknown, version: unknown = 1) => JSON.stringify({ version, models });

  it("rejects broken JSON, bad version and non-array models", () => {
    expect(() => parseCatalogJson("{")).toThrow(CatalogValidationError);
    expect(() => parseCatalogJson(doc([], 2))).toThrow(/wersja/);
    expect(() => parseCatalogJson(doc({}))).toThrow(/tablicy/);
  });

  it("reports field-level issues and duplicates", () => {
    const m = { ...JSON.parse(json).models[0] };
    const bad = { ...m, contextWindowTokens: "dużo", supportsToolCall: 1 };
    try {
      parseCatalogJson(doc([bad, m, m]));
      throw new Error("should fail");
    } catch (e) {
      expect(e).toBeInstanceOf(CatalogValidationError);
      const issues = (e as CatalogValidationError).issues.join("\n");
      expect(issues).toContain("models[0].contextWindowTokens");
      expect(issues).toContain("models[0].supportsToolCall");
      expect(issues).toContain("duplikat");
    }
  });

  it("round-trips through serialize/parse", () => {
    expect(parseCatalogJson(json).length).toBe(100);
  });
});

describe("FallbackCatalogRepository & UrlTextSource", () => {
  it("falls back to the next source when the first fails", async () => {
    const repo = new FallbackCatalogRepository([
      new JsonCatalogRepository(new UrlTextSource("http://x", fakeFetch("nope", 500))),
      new CsvCatalogRepository(new StringTextSource(rawBenchmarkCsv)),
    ]);
    expect((await repo.load()).length).toBe(100);
  });

  it("fails with aggregated message when all sources fail", async () => {
    const repo = new FallbackCatalogRepository([
      new JsonCatalogRepository(new StringTextSource("{")),
    ]);
    await expect(repo.load()).rejects.toThrow(/Żadne źródło/);
  });
});
