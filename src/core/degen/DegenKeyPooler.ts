/**
 * DegenKeyPooler: High-concurrency API Key Rotator & Anti-429 Resilience Engine.
 * Implements round-robin key scheduling, automatic quarantine upon HTTP 429,
 * exponential / Retry-After backoff cooldowns, and production proxy code generation.
 */

import { IClock, IIdGenerator } from "../di/interfaces";
import { SystemClock, DefaultIdGenerator } from "../di/defaults";

export interface ManagedKey {
  id: string;
  key: string;
  alias: string;
  status: "healthy" | "cooldown" | "exhausted";
  totalRequests: number;
  totalErrors: number;
  lastUsedAt: number | null;
  cooldownUntil: number | null;
}

export interface PoolerStats {
  totalKeys: number;
  healthyKeys: number;
  cooldownKeys: number;
  exhaustedKeys: number;
  totalRouted: number;
  totalFailovers: number;
}

export interface RouteResult {
  selectedKey: ManagedKey;
  attempt: number;
  failoversRequired: number;
}

export class DegenKeyPooler {
  private keys: ManagedKey[] = [];
  private currentIndex: number = 0;
  private defaultCooldownSeconds: number = 60;
  private totalRouted: number = 0;
  private totalFailovers: number = 0;
  private readonly clock: IClock;
  private readonly idGenerator: IIdGenerator;

  constructor(
    initialKeys: string[] = [],
    defaultCooldownSeconds = 60,
    clock: IClock = new SystemClock(),
    idGenerator: IIdGenerator = new DefaultIdGenerator()
  ) {
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.defaultCooldownSeconds = defaultCooldownSeconds;
    initialKeys.forEach((key, idx) => this.addKey(key, `Key #${idx + 1}`));
  }

  public addKey(rawKey: string, alias?: string): ManagedKey {
    const trimmed = rawKey.trim();
    const id = this.idGenerator.generateId("k");
    const newKey: ManagedKey = {
      id,
      key: trimmed,
      alias: alias || `Key #${this.keys.length + 1}`,
      status: "healthy",
      totalRequests: 0,
      totalErrors: 0,
      lastUsedAt: null,
      cooldownUntil: null,
    };
    this.keys.push(newKey);
    return newKey;
  }

  public removeKey(id: string): boolean {
    const prevLen = this.keys.length;
    this.keys = this.keys.filter((k) => k.id !== id);
    return this.keys.length < prevLen;
  }

  public getKeys(): ManagedKey[] {
    this.refreshCooldowns();
    return [...this.keys];
  }

  public refreshCooldowns(now = this.clock.timestamp()): void {
    for (const key of this.keys) {
      if (key.status === "cooldown" && key.cooldownUntil && key.cooldownUntil <= now) {
        key.status = "healthy";
        key.cooldownUntil = null;
      }
    }
  }

