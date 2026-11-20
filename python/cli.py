#!/usr/bin/env python3
"""
CLI Tool for Free LLM API Benchmarks.
Allows querying catalog models, computing Pareto frontier, and generating code snippets.
"""

import argparse
import sys
from pathlib import Path
from python.benchmark_catalog import BenchmarkCatalog, generate_degen_proxy_script

DEFAULT_CSV = Path(__file__).resolve().parent.parent / "free_tier_llm_apis_top100.csv"


def format_table(rows: list[list[str]], headers: list[str]) -> str:
    """Pretty prints an ASCII table."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))

    header_line = " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep_line = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
    data_lines = [
        " | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row))
        for row in rows
    ]
    return f"{header_line}\n{sep_line}\n" + "\n".join(data_lines)


def main():
    parser = argparse.ArgumentParser(
        description="Free LLM API Benchmarks CLI (100 Top-Tier Models)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # top
    top_parser = subparsers.add_parser("top", help="Top models ranked by context window")
    top_parser.add_argument("-n", "--limit", type=int, default=10, help="Number of models (default: 10)")

    # cheapest
    cheap_parser = subparsers.add_parser("cheapest", help="Cheapest 1M+ context models")
    cheap_parser.add_argument("-n", "--limit", type=int, default=10, help="Number of models")
    cheap_parser.add_argument("--min-context", type=int, default=1_000_000, help="Minimum context tokens")

    # pareto
    subparsers.add_parser("pareto", help="Show Pareto-optimal models (cost vs context)")

    # search
    search_parser = subparsers.add_parser("search", help="Search models by keyword")
    search_parser.add_argument("query", type=str, help="Search keyword")

    # snippet
    snippet_parser = subparsers.add_parser("snippet", help="Generate code snippet for a model")
    snippet_parser.add_argument("slug", type=str, help="Canonical model slug (e.g. google/gemini-exp-1206)")
    snippet_parser.add_argument("--lang", choices=["python", "curl"], default="python", help="Language snippet")

    # stats
    subparsers.add_parser("stats", help="Show global benchmark catalog stats")

    # degen-proxy
    degen_parser = subparsers.add_parser("degen-proxy", help="Generate Anti-429 Multi-Key FastAPI Proxy script")
    degen_parser.add_argument("--keys", nargs="*", default=None, help="List of API keys to pool")
    degen_parser.add_argument("--target", default="https://openrouter.ai/api/v1/chat/completions", help="Upstream endpoint URL")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    catalog = BenchmarkCatalog.from_csv(DEFAULT_CSV)

    if args.command == "top":
        models = catalog.top_by_context(args.limit)
        headers = ["Model", "Provider", "Context", "Blended $/1M", "Tools", "Reasoning"]
        rows = [
            [
                m.tool_name,
                m.provider,
                f"{m.context_window_tokens:,}",
                f"${m.blended_cost_per_1m_usd:.4f}",
                "Yes" if m.supports_tool_call else "No",
                "Yes" if m.supports_reasoning else "No",
            ]
            for m in models
        ]
        print(f"\n=== Top {args.limit} Models by Context Window ===")
        print(format_table(rows, headers))

    elif args.command == "cheapest":
        models = catalog.cheapest_with_tools_and_reasoning(min_context=args.min_context, limit=args.limit)
        headers = ["Model", "Provider", "Blended $/1M", "Context", "Input $/1M", "Output $/1M"]
        rows = [
            [
                m.tool_name,
                m.provider,
                f"${m.blended_cost_per_1m_usd:.4f}",
                f"{m.context_window_tokens:,}",
                f"${m.input_cost_per_1m_usd:.3f}",
                f"${m.output_cost_per_1m_usd:.3f}",
            ]
            for m in models
        ]
        print(f"\n=== Cheapest Models (Tools + Reasoning, Context >= {args.min_context:,}) ===")
        print(format_table(rows, headers))

    elif args.command == "pareto":
        models = catalog.get_pareto_frontier()
        headers = ["Model", "Provider", "Context", "Blended $/1M", "Tier"]
        rows = [
            [
                m.tool_name,
                m.provider,
                f"{m.context_window_tokens:,}",
                f"${m.blended_cost_per_1m_usd:.4f}",
                m.pricing_tier,
            ]
            for m in models
        ]
        print("\n=== Global Pareto Frontier (Non-dominated in Cost & Context) ===")
        print(format_table(rows, headers))

    elif args.command == "search":
        matches = catalog.search(args.query)
        headers = ["Slug", "Provider", "Context", "Blended $/1M", "Free Tier"]
        rows = [
            [
                m.slug,
                m.provider,
                f"{m.context_window_tokens:,}",
                f"${m.blended_cost_per_1m_usd:.4f}",
                "Yes" if m.is_free else "No",
            ]
            for m in matches
        ]
        print(f"\n=== Found {len(matches)} matches for '{args.query}' ===")
        print(format_table(rows, headers))

    elif args.command == "snippet":
        model = catalog.find_by_slug(args.slug)
        if not model:
            print(f"Error: Model with slug '{args.slug}' not found.", file=sys.stderr)
            sys.exit(1)

        print(f"\n# Code Snippet for {model.toolName if hasattr(model, 'toolName') else model.tool_name} ({args.lang})")
        if args.lang == "python":
            print(model.generate_python_snippet())
        else:
            print(model.generate_curl_snippet())

    elif args.command == "stats":
        stats = catalog.get_global_stats()
        print("\n=== Global Catalog Statistics ===")
        for k, v in stats.items():
            print(f"• {k}: {v}")

    elif args.command == "degen-proxy":
        script = generate_degen_proxy_script(keys=args.keys, target_url=args.target)
        print(script)


if __name__ == "__main__":
    main()
