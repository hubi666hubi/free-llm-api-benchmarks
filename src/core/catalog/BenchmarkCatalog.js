import { LLMModel } from "../models/LLMModel";
export class BenchmarkCatalog {
    _models;
    constructor(models = []) {
        this._models = [...models];
    }
    get models() {
        return [...this._models];
    }
    get length() {
        return this._models.length;
    }
    /**
     * Parses standard CSV formatted text into a BenchmarkCatalog instance.
     */
    static parseCSV(csvContent) {
        const lines = csvContent
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        if (lines.length < 2) {
            return new BenchmarkCatalog([]);
        }
        // Split CSV line respecting quoted values
        const parseLine = (line) => {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                }
                else if (char === "," && !inQuotes) {
                    result.push(current);
                    current = "";
                }
                else {
                    current += char;
                }
            }
            result.push(current);
            return result.map((s) => s.replace(/^"|"$/g, "").trim());
        };
        const headers = parseLine(lines[0]);
        const models = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i]);
            if (values.length !== headers.length)
                continue;
            const row = {};
            for (let h = 0; h < headers.length; h++) {
                row[headers[h]] = values[h];
            }
            models.push(LLMModel.fromCSVRow(row));
        }
        return new BenchmarkCatalog(models);
    }
    getAll() {
        return [...this._models];
    }
    findBySlug(slug) {
        const target = slug.trim().toLowerCase();
        return this._models.find((m) => m.slug.toLowerCase() === target);
    }
    search(query) {
        return this._models.filter((m) => m.matchesQuery(query));
    }
    getFreeTier() {
        return this._models.filter((m) => m.isFree);
    }
    getMillionPlus() {
        return this._models.filter((m) => m.isMillionPlus);
    }
    getTopByContext(limit = 15) {
        return [...this._models]
            .sort((a, b) => b.contextWindowTokens - a.contextWindowTokens)
            .slice(0, limit);
    }
    getCheapest(options = {}) {
        const { minContext = 1_000_000, requireTools = true, requireReasoning = true, limit = 10 } = options;
        return this._models
            .filter((m) => {
            if (m.contextWindowTokens < minContext)
                return false;
            if (requireTools && !m.supportsToolCall)
                return false;
            if (requireReasoning && !m.supportsReasoning)
                return false;
            return true;
        })
            .sort((a, b) => a.blendedCostPer1M - b.blendedCostPer1M)
            .slice(0, limit);
    }
    filter(options) {
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
            result = result.filter((m) => m.contextWindowTokens >= options.minContext);
        }
        if (options.maxBlendedCost !== undefined) {
            result = result.filter((m) => m.blendedCostPer1M <= options.maxBlendedCost);
        }
        return result;
    }
    getProviders() {
        const set = new Set();
        for (const m of this._models) {
            if (m.provider)
                set.add(m.provider);
        }
        return Array.from(set).sort();
    }
    getProviderSummary(provider) {
        const models = this.filter({ provider });
        if (models.length === 0)
            return undefined;
        const costs = models.map((m) => m.blendedCostPer1M);
        const sumCost = costs.reduce((acc, c) => acc + c, 0);
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);
        const bestValueModel = models.reduce((best, cur) => cur.blendedCostPer1M < best.blendedCostPer1M ? cur : best);
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
    getStats() {
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
        const median = costs.length % 2 !== 0 ? costs[mid] : Number(((costs[mid - 1] + costs[mid]) / 2).toFixed(6));
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
    recommend(requirements) {
        const matches = this._models.filter((m) => {
            if (requirements.minContext && m.contextWindowTokens < requirements.minContext)
                return false;
            if (requirements.requireTools && !m.supportsToolCall)
                return false;
            if (requirements.requireReasoning && !m.supportsReasoning)
                return false;
            if (requirements.maxCostPer1M !== undefined && m.blendedCostPer1M > requirements.maxCostPer1M)
                return false;
            if (requirements.preferOpenWeights && !m.deploymentType.toLowerCase().includes("open-weights"))
                return false;
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
}
