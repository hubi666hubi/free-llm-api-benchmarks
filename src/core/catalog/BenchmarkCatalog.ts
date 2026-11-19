import { LLMModel } from "../models/LLMModel";

export interface CatalogFilterOptions {
  provider?: string;
  classification?: string;
  onlyFree?: boolean;
  requireTools?: boolean;
  requireReasoning?: boolean;
  minContext?: number;
  maxBlendedCost?: number;
}

export interface ProviderSummary {
  provider: string;
  modelCount: number;
  openWeightsCount: number;
  proprietarySaaSCount: number;
  freeTierCount: number;
  toolCallCount: number;
  reasoningCount: number;
  avgBlendedCostPer1M: number;
  minBlendedCostPer1M: number;
  maxBlendedCostPer1M: number;
  maxContextWindowTokens: number;
  bestValueSlug: string;
}

export interface CatalogStats {
  totalModels: number;
  providersCount: number;
  freeTierCount: number;
  millionPlusContextCount: number;
  toolCallingCount: number;
  reasoningCount: number;
  maxContextWindow: number;
  medianBlendedCost: number;
}

export interface ModelRequirements {
  minContext?: number;
  requireTools?: boolean;
  requireReasoning?: boolean;
  maxCostPer1M?: number;
  preferOpenWeights?: boolean;
}

export interface ModelComparison {
  modelA: LLMModel;
  modelB: LLMModel;
  contextDeltaTokens: number;
  costDeltaBlendedPer1M: number;
  percentCheaperA: number;
  toolsMatch: boolean;
  reasoningMatch: boolean;
  verdict: string;
}

export class BenchmarkCatalog {
  private readonly _models: LLMModel[];

  constructor(models: LLMModel[] = []) {
    this._models = [...models];
  }

  get models(): LLMModel[] {
    return [...this._models];
  }

  get length(): number {
    return this._models.length;
  }

  /**
   * Parses standard CSV formatted text into a BenchmarkCatalog instance.
   */
  static parseCSV(csvContent: string): BenchmarkCatalog {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return new BenchmarkCatalog([]);
    }

