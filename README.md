# Free-Tier & 1M+ Context AI/LLM APIs Benchmark (11,381 Models Indexed)

> Programmatically normalized from OpenRouter, LiteLLM, models.dev & Ollama using **Polars + DuckDB**.
> - **Total Models Indexed:** `11,381` across `359` providers
> - **Free-Tier Models:** `1,703` | **1M+ Context Models:** `4,926`
> - **Median Cost Arbitrage:** Open-Weights (`$0.525/1M`) vs Proprietary SaaS (`$3.000/1M`) — **82.5% cheaper**

### Get the Full Warehouse (DuckDB + Apache Parquet + CSV + Notion OS)
- **Full 11,381-Model Pro Warehouse ($49):** https://oraclepantheon.gumroad.com/l/brrfby
- **Data Oracle Storefront (Free Lead Magnet & Kits):** https://oraclepantheon.gumroad.com/

## Top 15 Free-Tier LLM APIs by Context Window

| Model | Provider | Context Window | Tool Calling | Reasoning |
| --- | --- | ---: | :---: | :---: |
| gemini-exp-1206 | `google` | 2,097,152 | Yes | Yes |
| Auto Router | `kilo` | 2,000,000 | Yes | Yes |
| glm-5.3 | `kyma` | 1,310,720 | Yes | Yes |
| glm-5.3-flash | `kyma` | 1,310,720 | Yes | Yes |
| Kimi K3 | `engy` | 1,113,088 | Yes | Yes |
| Kimi K3.1 Pro | `engy` | 1,113,088 | Yes | Yes |
| Agentic Chat (GPT-5.4) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-5.5) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-5.6 Luna) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-5.6 Sol) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-5.6 Terra) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-6 Astra) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-6 Luna) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-6 Sol) | `gitlab` | 1,050,000 | Yes | Yes |
| Agentic Chat (GPT-6.1 Sol) | `gitlab` | 1,050,000 | Yes | Yes |

## Top 10 Cheapest 1M+ Context Models (Tool Calling + Reasoning)

| Model | Provider | Type | Input $/1M | Output $/1M | Blended $/1M | Context |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| DeepSeek V4.1 Flash 1017 | `refuseless` | Hybrid | $0.010 | $0.080 | $0.028 | 1,048,576 |
| GPT-5.6 Luna | `xxapi` | SaaS | $0.012 | $0.074 | $0.028 | 1,050,000 |
| MiniMax M3.1 Flash | `refuseless` | Open-Source | $0.020 | $0.080 | $0.035 | 1,048,576 |
| GLM Flash Latest | `openrouter` | SaaS | $0.040 | $0.078 | $0.050 | 1,048,576 |
| GLM-5.3-Flash | `sparrowcodes` | Open-Source | $0.040 | $0.078 | $0.050 | 1,000,000 |
| Qwen3.7 Flash | `alibaba-cn` | SaaS | $0.030 | $0.118 | $0.052 | 1,000,000 |
| DeepSeek V4.1 Flash | `engy` | Open-Source | $0.030 | $0.120 | $0.052 | 1,048,576 |
| DeepSeek V4.1 Flash 1017 | `engy` | Open-Source | $0.030 | $0.120 | $0.052 | 1,048,576 |
| Qwen3.7 Flash | `alibaba` | SaaS | $0.030 | $0.130 | $0.055 | 1,000,000 |
| Qwen3.7 Flash | `commandcode` | SaaS | $0.030 | $0.130 | $0.055 | 1,000,000 |

### All 3 Live Products on Data Oracle Labs (https://oraclepantheon.gumroad.com/)
- **Free Lead Magnet ($0+):** [Top 100 Free-Tier AI & LLM APIs CSV/JSON](https://oraclepantheon.gumroad.com/l/xybabz)
- **Pro Warehouse ($49):** [AI & LLM API Intelligence Catalog (11,381 Models — DuckDB, Parquet, CSV + Notion OS)](https://oraclepantheon.gumroad.com/l/brrfby)
- **B2B Monetization Kit ($79):** [W.F.P. B2B Lead Scoring & Anti-Babol LLM Gateway Kit (Python + Polars)](https://oraclepantheon.gumroad.com/l/lhkol)

---

## Architecture & Class Modules

The repository provides production-grade class modules and SDKs in both **TypeScript** and **Python**:

### 1. TypeScript / React Stack (`src/core/`)
- **`LLMModel` (`src/core/models/LLMModel.ts`)**: Domain entity with cost estimation, arbitrage metrics (`calculateArbitrageVs`), and fuzzy search.
- **`BenchmarkCatalog` (`src/core/catalog/BenchmarkCatalog.ts`)**: In-memory querying, filtering (context, tools, reasoning), rankings, and provider aggregations.
- **`ChatSession` (`src/core/chat/ChatSession.ts`)**: Reactive conversation session with token estimation and change listeners.
- **`GeminiProvider` & `MockCatalogAssistantProvider` (`src/core/chat/`)**: Multi-provider support (live Google Gemini API + offline catalog oracle assistant).
- **`LLMClient` & `BenchmarkAssistantAgent` (`src/core/chat/`)**: High-level agent orchestrator.
- **`GeminiChatView` (`src/components/GeminiChatView.tsx`)**: High-fidelity dark mode Gemini UI with custom markdown renderer.

```bash
# Install dependencies
npm install

# Run dev server with Gemini UI & Catalog Explorer
npm run dev

# Run Vitest unit tests
npm test

# Build production bundle
npm run build
```

### 2. Python SDK (`python/`)
- **`LLMModel` & `BenchmarkCatalog` (`python/benchmark_catalog.py`)**: Data models, CSV ingestion, ranking and querying.
- **`CostArbitrageEngine` (`python/benchmark_catalog.py`)**: Quantifies open-weights savings vs proprietary SaaS baselines and computes token bill projections.

```bash
# Run Python unit tests
python3 -m unittest discover -s python
```


