import { BenchmarkCatalog } from "./BenchmarkCatalog";
import { LLMModel, LLMModelData } from "../models/LLMModel";

/** Port: any place that can hand over a catalog (file, URL, memory, DB...). */
export interface CatalogRepository {
  load(): Promise<BenchmarkCatalog>;
}

/** Port: raw text source (file, URL, localStorage...). Implemented by adapters. */
export interface ITextSource {
  readText(): Promise<string>;
}

export const CATALOG_SCHEMA_VERSION = 1;

export class CatalogValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Nieprawidłowy katalog: ${issues.slice(0, 5).join("; ")}${issues.length > 5 ? ` (+${issues.length - 5})` : ""}`);
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

type Kind = "string" | "number" | "nullableNumber" | "boolean" | "stringArray";
const SCHEMA: Record<keyof LLMModelData, Kind> = {
  slug: "string",
  toolName: "string",
  provider: "string",
  modelFamily: "string",
  classification: "string",
  deploymentType: "string",
  supportedModels: "stringArray",
  modalities: "stringArray",
  inputCostPer1M: "number",
  outputCostPer1M: "number",
  blendedCostPer1M: "number",
  contextWindowTokens: "number",
  maxOutputTokens: "nullableNumber",
  rateLimitRpm: "nullableNumber",
  rateLimitTpm: "nullableNumber",
  freeTierAvailable: "boolean",
  supportsToolCall: "boolean",
  supportsReasoning: "boolean",
  pricingTier: "string",
  docsUrl: "string",
  sourceFeeds: "stringArray",
  updatedAt: "string",
};

function checkKind(v: unknown, kind: Kind): boolean {
  switch (kind) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number" && Number.isFinite(v) && v >= 0;
    case "nullableNumber": return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
    case "boolean": return typeof v === "boolean";
    case "stringArray": return Array.isArray(v) && v.every((x) => typeof x === "string");
  }
}

/** Validates unknown input against the model schema; returns issues (empty = valid). */
export function validateModelData(value: unknown, path = "model"): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: oczekiwano obiektu`];
  const obj = value as Record<string, unknown>;
  const issues: string[] = [];
  for (const [key, kind] of Object.entries(SCHEMA)) {
    if (!checkKind(obj[key], kind)) issues.push(`${path}.${key}: oczekiwano ${kind}`);
  }
  if (typeof obj.slug === "string" && obj.slug.trim() === "") issues.push(`${path}.slug: pusty`);
  return issues;
}

/** Parses + validates versioned JSON: { version: 1, models: [...] }. */
export function parseCatalogJson(text: string): BenchmarkCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CatalogValidationError(["niepoprawny JSON"]);
  }
  const doc = parsed as { version?: unknown; models?: unknown };
  if (typeof doc !== "object" || doc === null || doc.version !== CATALOG_SCHEMA_VERSION) {
    throw new CatalogValidationError([`nieobsługiwana wersja schematu (oczekiwano ${CATALOG_SCHEMA_VERSION})`]);
  }
  if (!Array.isArray(doc.models)) throw new CatalogValidationError(["models: oczekiwano tablicy"]);

  const issues: string[] = [];
  const seen = new Set<string>();
  doc.models.forEach((m, i) => {
    issues.push(...validateModelData(m, `models[${i}]`));
    const slug = (m as { slug?: unknown })?.slug;
    if (typeof slug === "string") {
      if (seen.has(slug)) issues.push(`models[${i}].slug: duplikat "${slug}"`);
      seen.add(slug);
    }
  });
  if (issues.length) throw new CatalogValidationError(issues);
  return new BenchmarkCatalog(doc.models.map((m) => new LLMModel(m as LLMModelData)));
}

export function serializeCatalogJson(catalog: BenchmarkCatalog): string {
  return JSON.stringify({ version: CATALOG_SCHEMA_VERSION, models: catalog.models }, null, 2);
}

export class CsvCatalogRepository implements CatalogRepository {
  constructor(private readonly source: ITextSource) {}
  async load(): Promise<BenchmarkCatalog> {
    return BenchmarkCatalog.parseCSV(await this.source.readText());
  }
}

export class JsonCatalogRepository implements CatalogRepository {
  constructor(private readonly source: ITextSource) {}
  async load(): Promise<BenchmarkCatalog> {
    return parseCatalogJson(await this.source.readText());
  }
}

export class StringTextSource implements ITextSource {
  constructor(private readonly text: string) {}
  async readText(): Promise<string> {
    return this.text;
  }
}

/** Tries repositories in order; first success wins (e.g. URL -> bundled copy). */
export class FallbackCatalogRepository implements CatalogRepository {
  constructor(private readonly repositories: CatalogRepository[]) {}
  async load(): Promise<BenchmarkCatalog> {
    const errors: string[] = [];
    for (const repo of this.repositories) {
      try {
        return await repo.load();
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    throw new Error(`Żadne źródło katalogu nie zadziałało: ${errors.join(" | ")}`);
  }
}