    // Split CSV line respecting quoted values
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current);
      return result.map((s) => s.replace(/^"|"$/g, "").trim());
    };

    const headers = parseLine(lines[0]);
    const models: LLMModel[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        row[headers[h]] = values[h];
      }
      models.push(LLMModel.fromCSVRow(row));
    }

    return new BenchmarkCatalog(models);
  }

  getAll(): LLMModel[] {
    return [...this._models];
  }

  findBySlug(slug: string): LLMModel | undefined {
    const target = slug.trim().toLowerCase();
    return this._models.find((m) => m.slug.toLowerCase() === target);
  }

  search(query: string): LLMModel[] {
    return this._models.filter((m) => m.matchesQuery(query));
  }

  getFreeTier(): LLMModel[] {
    return this._models.filter((m) => m.isFree);
  }

  getMillionPlus(): LLMModel[] {
    return this._models.filter((m) => m.isMillionPlus);
  }

  getTopByContext(limit = 15): LLMModel[] {
    return [...this._models]
      .sort((a, b) => b.contextWindowTokens - a.contextWindowTokens)
      .slice(0, limit);
  }

  getCheapest(options: {
    minContext?: number;
    requireTools?: boolean;
    requireReasoning?: boolean;
    limit?: number;
  } = {}): LLMModel[] {
    const { minContext = 1_000_000, requireTools = true, requireReasoning = true, limit = 10 } = options;

    return this._models
      .filter((m) => {
        if (m.contextWindowTokens < minContext) return false;
        if (requireTools && !m.supportsToolCall) return false;
        if (requireReasoning && !m.supportsReasoning) return false;
        return true;
      })
      .sort((a, b) => a.blendedCostPer1M - b.blendedCostPer1M)
      .slice(0, limit);
  }

  filter(options: CatalogFilterOptions): LLMModel[] {
    let result = this._models;

    if (options.provider) {
      const p = options.provider.trim().toLowerCase();
      result = result.filter((m) => m.provider.toLowerCase() === p);
    }
    if (options.classification) {
      const c = options.classification.trim().toLowerCase();
      result = result.filter((m) => m.classification.toLowerCase() === c);
    }
    if (options.onlyFree) {
      result = result.filter((m) => m.isFree);
    }
    if (options.requireTools) {
      result = result.filter((m) => m.supportsToolCall);
    }
    if (options.requireReasoning) {
      result = result.filter((m) => m.supportsReasoning);
    }
    if (options.minContext && options.minContext > 0) {
      result = result.filter((m) => m.contextWindowTokens >= options.minContext!);
    }
    if (options.maxBlendedCost !== undefined) {
      result = result.filter((m) => m.blendedCostPer1M <= options.maxBlendedCost!);
    }

    return result;
  }

  getProviders(): string[] {
    const set = new Set<string>();
    for (const m of this._models) {
      if (m.provider) set.add(m.provider);
    }
    return Array.from(set).sort();
  }

  getProviderSummary(provider: string): ProviderSummary | undefined {
    const models = this.filter({ provider });
    if (models.length === 0) return undefined;

    const costs = models.map((m) => m.blendedCostPer1M);
    const sumCost = costs.reduce((acc, c) => acc + c, 0);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const bestValueModel = models.reduce((best, cur) =>
      cur.blendedCostPer1M < best.blendedCostPer1M ? cur : best
    );

    return {
      provider,
      modelCount: models.length,
      openWeightsCount: models.filter((m) => m.deploymentType.toLowerCase().includes("open-weights")).length,
      proprietarySaaSCount: models.filter((m) => m.deploymentType.toLowerCase().includes("proprietary")).length,
      freeTierCount: models.filter((m) => m.isFree).length,
      toolCallCount: models.filter((m) => m.supportsToolCall).length,
      reasoningCount: models.filter((m) => m.supportsReasoning).length,
      avgBlendedCostPer1M: Number((sumCost / models.length).toFixed(6)),
      minBlendedCostPer1M: Number(minCost.toFixed(6)),
      maxBlendedCostPer1M: Number(maxCost.toFixed(6)),
      maxContextWindowTokens: Math.max(...models.map((m) => m.contextWindowTokens)),
      bestValueSlug: bestValueModel.slug,
    };
  }

  getStats(): CatalogStats {
    if (this._models.length === 0) {
      return {
        totalModels: 0,
        providersCount: 0,
        freeTierCount: 0,
        millionPlusContextCount: 0,
        toolCallingCount: 0,
        reasoningCount: 0,
        maxContextWindow: 0,
        medianBlendedCost: 0,
      };
    }

    const costs = [...this._models.map((m) => m.blendedCostPer1M)].sort((a, b) => a - b);
    const mid = Math.floor(costs.length / 2);
    const median =
      costs.length % 2 !== 0 ? costs[mid] : Number(((costs[mid - 1] + costs[mid]) / 2).toFixed(6));

    return {
      totalModels: this._models.length,
      providersCount: this.getProviders().length,
      freeTierCount: this._models.filter((m) => m.isFree).length,
      millionPlusContextCount: this._models.filter((m) => m.isMillionPlus).length,
      toolCallingCount: this._models.filter((m) => m.supportsToolCall).length,
      reasoningCount: this._models.filter((m) => m.supportsReasoning).length,
      maxContextWindow: Math.max(...this._models.map((m) => m.contextWindowTokens)),
      medianBlendedCost: median,
    };
  }

  recommend(requirements: ModelRequirements): LLMModel[] {
    const matches = this._models.filter((m) => {
      if (requirements.minContext && m.contextWindowTokens < requirements.minContext) return false;
      if (requirements.requireTools && !m.supportsToolCall) return false;
      if (requirements.requireReasoning && !m.supportsReasoning) return false;
      if (requirements.maxCostPer1M !== undefined && m.blendedCostPer1M > requirements.maxCostPer1M) return false;
      if (requirements.preferOpenWeights && !m.deploymentType.toLowerCase().includes("open-weights")) return false;
      return true;
    });

    return matches.sort((a, b) => {
      // Prioritize cost first, then context size
      if (a.blendedCostPer1M !== b.blendedCostPer1M) {
        return a.blendedCostPer1M - b.blendedCostPer1M;
      }
      return b.contextWindowTokens - a.contextWindowTokens;
    });
  }

  /**
   * Calculates the global Pareto Frontier (trade-off between Context Window and Blended Cost).
   * A model is Pareto-optimal if no other model offers both strictly lower/equal cost AND higher/equal context.
   */
  getParetoFrontier(): LLMModel[] {
    const frontier: LLMModel[] = [];

    for (const candidate of this._models) {
      let isDominated = false;

      for (const other of this._models) {
        if (candidate.slug === other.slug) continue;

        // other has lower or equal cost AND higher or equal context
        const costBetterOrEqual = other.blendedCostPer1M <= candidate.blendedCostPer1M;
        const contextBetterOrEqual = other.contextWindowTokens >= candidate.contextWindowTokens;
        const strictlyBetter =
          other.blendedCostPer1M < candidate.blendedCostPer1M ||
          other.contextWindowTokens > candidate.contextWindowTokens;

        if (costBetterOrEqual && contextBetterOrEqual && strictlyBetter) {
          isDominated = true;
          break;
        }
      }

      if (!isDominated) {
        frontier.push(candidate);
      }
    }

    return frontier.sort((a, b) => b.contextWindowTokens - a.contextWindowTokens);
  }

  /**
   * Compares two models side-by-side with economic and technical verdict.
   */
  compareModels(modelA: LLMModel, modelB: LLMModel): ModelComparison {
    const contextDelta = modelA.contextWindowTokens - modelB.contextWindowTokens;
    const costDelta = modelA.blendedCostPer1M - modelB.blendedCostPer1M;
    const percentCheaper =
      modelB.blendedCostPer1M > 0
        ? Number((((modelB.blendedCostPer1M - modelA.blendedCostPer1M) / modelB.blendedCostPer1M) * 100).toFixed(2))
        : 0;

    let verdict = "";
    if (modelA.blendedCostPer1M < modelB.blendedCostPer1M && modelA.contextWindowTokens >= modelB.contextWindowTokens) {
      verdict = `${modelA.toolName} dominuje w relacji cena/kontekst (${Math.abs(percentCheaper)}% taniej przy równym lub większym oknie).`;
    } else if (modelA.contextWindowTokens > modelB.contextWindowTokens) {
      verdict = `${modelA.toolName} oferuje o ${contextDelta.toLocaleString()} tokenów większe okno kontekstowe.`;
    } else if (percentCheaper > 0) {
      verdict = `${modelA.toolName} jest o ${percentCheaper}% tańszy w przetwarzaniu tokenów.`;
    } else {
      verdict = `${modelB.toolName} oferuje korzystniejsze parametry kosztowe lub pojemnościowe.`;
    }

    return {
      modelA,
      modelB,
      contextDeltaTokens: contextDelta,
      costDeltaBlendedPer1M: Number(costDelta.toFixed(6)),
      percentCheaperA: percentCheaper,
      toolsMatch: modelA.supportsToolCall === modelB.supportsToolCall,
      reasoningMatch: modelA.supportsReasoning === modelB.supportsReasoning,
      verdict,
    };
  }

  /**
   * Groups models by provider name.
   */
  getModelsByProvider(): Record<string, LLMModel[]> {
    const grouped: Record<string, LLMModel[]> = {};
    for (const m of this._models) {
      if (!grouped[m.provider]) {
        grouped[m.provider] = [];
      }
      grouped[m.provider].push(m);
    }
    return grouped;
  }
}
