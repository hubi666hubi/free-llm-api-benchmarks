# Data Dictionary — AI & LLM API Commercial Catalog

## Table 1: `ai_llm_api_catalog`

| Column | Type | Nullable | Description |
|---|---|---|---|
| `slug` | `VARCHAR` | No | Unique canonical lowercase key (`provider/model-id`) |
| `tool_name` | `VARCHAR` | No | Human-readable model / endpoint display name |
| `provider` | `VARCHAR` | No | Canonical provider identifier |
| `model_family` | `VARCHAR` | No | Model family identifier |
| `classification` | `VARCHAR` | No | `SaaS`, `Hybrid`, or `Open-Source` |
| `deployment_type` | `VARCHAR` | No | `Proprietary SaaS`, `Open-Weights (Hosted API)`, or `Open-Weights (Local + API)` |
| `supported_models` | `VARCHAR[]` | No | Model identifiers/aliases (`; ` joined in CSV) |
| `modalities` | `VARCHAR[]` | No | Supported modalities (`text`, `image`, `audio`, etc.) |
| `input_cost_per_1m_usd` | `DOUBLE` | No | Input token cost in USD per 1M tokens |
| `output_cost_per_1m_usd` | `DOUBLE` | No | Output token cost in USD per 1M tokens |
| `blended_cost_per_1m_usd` | `DOUBLE` | No | `(3 * input + output) / 4` rounded to 6 decimals |
| `context_window_tokens` | `BIGINT` | No | Maximum context window tokens (`0` if unspecified locally) |
| `max_output_tokens` | `BIGINT` | Yes | Maximum completion tokens (`null` if unpublished) |
| `rate_limit_rpm` | `BIGINT` | Yes | Published requests-per-minute limit (never fabricated) |
| `rate_limit_tpm` | `BIGINT` | Yes | Published tokens-per-minute limit (never fabricated) |
| `free_tier_available` | `BOOLEAN` | No | True for `$0/$0`, `:free`, or local Ollama models |
| `supports_tool_call` | `BOOLEAN` | No | True when function/tool calling is supported |
| `supports_reasoning` | `BOOLEAN` | No | True when reasoning/thinking mode is supported |
| `pricing_tier` | `VARCHAR` | No | `Free` ($0/$0), `Budget` (<= $1), `Standard` (<= $5), `Premium` (> $5) |
| `docs_url` | `VARCHAR` | No | Official provider/model documentation URL |
| `source_feeds` | `VARCHAR[]` | No | Upstream feeds corroborating this record |
| `updated_at` | `VARCHAR` | No | ISO-8601 UTC ingestion timestamp |

## Table 2: `provider_summary`

| Column | Type | Description |
|---|---|---|
| `provider` | `VARCHAR` | Canonical provider name |
| `model_count` | `BIGINT` | Active catalog rows for provider |
| `open_weights_count` | `BIGINT` | Open-weights endpoints |
| `proprietary_saas_count` | `BIGINT` | Proprietary SaaS endpoints |
| `free_tier_count` | `BIGINT` | Free-tier eligible endpoints |
| `tool_call_count` | `BIGINT` | Tool-calling enabled endpoints |
| `reasoning_count` | `BIGINT` | Reasoning-capable endpoints |
| `avg_blended_cost_per_1m_usd` | `DOUBLE` | Mean blended USD / 1M |
| `min_blended_cost_per_1m_usd` | `DOUBLE` | Minimum blended USD / 1M |
| `max_blended_cost_per_1m_usd` | `DOUBLE` | Maximum blended USD / 1M |
| `max_context_window_tokens` | `BIGINT` | Largest context window offered |
| `best_value_slug` | `VARCHAR` | Top-ranked Pareto/capability/cost slug |
| `pareto_optimal_count` | `BIGINT` | Count of endpoints on global Pareto frontier |
