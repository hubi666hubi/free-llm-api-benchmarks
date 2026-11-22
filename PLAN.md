# Plan: restart, real-money only (2026-11-22)

## 1. State of the project (audit)

**Works:** React/Vite app (catalog explorer, chat, Degen Lab), TS core (DI, catalog, Ollama), Python CLI. 91 TS tests + 11 Python tests green, build OK, `npm audit` 0.
**Sales funnel:** 3 Gumroad products + the Render portal all return HTTP 200 (checked live).

**Problems (honest):**
| # | Problem | Why it hurts revenue |
|---|---|---|
| 1 | The product is a repackaged public feed (OpenRouter, LiteLLM, models.dev). Anyone can rebuild it in an afternoon. | $49 for the "full warehouse" has no moat. The buyer pays for convenience only. |
| 2 | The static CSV/Parquet goes stale in days (prices and models change constantly). | Nothing justifies repeat purchases. |
| 3 | Product #3 (B2B lead scoring kit + `.exe`) is advertised in the README but is not in the repo. Nothing in the repo supports it. | Selling it is a refund/chargeback risk. |
| 4 | There is no traffic measurement, no email capture, no analytics. | We can't tell what converts. |
| 5 | Degen Lab (pooling many free keys, zero-auth endpoints, "abliterated" models) breaks provider ToS. | Account bans, platform risk (Gumroad/GitHub). Not something to build revenue on. |
| 6 | Duplicate `free_tier_top100.csv` and `free_tier_llm_apis_top100.csv`. `.antigravity/chats` is committed to a public repo. | Cleanliness. Chats may leak personal data. |
| 7 | Some README figures (the "82.5% cheaper" arbitrage) compare medians across different model classes. | Credibility risk if challenged. |

## 2. What can realistically earn money

Ranked by realism and effort. No guarantees. Expect small amounts at the start.

1. **Subscription: weekly-refreshed dataset + price-change alerts** (e.g. $9–19/mo).
   The moat is freshness and history: price/context/free-tier diffs over time, which a one-off scrape can't give. Build: GitHub Actions cron → snapshot → diff → publish changelog and email.
2. **Free top-100 as a lead magnet → email list → paid tier.** Add an email-capture step (Gumroad "pay $0+" already collects emails). Each weekly diff is the newsletter.
3. **Cost-calculator / "cheapest model for my workload" tool** with affiliate or referral links to providers that have programs. The portal exists. Add real workload presets (RAG, coding agent, batch).
4. **Paid custom reports / consulting** ("cut my LLM bill"), sold to small teams. Highest $ per sale, needs outreach.

Drop or park: Degen Lab as a selling point, and Product #3 until it actually exists.

## 3. Plan

**Week 1 — clean up and make claims honest**
- Remove the duplicate CSV and untrack `.antigravity/chats`. Confirm with the owner first (the app may use these for history).
- Fix README claims (document the arbitrage method, or drop the headline). Remove or mark "coming soon" for Product #3.
- Add `LICENSE`, source attribution (models.dev MIT, OpenRouter/LiteLLM terms) and a data-freshness date to the README.

**Week 2 — freshness engine (the real asset)**
- `python/` ingest script + GitHub Actions weekly cron. Writes dated snapshots and a `CHANGELOG` of price/context/free-tier changes.
- Tests for the diff logic.

**Week 3 — monetize**
- Gumroad subscription (membership) product: "LLM Price Radar". Landing page on the portal and a sample changelog.
- Email capture on the portal. Add basic privacy-friendly analytics.

**Week 4 — distribute and measure**
- Post the weekly diff on Reddit (r/LocalLLaMA, r/LLMDevs), Hacker News (Show HN), and dev.to. Link to the free top-100.
- Metrics: visits → free downloads → paid. Decide after 4 weeks: double down on what converted, cut the rest.

## 4. Decisions needed from the owner
1. Approve dropping Degen Lab from marketing, and the cleanup in week 1?
2. Subscription price and the "Price Radar" name OK?
3. Is Product #3 real (where are the files)? If not, pull it from the README.
