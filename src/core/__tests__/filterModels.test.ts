import { describe, it, expect } from "vitest";
import { filterModels, DEFAULT_MODEL_FILTERS } from "../catalog/filterModels";
import { defaultCatalog } from "../../data/catalog";

const pareto = new Set(defaultCatalog.getParetoFrontier().map((m) => m.slug));

describe("filterModels", () => {
  it("returns the whole catalog for default filters", () => {
    expect(filterModels(defaultCatalog, DEFAULT_MODEL_FILTERS, pareto)).toHaveLength(defaultCatalog.models.length);
  });

  it("restricts to a provider", () => {
    const provider = defaultCatalog.getProviders()[0];
    const r = filterModels(defaultCatalog, { ...DEFAULT_MODEL_FILTERS, provider }, pareto);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((m) => m.provider === provider)).toBe(true);
  });

  it("applies 1M+ context", () => {
    const r = filterModels(defaultCatalog, { ...DEFAULT_MODEL_FILTERS, millionPlus: true }, pareto);
    expect(r.every((m) => m.contextWindowTokens >= 1_000_000)).toBe(true);
  });

  it("paretoOnly keeps only frontier slugs", () => {
    const r = filterModels(defaultCatalog, { ...DEFAULT_MODEL_FILTERS, paretoOnly: true }, pareto);
    expect(r.length).toBe(pareto.size);
    expect(r.every((m) => pareto.has(m.slug))).toBe(true);
  });
});
