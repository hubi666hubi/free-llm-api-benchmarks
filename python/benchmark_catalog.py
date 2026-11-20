"""
Benchmark Catalog and Cost Arbitrage Module for Free-Tier & 1M+ Context AI/LLM APIs.
Provides structured domain models, catalog querying, and pricing arbitrage calculators.
"""

from __future__ import annotations
import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple


@dataclass
class LLMModel:
    slug: str
    tool_name: str
    provider: str
    model_family: str
    classification: str
    deployment_type: str
    supported_models: List[str]
    modalities: List[str]
    input_cost_per_1m_usd: float
    output_cost_per_1m_usd: float
    blended_cost_per_1m_usd: float
    context_window_tokens: int
    max_output_tokens: Optional[int]
    rate_limit_rpm: Optional[int]
    rate_limit_tpm: Optional[int]
    free_tier_available: bool
    supports_tool_call: bool
    supports_reasoning: bool
    pricing_tier: str
    docs_url: str
    source_feeds: List[str]
    updated_at: str

    @property
    def is_free(self) -> bool:
        """Returns True if the model offers a free tier or $0.00 blended pricing."""
        return self.free_tier_available or self.blended_cost_per_1m_usd == 0.0

    @property
    def is_million_plus_context(self) -> bool:
        """Returns True if context window is at least 1,000,000 tokens."""
        return self.context_window_tokens >= 1_000_000

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Estimates the dollar cost of processing given input and output tokens.
        """
        input_cost = (input_tokens / 1_000_000.0) * self.input_cost_per_1m_usd
        output_cost = (output_tokens / 1_000_000.0) * self.output_cost_per_1m_usd
        return round(input_cost + output_cost, 6)

    def calculate_arbitrage_vs(self, baseline_blended_cost_per_1m: float) -> Tuple[float, float]:
        """
        Calculates savings compared to a baseline blended rate.
        Returns: (dollar_savings_per_1m, percentage_saved)
        """
        dollar_savings = baseline_blended_cost_per_1m - self.blended_cost_per_1m_usd
        if baseline_blended_cost_per_1m > 0:
            pct_saved = (dollar_savings / baseline_blended_cost_per_1m) * 100.0
        else:
            pct_saved = 0.0
        return round(dollar_savings, 4), round(pct_saved, 2)

    def matches_query(self, query: str) -> bool:
        """Checks if slug, name, provider or family matches search query."""
        q = query.lower().strip()
        if not q:
            return True
        return (
            q in self.slug.lower()
            or q in self.tool_name.lower()
            or q in self.provider.lower()
            or q in self.model_family.lower()
            or any(q in m.lower() for m in self.supported_models)
        )

    def generate_python_snippet(self, api_key: str = "YOUR_API_KEY") -> str:
        """Generates OpenAI-compatible Python client snippet."""
        return f'''from openai import OpenAI

# Model: {self.tool_name} ({self.provider})
# Context Window: {self.context_window_tokens:,} tokens | Blended: ${self.blendedCost_or_zero:.4f}/1M
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="{api_key}",
)

response = client.chat.completions.create(
    model="{self.slug}",
    messages=[
        {{"role": "user", "content": "Hello! Testing context window {self.context_window_tokens:,} tokens."}}
    ],
)
print(response.choices[0].message.content)
'''

    def generate_curl_snippet(self, api_key: str = "YOUR_API_KEY") -> str:
        """Generates cURL command snippet."""
        return f'''curl -X POST "https://openrouter.ai/api/v1/chat/completions" \\
  -H "Authorization: Bearer {api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model": "{self.slug}",
    "messages": [{{"role": "user", "content": "Benchmark test"}}]
  }}'
'''

    @property
    def blendedCost_or_zero(self) -> float:
        return self.blended_cost_per_1m_usd

    @classmethod
    def from_csv_row(cls, row: Dict[str, str]) -> LLMModel:
        """Parses a CSV dictionary row into an LLMModel instance."""
        def parse_bool(val: str) -> bool:
            return str(val).strip().lower() in ("true", "1", "yes", "t")

        def parse_float(val: str, default: float = 0.0) -> float:
            try:
                v = str(val).strip()
                return float(v) if v else default
            except ValueError:
                return default

        def parse_int(val: str) -> Optional[int]:
            try:
                v = str(val).strip()
                return int(v) if v else None
            except ValueError:
                return None

        def parse_list(val: str, delim: str = ";") -> List[str]:
            if not val:
                return []
            return [part.strip() for part in str(val).split(delim) if part.strip()]

        return cls(
            slug=row.get("slug", "").strip(),
            tool_name=row.get("tool_name", "").strip(),
            provider=row.get("provider", "").strip(),
            model_family=row.get("model_family", "").strip(),
            classification=row.get("classification", "").strip(),
            deployment_type=row.get("deployment_type", "").strip(),
            supported_models=parse_list(row.get("supported_models", "")),
            modalities=parse_list(row.get("modalities", "")),
            input_cost_per_1m_usd=parse_float(row.get("input_cost_per_1m_usd", "0")),
            output_cost_per_1m_usd=parse_float(row.get("output_cost_per_1m_usd", "0")),
            blended_cost_per_1m_usd=parse_float(row.get("blended_cost_per_1m_usd", "0")),
            context_window_tokens=parse_int(row.get("context_window_tokens", "0")) or 0,
            max_output_tokens=parse_int(row.get("max_output_tokens", "")),
            rate_limit_rpm=parse_int(row.get("rate_limit_rpm", "")),
            rate_limit_tpm=parse_int(row.get("rate_limit_tpm", "")),
            free_tier_available=parse_bool(row.get("free_tier_available", "false")),
            supports_tool_call=parse_bool(row.get("supports_tool_call", "false")),
            supports_reasoning=parse_bool(row.get("supports_reasoning", "false")),
            pricing_tier=row.get("pricing_tier", "").strip(),
            docs_url=row.get("docs_url", "").strip(),
            source_feeds=parse_list(row.get("source_feeds", "")),
            updated_at=row.get("updated_at", "").strip(),
        )


class BenchmarkCatalog:
    """
    In-memory catalog manager for LLM API benchmarks and metadata.
    """

    def __init__(self, models: Optional[List[LLMModel]] = None) -> None:
        self._models: List[LLMModel] = models or []

    @property
    def models(self) -> List[LLMModel]:
        return list(self._models)

    def __len__(self) -> int:
        return len(self._models)

    @classmethod
    def from_csv(cls, file_path: str | Path) -> BenchmarkCatalog:
        """Loads and parses models from the benchmark CSV file."""
        models: List[LLMModel] = []
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Benchmark CSV file not found: {path}")

        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                models.append(LLMModel.from_csv_row(row))

        return cls(models)

    def find_by_slug(self, slug: str) -> Optional[LLMModel]:
        """Finds model by canonical slug key."""
        target = slug.lower().strip()
        for m in self._models:
            if m.slug.lower() == target:
                return m
        return None

    def search(self, query: str) -> List[LLMModel]:
        """Full-text search across models."""
        return [m for m in self._models if m.matches_query(query)]

    def get_free_tier(self) -> List[LLMModel]:
        """Filters models that offer free tier access."""
        return [m for m in self._models if m.is_free]

    def get_million_plus(self) -> List[LLMModel]:
        """Filters models with at least 1M context window."""
        return [m for m in self._models if m.is_million_plus_context]

    def top_by_context(self, limit: int = 15) -> List[LLMModel]:
        """Returns top models ranked by maximum context window."""
        return sorted(self._models, key=lambda m: m.context_window_tokens, reverse=True)[:limit]

    def cheapest_with_tools_and_reasoning(
        self,
        min_context: int = 1_000_000,
        limit: int = 10,
    ) -> List[LLMModel]:
        """
        Returns cheapest models supporting both tool calling and reasoning with a minimum context window.
        """
        filtered = [
            m
            for m in self._models
            if m.supports_tool_call
            and m.supports_reasoning
            and m.context_window_tokens >= min_context
        ]
        return sorted(filtered, key=lambda m: m.blended_cost_per_1m_usd)[:limit]

    def get_pareto_frontier(self) -> List[LLMModel]:
        """
        Calculates Pareto-optimal models based on context window vs blended cost.
        """
        frontier: List[LLMModel] = []
        for candidate in self._models:
            dominated = False
            for other in self._models:
                if other.slug == candidate.slug:
                    continue
                cost_better = other.blended_cost_per_1m_usd <= candidate.blended_cost_per_1m_usd
                ctx_better = other.context_window_tokens >= candidate.context_window_tokens
                strictly_better = (
                    other.blended_cost_per_1m_usd < candidate.blended_cost_per_1m_usd
                    or other.context_window_tokens > candidate.context_window_tokens
                )
                if cost_better and ctx_better and strictly_better:
                    dominated = True
                    break
            if not dominated:
                frontier.append(candidate)
        return sorted(frontier, key=lambda m: m.context_window_tokens, reverse=True)

    def filter(
        self,
        provider: Optional[str] = None,
        classification: Optional[str] = None,
        only_free: bool = False,
        require_tools: bool = False,
        require_reasoning: bool = False,
        min_context: int = 0,
        max_blended_cost: Optional[float] = None,
    ) -> List[LLMModel]:
        """Flexible multi-criteria catalog filter."""
        results = self._models
        if provider:
            p = provider.lower().strip()
            results = [m for m in results if m.provider.lower() == p]
        if classification:
            c = classification.lower().strip()
            results = [m for m in results if m.classification.lower() == c]
        if only_free:
            results = [m for m in results if m.is_free]
        if require_tools:
            results = [m for m in results if m.supports_tool_call]
        if require_reasoning:
            results = [m for m in results if m.supports_reasoning]
        if min_context > 0:
            results = [m for m in results if m.context_window_tokens >= min_context]
        if max_blended_cost is not None:
            results = [m for m in results if m.blended_cost_per_1m_usd <= max_blended_cost]
        return results

    def get_providers(self) -> List[str]:
        """Returns sorted list of distinct canonical provider names."""
        return sorted({m.provider for m in self._models if m.provider})

    def get_provider_summary(self, provider: str) -> Dict[str, Any]:
        """Aggregates metrics for a single provider."""
        models = self.filter(provider=provider)
        if not models:
            return {"provider": provider, "model_count": 0}

        costs = [m.blended_cost_per_1m_usd for m in models]
        best_val = min(models, key=lambda m: m.blended_cost_per_1m_usd)

        return {
            "provider": provider,
            "model_count": len(models),
            "open_weights_count": sum(1 for m in models if "open-weights" in m.deployment_type.lower()),
            "proprietary_saas_count": sum(1 for m in models if "proprietary" in m.deployment_type.lower()),
            "free_tier_count": sum(1 for m in models if m.is_free),
            "tool_call_count": sum(1 for m in models if m.supports_tool_call),
            "reasoning_count": sum(1 for m in models if m.supports_reasoning),
            "avg_blended_cost_per_1m_usd": round(sum(costs) / len(costs), 6),
            "min_blended_cost_per_1m_usd": round(min(costs), 6),
            "max_blended_cost_per_1m_usd": round(max(costs), 6),
            "max_context_window_tokens": max(m.context_window_tokens for m in models),
            "best_value_slug": best_val.slug,
        }

    def get_global_stats(self) -> Dict[str, Any]:
        """Generates summary statistics for the whole catalog."""
        if not self._models:
            return {"total_models": 0}

        return {
            "total_models": len(self._models),
            "providers_count": len(self.get_providers()),
            "free_tier_count": sum(1 for m in self._models if m.is_free),
            "million_plus_context_count": sum(1 for m in self._models if m.is_million_plus_context),
            "tool_calling_count": sum(1 for m in self._models if m.supports_tool_call),
            "reasoning_count": sum(1 for m in self._models if m.supports_reasoning),
            "max_context_window": max(m.context_window_tokens for m in self._models),
            "median_blended_cost": self._calculate_median_cost(),
        }

    def _calculate_median_cost(self) -> float:
        costs = sorted(m.blended_cost_per_1m_usd for m in self._models)
        if not costs:
            return 0.0
        n = len(costs)
        mid = n // 2
        if n % 2 == 1:
            return round(costs[mid], 6)
        return round((costs[mid - 1] + costs[mid]) / 2.0, 6)


class CostArbitrageEngine:
    """
    Computes economic arbitrage metrics between Open-Weights and Proprietary SaaS models.
    """

    DEFAULT_PROPRIETARY_BASELINE_USD = 3.00  # Default standard SaaS rate ($3.00 / 1M tokens)

    def __init__(self, catalog: BenchmarkCatalog) -> None:
        self.catalog = catalog

    def compare_open_vs_proprietary(self) -> Dict[str, Any]:
        """
        Calculates median costs and percentage arbitrage savings.
        """
        open_weights = [
            m.blended_cost_per_1m_usd
            for m in self.catalog.models
            if "open-weights" in m.deployment_type.lower() or m.classification.lower() == "open-source"
        ]
        proprietary = [
            m.blended_cost_per_1m_usd
            for m in self.catalog.models
            if "proprietary" in m.deployment_type.lower() or m.classification.lower() == "saas"
        ]

        def median(vals: List[float]) -> float:
            if not vals:
                return 0.0
            s = sorted(vals)
            n = len(s)
            mid = n // 2
            return s[mid] if n % 2 == 1 else (s[mid - 1] + s[mid]) / 2.0

        med_open = median(open_weights)
        med_prop = median(proprietary)

        if med_prop > 0:
            savings_pct = round(((med_prop - med_open) / med_prop) * 100.0, 2)
        else:
            savings_pct = 0.0

        return {
            "open_weights_count": len(open_weights),
            "proprietary_count": len(proprietary),
            "median_open_weights_blended_usd": round(med_open, 4),
            "median_proprietary_blended_usd": round(med_prop, 4),
            "dollar_arbitrage_per_1m": round(med_prop - med_open, 4),
            "arbitrage_savings_percent": savings_pct,
        }

    def project_monthly_savings(
        self,
        monthly_tokens: int,
        target_model: LLMModel,
        baseline_cost_per_1m: float = DEFAULT_PROPRIETARY_BASELINE_USD,
    ) -> Dict[str, float]:
        """
        Calculates expected monthly bill vs savings for a given token volume.
        """
        bill = (monthly_tokens / 1_000_000.0) * target_model.blended_cost_per_1m_usd
        baseline_bill = (monthly_tokens / 1_000_000.0) * baseline_cost_per_1m
        savings = baseline_bill - bill
        savings_pct = (savings / baseline_bill) * 100.0 if baseline_bill > 0 else 0.0

        return {
            "monthly_tokens": monthly_tokens,
            "target_model_cost_usd": round(bill, 2),
            "baseline_cost_usd": round(baseline_bill, 2),
            "net_monthly_savings_usd": round(savings, 2),
            "savings_percent": round(savings_pct, 2),
        }


def generate_degen_proxy_script(
    keys: Optional[List[str]] = None,
    target_url: str = "https://openrouter.ai/api/v1/chat/completions",
) -> str:
    """
    Generates a self-contained Python FastAPI proxy script with multi-key round-robin
    and automatic 429 backoff quarantine.
    """
    import json
    key_list = keys if keys else ["AIzaSyDemo1", "AIzaSyDemo2", "AIzaSyDemo3"]
    keys_json = json.dumps(key_list, indent=4)

    return f'''#!/usr/bin/env python3
"""
Degen Anti-429 Proxy: High-Concurrency Multi-Key Load Balancer & Rotator
Run with: pip install fastapi uvicorn httpx && python -m uvicorn degen_proxy:app --port 8000
"""

import time
import asyncio
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx

app = FastAPI(title="Degen Anti-429 Pooler Proxy", version="2.0.0")

KEYS = {keys_json}
TARGET_URL = "{target_url}"

class KeyPool:
    def __init__(self, keys: List[str], cooldown_sec: int = 60):
        self.keys = keys
        self.cooldown_sec = cooldown_sec
        self.cooldowns: Dict[str, float] = {{}}
        self.current_idx = 0
        self.lock = asyncio.Lock()

    async def acquire_key(self) -> str:
        async with self.lock:
            now = time.time()
            self.cooldowns = {{k: exp for k, exp in self.cooldowns.items() if exp > now}}
            for _ in range(len(self.keys)):
                k = self.keys[self.current_idx]
                self.current_idx = (self.current_idx + 1) % len(self.keys)
                if k not in self.cooldowns:
                    return k
            wait = min(self.cooldowns.values()) - now if self.cooldowns else self.cooldown_sec
            raise HTTPException(status_code=429, detail=f"All keys in 429 quarantine. Retry in {{max(1, int(wait))}}s")

    async def mark_quarantined(self, key: str, retry_after: Optional[int] = None):
        async with self.lock:
            wait = retry_after if (retry_after and retry_after > 0) else self.cooldown_sec
            self.cooldowns[key] = time.time() + wait
            print(f"[Anti-429] Key ...{{key[-6:]}} quarantined for {{wait}}s")

pool = KeyPool(KEYS)

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    max_retries = min(len(KEYS), 5)
    for _ in range(max_retries):
        key = await pool.acquire_key()
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    TARGET_URL,
                    headers={{"Authorization": f"Bearer {{key}}", "Content-Type": "application/json"}},
                    json=body,
                )
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("retry-after", "60"))
                    await pool.mark_quarantined(key, retry_after)
                    continue
                return JSONResponse(status_code=resp.status_code, content=resp.json())
        except Exception:
            continue
    raise HTTPException(status_code=429, detail="Exhausted all available pool keys.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
'''

