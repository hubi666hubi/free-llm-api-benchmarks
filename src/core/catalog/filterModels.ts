import { LLMModel } from "../models/LLMModel";
import { BenchmarkCatalog } from "./BenchmarkCatalog";

/** UI-level catalog filters (pure data, no React). */
export interface ModelFilters {
  query: string;
  provider: string;
  millionPlus: boolean;
  requireTools: boolean;
  requireReasoning: boolean;
  paretoOnly: boolean;
}

export const DEFAULT_MODEL_FILTERS: ModelFilters = {
  query: "",
  provider: "",
  millionPlus: false,
  requireTools: false,
  requireReasoning: false,
  paretoOnly: false,
};

/** Applies catalog filters + text search + optional Pareto restriction. */
export function filterModels(
  catalog: BenchmarkCatalog,
  filters: ModelFilters,
  paretoSlugs: ReadonlySet<string>
): LLMModel[] {
  return catalog
    .filter({
      provider: filters.provider || undefined,
      minContext: filters.millionPlus ? 1_000_000 : 0,
      requireTools: filters.requireTools,
      requireReasoning: filters.requireReasoning,
    })
    .filter((m) => {
      if (filters.paretoOnly && !paretoSlugs.has(m.slug)) return false;
      return m.matchesQuery(filters.query);
    });
}