  public acquireKey(now = this.clock.timestamp()): RouteResult {
    this.refreshCooldowns(now);

    if (this.keys.length === 0) {
      throw new Error("DegenKeyPooler: Pula kluczy jest pusta! Dodaj przynajmniej jeden klucz.");
    }

    let attempts = 0;
    let failovers = 0;
    const poolSize = this.keys.length;

    while (attempts < poolSize) {
      const candidate = this.keys[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % poolSize;

      if (candidate.status === "healthy") {
        candidate.totalRequests += 1;
        candidate.lastUsedAt = now;
        this.totalRouted += 1;
        this.totalFailovers += failovers;

        return {
          selectedKey: candidate,
          attempt: attempts + 1,
          failoversRequired: failovers,
        };
      }

      failovers += 1;
      attempts += 1;
    }

    // All keys in cooldown or exhausted
    const nextFree = this.keys
      .filter((k) => k.cooldownUntil !== null)
      .sort((a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0))[0];

    const waitSeconds = nextFree?.cooldownUntil ? Math.max(1, Math.ceil((nextFree.cooldownUntil - now) / 1000)) : 60;

    throw new Error(`Wszystkie klucze (${poolSize}) w puli są w stanie 429 Cooldown! Najbliższy odblokuje się za ${waitSeconds}s.`);
  }

  public reportRateLimit(keyId: string, retryAfterSeconds?: number, now = this.clock.timestamp()): void {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return;

    const cooldownSec = retryAfterSeconds && retryAfterSeconds > 0 ? retryAfterSeconds : this.defaultCooldownSeconds;
    key.status = "cooldown";
    key.totalErrors += 1;
    key.cooldownUntil = now + cooldownSec * 1000;
  }

  public reportSuccess(keyId: string): void {
    const key = this.keys.find((k) => k.id === keyId);
    if (!key) return;
    if (key.status === "cooldown") {
      key.status = "healthy";
      key.cooldownUntil = null;
    }
  }

  public getStats(): PoolerStats {
    this.refreshCooldowns();
    return {
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter((k) => k.status === "healthy").length,
      cooldownKeys: this.keys.filter((k) => k.status === "cooldown").length,
      exhaustedKeys: this.keys.filter((k) => k.status === "exhausted").length,
      totalRouted: this.totalRouted,
      totalFailovers: this.totalFailovers,
    };
  }

  public resetStats(): void {
    this.totalRouted = 0;
    this.totalFailovers = 0;
    for (const key of this.keys) {
      key.totalRequests = 0;
      key.totalErrors = 0;
      key.status = "healthy";
      key.cooldownUntil = null;
      key.lastUsedAt = null;
    }
  }

  /**
   * Generates a self-contained, drop-in Python FastAPI proxy script
   * with automatic key rotation, 429 backoff handling, and standard /v1/chat/completions endpoint.
   */
  public generatePythonFastApiProxy(provider = "google", model = "gemini-2.0-flash-exp"): string {
    const rawKeys = this.keys.map((k) => k.key);
    const keysJson = JSON.stringify(rawKeys.length > 0 ? rawKeys : ["AIzaSyDemo1", "AIzaSyDemo2", "AIzaSyDemo3"], null, 4);

    return `#!/usr/bin/env python3
"""
Degen Anti-429 Proxy: High-Concurrency Multi-Key Load Balancer & Rotator
Target: ${provider} | Model: ${model}
Run with: pip install fastapi uvicorn httpx && uvicorn degen_proxy:app --port 8000
"""

import time
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
import httpx

app = FastAPI(title="Degen Anti-429 Pooler Proxy", version="1.0.0")

KEYS = ${keysJson}

class KeyPool:
    def __init__(self, keys: List[str], cooldown_sec: int = 60):
        self.keys = keys
        self.cooldown_sec = cooldown_sec
        self.cooldowns: Dict[str, float] = {}
        self.current_idx = 0
        self.lock = asyncio.Lock()

    async def acquire_key(self) -> str:
        async with self.lock:
            now = time.time()
            # Clean expired cooldowns
            self.cooldowns = {k: expiry for k, expiry in self.cooldowns.items() if expiry > now}
            
            for _ in range(len(self.keys)):
                key = self.keys[self.current_idx]
                self.current_idx = (self.current_idx + 1) % len(self.keys)
                if key not in self.cooldowns:
                    return key
            
            # All in cooldown
            min_wait = min(self.cooldowns.values()) - now if self.cooldowns else self.cooldown_sec
            raise HTTPException(status_code=429, detail=f"All keys in 429 cooldown. Retry in {max(1, int(min_wait))}s")

    async def mark_rate_limited(self, key: str, retry_after: Optional[int] = None):
        async with self.lock:
            wait_time = retry_after if (retry_after and retry_after > 0) else self.cooldown_sec
            self.cooldowns[key] = time.time() + wait_time
            print(f"[Anti-429] Key quarantined for {wait_time}s: ...{key[-6:]}")

pool = KeyPool(KEYS)

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    max_retries = min(len(KEYS), 5)
    
    for attempt in range(max_retries):
        key = await pool.acquire_key()
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Forward to upstream (e.g. OpenRouter / Google / OpenAI compatible)
                headers = {
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json"
                }
                # Default endpoint target (adapt to your upstream provider):
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=body
                )
                
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("retry-after", "60"))
                    await pool.mark_rate_limited(key, retry_after)
                    continue  # try next key immediately!
                
                return JSONResponse(status_code=resp.status_code, content=resp.json())
        except Exception as e:
            if attempt == max_retries - 1:
                raise HTTPException(status_code=502, detail=str(e))
            continue
            
    raise HTTPException(status_code=429, detail="Exhausted all available pool keys.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
`;
  }

  /**
   * Generates a production LiteLLM YAML router configuration
   */
  public generateLiteLLMConfig(modelName = "gemini/gemini-2.0-flash-exp"): string {
    const rawKeys = this.keys.map((k) => k.key);
    const keys = rawKeys.length > 0 ? rawKeys : ["key_alpha_1", "key_beta_2", "key_gamma_3"];

    const modelListYaml = keys
      .map(
        (key) => `  - model_name: degen-router-model
    litellm_params:
      model: ${modelName}
      api_key: "${key}"
      rpm: 15
      tpm: 1000000`
      )
      .join("\n\n");

    return `# LiteLLM Multi-Key Anti-429 Router Configuration
# Run with: litellm --config litellm_config.yaml --port 4000

model_list:
${modelListYaml}

router_settings:
  routing_strategy: "latency-based-routing" # or "usage-based-routing-v2"
  num_retries: ${keys.length}
  timeout: 30
  cooldown_time: 60
  allowed_fails: 1

general_settings:
  master_key: "sk-degen-master-secret"
`;
  }

  /**
   * Generates a Cloudflare Worker edge proxy with zero cold start
   */
  public generateCloudflareWorker(): string {
    const rawKeys = this.keys.map((k) => k.key);
    const keysJson = JSON.stringify(rawKeys.length > 0 ? rawKeys : ["key1", "key2", "key3"]);

    return `// Cloudflare Worker: Zero-Cold-Start Multi-Key LLM Pooler
// Deploy with Wrangler: npx wrangler deploy
const KEYS = ${keysJson};
let currentIdx = 0;

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Send POST to /v1/chat/completions", { status: 405 });
    }

    const body = await request.json();
    const attempts = Math.min(KEYS.length, 4);

    for (let i = 0; i < attempts; i++) {
      const key = KEYS[currentIdx % KEYS.length];
      currentIdx = (currentIdx + 1) % KEYS.length;

      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key,
        },
        body: JSON.stringify(body),
      });

      if (upstream.status === 429) {
        console.warn("Got 429 on key, failing over to next key...");
        continue; // try next key
      }

      const resBody = await upstream.text();
      return new Response(resBody, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Degen-Key-Used": "..." + key.slice(-4),
        },
      });
    }

    return new Response(JSON.stringify({ error: "All keys returned 429" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  },
};
`;
  }
}
