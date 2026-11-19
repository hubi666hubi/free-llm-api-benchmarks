/**
 * Domain entity representing an LLM API endpoint and its benchmark metrics.
 */

export interface LLMModelData {
  slug: string;
  toolName: string;
  provider: string;
  modelFamily: string;
  classification: string;
  deploymentType: string;
  supportedModels: string[];
  modalities: string[];
  inputCostPer1M: number;
  outputCostPer1M: number;
  blendedCostPer1M: number;
  contextWindowTokens: number;
  maxOutputTokens: number | null;
  rateLimitRpm: number | null;
  rateLimitTpm: number | null;
  freeTierAvailable: boolean;
  supportsToolCall: boolean;
  supportsReasoning: boolean;
  pricingTier: string;
  docsUrl: string;
  sourceFeeds: string[];
  updatedAt: string;
}

export class LLMModel {
  readonly slug: string;
  readonly toolName: string;
  readonly provider: string;
  readonly modelFamily: string;
  readonly classification: string;
  readonly deploymentType: string;
  readonly supportedModels: string[];
  readonly modalities: string[];
  readonly inputCostPer1M: number;
  readonly outputCostPer1M: number;
  readonly blendedCostPer1M: number;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number | null;
  readonly rateLimitRpm: number | null;
  readonly rateLimitTpm: number | null;
  readonly freeTierAvailable: boolean;
  readonly supportsToolCall: boolean;
  readonly supportsReasoning: boolean;
  readonly pricingTier: string;
  readonly docsUrl: string;
  readonly sourceFeeds: string[];
  readonly updatedAt: string;

  constructor(data: LLMModelData) {
    this.slug = data.slug;
    this.toolName = data.toolName;
    this.provider = data.provider;
    this.modelFamily = data.modelFamily;
    this.classification = data.classification;
    this.deploymentType = data.deploymentType;
    this.supportedModels = data.supportedModels;
    this.modalities = data.modalities;
    this.inputCostPer1M = data.inputCostPer1M;
    this.outputCostPer1M = data.outputCostPer1M;
    this.blendedCostPer1M = data.blendedCostPer1M;
    this.contextWindowTokens = data.contextWindowTokens;
    this.maxOutputTokens = data.maxOutputTokens;
    this.rateLimitRpm = data.rateLimitRpm;
    this.rateLimitTpm = data.rateLimitTpm;
    this.freeTierAvailable = data.freeTierAvailable;
    this.supportsToolCall = data.supportsToolCall;
    this.supportsReasoning = data.supportsReasoning;
    this.pricingTier = data.pricingTier;
    this.docsUrl = data.docsUrl;
    this.sourceFeeds = data.sourceFeeds;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Returns true if model provides free access or $0.00 blended rate.
   */
  get isFree(): boolean {
    return this.freeTierAvailable || this.blendedCostPer1M === 0;
  }

  /**
   * Returns true if context window is 1,000,000 tokens or greater.
   */
  get isMillionPlus(): boolean {
    return this.contextWindowTokens >= 1_000_000;
  }

  /**
   * Calculates estimated cost in USD for a given volume of input and output tokens.
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const inputUsd = (inputTokens / 1_000_000) * this.inputCostPer1M;
    const outputUsd = (outputTokens / 1_000_000) * this.outputCostPer1M;
    return Number((inputUsd + outputUsd).toFixed(6));
  }

  /**
   * Compares blended cost against a baseline rate (e.g. $3.00/1M) and computes dollar and percentage savings.
   */
  calculateArbitrageVs(baselineBlendedCostPer1M: number): { dollarDiff: number; percentSavings: number } {
    const dollarDiff = baselineBlendedCostPer1M - this.blendedCostPer1M;
    const percentSavings =
      baselineBlendedCostPer1M > 0
        ? Number(((dollarDiff / baselineBlendedCostPer1M) * 100).toFixed(2))
        : 0;
    return {
      dollarDiff: Number(dollarDiff.toFixed(4)),
      percentSavings,
    };
  }

  /**
   * Fuzzy matches against slug, tool name, provider, or supported model identifiers.
   */
  matchesQuery(query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      this.slug.toLowerCase().includes(q) ||
      this.toolName.toLowerCase().includes(q) ||
      this.provider.toLowerCase().includes(q) ||
      this.modelFamily.toLowerCase().includes(q) ||
      this.supportedModels.some((m) => m.toLowerCase().includes(q))
    );
  }

  /**
   * Parses a single row from the CSV into an LLMModel instance.
   */
  static fromCSVRow(row: Record<string, string>): LLMModel {
    const parseBool = (v: string | undefined): boolean => {
      const s = (v || "").trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    };

    const parseFloatVal = (v: string | undefined): number => {
      const val = parseFloat((v || "").trim());
      return isNaN(val) ? 0 : val;
    };

    const parseIntVal = (v: string | undefined): number | null => {
      const val = parseInt((v || "").trim(), 10);
      return isNaN(val) ? null : val;
    };

    const parseList = (v: string | undefined): string[] => {
      if (!v) return [];
      return v
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    return new LLMModel({
      slug: (row.slug || "").trim(),
      toolName: (row.tool_name || "").trim(),
      provider: (row.provider || "").trim(),
      modelFamily: (row.model_family || "").trim(),
      classification: (row.classification || "").trim(),
      deploymentType: (row.deployment_type || "").trim(),
      supportedModels: parseList(row.supported_models),
      modalities: parseList(row.modalities),
      inputCostPer1M: parseFloatVal(row.input_cost_per_1m_usd),
      outputCostPer1M: parseFloatVal(row.output_cost_per_1m_usd),
      blendedCostPer1M: parseFloatVal(row.blended_cost_per_1m_usd),
      contextWindowTokens: parseIntVal(row.context_window_tokens) || 0,
      maxOutputTokens: parseIntVal(row.max_output_tokens),
      rateLimitRpm: parseIntVal(row.rate_limit_rpm),
      rateLimitTpm: parseIntVal(row.rate_limit_tpm),
      freeTierAvailable: parseBool(row.free_tier_available),
      supportsToolCall: parseBool(row.supports_tool_call),
      supportsReasoning: parseBool(row.supports_reasoning),
      pricingTier: (row.pricing_tier || "").trim(),
      docsUrl: (row.docs_url || "").trim(),
      sourceFeeds: parseList(row.source_feeds),
      updatedAt: (row.updated_at || "").trim(),
    });
  }
}
