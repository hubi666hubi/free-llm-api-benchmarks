"""
Unit tests for benchmark_catalog.py
"""

import unittest
from pathlib import Path
from python.benchmark_catalog import BenchmarkCatalog, LLMModel, CostArbitrageEngine

CSV_PATH = Path(__file__).resolve().parent.parent / "free_tier_llm_apis_top100.csv"


class TestBenchmarkCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = BenchmarkCatalog.from_csv(CSV_PATH)

    def test_catalog_loads_models(self):
        self.assertEqual(len(self.catalog), 100)

    def test_find_by_slug(self):
        model = self.catalog.find_by_slug("google/gemini-exp-1206")
        self.assertIsNotNone(model)
        self.assertEqual(model.provider, "google")
        self.assertEqual(model.context_window_tokens, 2097152)
        self.assertTrue(model.is_free)
        self.assertTrue(model.supports_tool_call)
        self.assertTrue(model.supports_reasoning)

    def test_search(self):
        results = self.catalog.search("deepseek")
        self.assertGreater(len(results), 0)
        for m in results:
            self.assertTrue("deepseek" in m.slug.lower() or "deepseek" in m.tool_name.lower())

    def test_top_by_context(self):
        top15 = self.catalog.top_by_context(15)
        self.assertEqual(len(top15), 15)
        # Verify descending order
        contexts = [m.context_window_tokens for m in top15]
        self.assertEqual(contexts, sorted(contexts, reverse=True))
        self.assertGreaterEqual(contexts[0], 2_000_000)

    def test_cheapest_with_tools_and_reasoning(self):
        cheapest = self.catalog.cheapest_with_tools_and_reasoning(min_context=1_000_000, limit=5)
        self.assertGreater(len(cheapest), 0)
        for m in cheapest:
            self.assertTrue(m.supports_tool_call)
            self.assertTrue(m.supports_reasoning)
            self.assertGreaterEqual(m.context_window_tokens, 1_000_000)
        # Check ascending cost
        costs = [m.blended_cost_per_1m_usd for m in cheapest]
        self.assertEqual(costs, sorted(costs))

    def test_provider_summary(self):
        google_summary = self.catalog.get_provider_summary("google")
        self.assertEqual(google_summary["provider"], "google")
        self.assertGreater(google_summary["model_count"], 0)
        self.assertEqual(google_summary["max_context_window_tokens"], 2097152)

    def test_cost_estimation(self):
        model = self.catalog.find_by_slug("google/gemini-exp-1206")
        cost = model.estimate_cost(100_000, 20_000)
        self.assertEqual(cost, 0.0)

    def test_arbitrage_engine(self):
        engine = CostArbitrageEngine(self.catalog)
        comparison = engine.compare_open_vs_proprietary()
        self.assertIn("arbitrage_savings_percent", comparison)
        self.assertGreater(comparison["open_weights_count"], 0)

        # Monthly projection
        model = self.catalog.find_by_slug("google/gemini-exp-1206")
        proj = engine.project_monthly_savings(10_000_000, model, baseline_cost_per_1m=3.00)
        self.assertEqual(proj["baseline_cost_usd"], 30.0)
        self.assertEqual(proj["target_model_cost_usd"], 0.0)
        self.assertEqual(proj["net_monthly_savings_usd"], 30.0)

    def test_pareto_frontier(self):
        frontier = self.catalog.get_pareto_frontier()
        self.assertGreater(len(frontier), 0)
        self.assertEqual(frontier[0].slug, "google/gemini-exp-1206")

    def test_code_snippets(self):
        model = self.catalog.find_by_slug("google/gemini-exp-1206")
        self.assertIsNotNone(model)
        py_snippet = model.generate_python_snippet()
        self.assertIn("OpenAI", py_snippet)
        self.assertIn("google/gemini-exp-1206", py_snippet)
        curl_snippet = model.generate_curl_snippet()
        self.assertIn("curl", curl_snippet)


if __name__ == "__main__":
    unittest.main()
