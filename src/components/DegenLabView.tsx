import { useState, useEffect, useMemo, useRef } from "react";
import { DegenKeyPooler, ManagedKey } from "../core/degen/DegenKeyPooler";
import {
  ZERO_AUTH_ENDPOINTS,
  ABLITERATED_PRESETS,
  calculatePromptCacheSavings,
} from "../core/degen/zeroAuthEndpoints";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  text: string;
}

export default function DegenLabView() {
  const [activeSubTab, setActiveSubTab] = useState<"pooler" | "zeroauth" | "abliterated" | "caching">("pooler");

  // Degen Key Pooler State
  const poolerRef = useRef<DegenKeyPooler | null>(null);
  if (!poolerRef.current) {
    poolerRef.current = new DegenKeyPooler([
      "AIzaSyDegenAlpha_Groq_Free_01",
      "AIzaSyDegenBeta_Studio_Free_02",
      "AIzaSyDegenGamma_Cerebras_03",
      "AIzaSyDegenDelta_OpenRouter_04",
    ], 30);
  }
  const pooler = poolerRef.current;

  const [keysList, setKeysList] = useState<ManagedKey[]>(pooler.getKeys());
  const [newKeyInput, setNewKeyInput] = useState("");
  const [newKeyAlias, setNewKeyAlias] = useState("");
  const [selectedProxyFormat, setSelectedProxyFormat] = useState<"fastapi" | "litellm" | "cloudflare">("fastapi");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPresetIdx, setCopiedPresetIdx] = useState<number | null>(null);

  // Live Terminal Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      type: "info",
      text: "⚡ Degen Anti-429 Pooler zainicjalizowany z 4 darmowymi slotami kluczy.",
    },
  ]);

  const addLog = (type: LogEntry["type"], text: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      text,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 49)]);
  };

  // Cooldown countdown tick
  useEffect(() => {
    const timer = setInterval(() => {
      pooler.refreshCooldowns();
      setKeysList(pooler.getKeys());
    }, 1000);
    return () => clearInterval(timer);
  }, [pooler]);

  // Actions
  const handleAddKey = () => {
    if (!newKeyInput.trim()) return;
    const added = pooler.addKey(newKeyInput.trim(), newKeyAlias.trim() || undefined);
    setKeysList(pooler.getKeys());
    setNewKeyInput("");
    setNewKeyAlias("");
    addLog("success", `Dodano nowy klucz do puli: ${added.alias}`);
  };

  const handleRemoveKey = (id: string, alias: string) => {
    pooler.removeKey(id);
    setKeysList(pooler.getKeys());
    addLog("warn", `Usunięto klucz z puli: ${alias}`);
  };

  const handleSendSingleRequest = () => {
    try {
      const res = pooler.acquireKey();
      pooler.reportSuccess(res.selectedKey.id);
      setKeysList(pooler.getKeys());
      addLog(
        "success",
        `[ROUTER] Request obsłużony przez ${res.selectedKey.alias} (próba: ${res.attempt}, ominiętych 429: ${res.failoversRequired})`
      );
    } catch (err: any) {
      addLog("error", `[BLOKADA] ${err.message}`);
    }
  };

  const handleSimulate429 = () => {
    try {
      const res = pooler.acquireKey();
      pooler.reportRateLimit(res.selectedKey.id, 25);
      setKeysList(pooler.getKeys());
      addLog(
        "warn",
        `[429 ALERT] Otrzymano HTTP 429 na ${res.selectedKey.alias}! Kwarantanna na 25s.`
      );

      // Now immediate failover
      try {
        const failoverRes = pooler.acquireKey();
        pooler.reportSuccess(failoverRes.selectedKey.id);
        setKeysList(pooler.getKeys());
        addLog(
          "success",
          `[FAILOVER OK] Błyskawiczne przekierowanie na ${failoverRes.selectedKey.alias} — użytkownik nie odczuł błędu!`
        );
      } catch (innerErr: any) {
        addLog("error", `[FAILOVER FAIL] ${innerErr.message}`);
      }
    } catch (err: any) {
      addLog("error", `[BLOKADA] ${err.message}`);
    }
  };

  const handleBurstStressTest = () => {
    addLog("info", "🚀 Uruchamianie Stress Testu: Burst 15 requestów...");
    let successCount = 0;
    let failoverCount = 0;

    for (let i = 1; i <= 15; i++) {
      try {
        const res = pooler.acquireKey();
        // 20% chance of random 429
        if (Math.random() < 0.25) {
          pooler.reportRateLimit(res.selectedKey.id, 20);
          failoverCount += 1;
        } else {
          pooler.reportSuccess(res.selectedKey.id);
          successCount += 1;
        }
      } catch {
        // pool exhausted
      }
    }
    setKeysList(pooler.getKeys());
    addLog(
      "success",
      `🏁 Stress Test zakończony: ${successCount} requestów OK, zneutralizowano ${failoverCount} sytuacji 429.`
    );
  };

  const handleResetPooler = () => {
    pooler.resetStats();
    setKeysList(pooler.getKeys());
    addLog("info", "Zresetowano statystyki i zdjęto wszystkie cooldowny.");
  };

  // Copy Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Preset
  const handleCopyPreset = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPresetIdx(idx);
    setTimeout(() => setCopiedPresetIdx(null), 2000);
  };

  // Prompt Caching Calculator State
  const [cachePromptTokens, setCachePromptTokens] = useState<number>(100000); // 100k
  const [cacheRequestsPerDay, setCacheRequestsPerDay] = useState<number>(50);
  const cacheCalc = useMemo(() => {
    return calculatePromptCacheSavings(0.14, 0.014, cachePromptTokens, cacheRequestsPerDay);
  }, [cachePromptTokens, cacheRequestsPerDay]);

  const poolerStats = pooler.getStats();

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-6 text-[#e3e3e3]">
      {/* Top Degen Banner */}
      <div className="bg-gradient-to-r from-red-950/40 via-amber-950/30 to-[#1e1f20] p-5 rounded-2xl border border-amber-500/30 shadow-lg relative overflow-hidden">
        <div className="absolute top-2 right-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-mono bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
            Reddit Degen Lab v2.0
          </span>
          <span className="text-[10px] font-mono text-[#8e918f] hidden sm:inline">
            Zero-Limits • Anti-429 • Uncensored
          </span>
        </div>

        <div className="max-w-3xl">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <span className="text-2xl">🔥</span>
            Degen Engineering & Anti-429 Resilience Lab
          </h2>
          <p className="text-xs sm:text-sm text-[#c4c7c5] mt-1.5 leading-relaxed">
            Prawdziwy underground LLM: nielimitowana przepustowość z rotacją darmowych kluczy,
            błyskawiczne omijanie błędu <strong>429 Too Many Requests</strong>, indeks endpointów bez autoryzacji ($0 No-Key) oraz radar modeli <strong>Abliterated / Zero-Refusal</strong>.
          </p>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-[#3c4043]/50 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab("pooler")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeSubTab === "pooler"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-[#282a2c] text-[#c4c7c5] hover:text-white hover:bg-[#37393b]"
            }`}
          >
            🛡️ Multi-Key Anti-429 Pooler
          </button>
          <button
            onClick={() => setActiveSubTab("zeroauth")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeSubTab === "zeroauth"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-[#282a2c] text-[#c4c7c5] hover:text-white hover:bg-[#37393b]"
            }`}
          >
            🌐 Zero-Auth Endpoints ($0 Bez Klucza)
          </button>
          <button
            onClick={() => setActiveSubTab("abliterated")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeSubTab === "abliterated"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-[#282a2c] text-[#c4c7c5] hover:text-white hover:bg-[#37393b]"
            }`}
          >
            ⚔️ Radar Abliterated / Zero-Refusal
          </button>
          <button
            onClick={() => setActiveSubTab("caching")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeSubTab === "caching"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-[#282a2c] text-[#c4c7c5] hover:text-white hover:bg-[#37393b]"
            }`}
          >
            💰 Prompt Caching Arbitrage (-90%)
          </button>
        </div>
      </div>

      {/* SUBTAB 1: MULTI-KEY POOLER & LIVE SIMULATOR */}
      {activeSubTab === "pooler" && (
        <div className="space-y-6">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#1e1f20] p-3.5 rounded-xl border border-[#282a2c]">
              <div className="text-[11px] text-[#8e918f]">Zdrowe Klucze (Ready)</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                {poolerStats.healthyKeys} / {poolerStats.totalKeys}
              </div>
            </div>
            <div className="bg-[#1e1f20] p-3.5 rounded-xl border border-[#282a2c]">
              <div className="text-[11px] text-[#8e918f]">Kwarantanna (429 Cooldown)</div>
              <div className="text-xl font-bold text-amber-400 mt-0.5">
                {poolerStats.cooldownKeys}
              </div>
            </div>
            <div className="bg-[#1e1f20] p-3.5 rounded-xl border border-[#282a2c]">
              <div className="text-[11px] text-[#8e918f]">Zroutowane Zapytania</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {poolerStats.totalRouted}
              </div>
            </div>
            <div className="bg-[#1e1f20] p-3.5 rounded-xl border border-[#282a2c]">
              <div className="text-[11px] text-[#8e918f]">Uratowane Failovery (Zero 429)</div>
              <div className="text-xl font-bold text-[#a8c7fa] mt-0.5">
                {poolerStats.totalFailovers}
              </div>
            </div>
          </div>

          {/* Interactive Key Slots Grid */}
          <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚡</span> Aktywna Pula Kluczy (Rotator)
                </h3>
                <p className="text-xs text-[#8e918f]">
                  Każdy klucz działa w izolacji. W przypadku 429 natychmiast wpada w kwarantannę, a ruch przejmuje kolejny slot.
                </p>
              </div>

              {/* Action Simulation Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSendSingleRequest}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all shadow-sm"
                >
                  ▶ Wyślij Request
                </button>
                <button
                  onClick={handleSimulate429}
                  className="px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 text-xs font-semibold transition-all shadow-sm"
                >
                  ⚠️ Symuluj 429
                </button>
                <button
                  onClick={handleBurstStressTest}
                  className="px-3 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all shadow-sm"
                >
                  💥 Burst 15
                </button>
                <button
                  onClick={handleResetPooler}
                  className="px-2.5 py-1.5 rounded-xl bg-[#282a2c] hover:bg-[#37393b] text-[#8e918f] hover:text-white text-xs border border-[#3c4043] transition-all"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Keys Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {keysList.map((k) => {
                const now = Date.now();
                const isCooldown = k.status === "cooldown" && k.cooldownUntil && k.cooldownUntil > now;
                const remainingSec = isCooldown ? Math.ceil((k.cooldownUntil! - now) / 1000) : 0;

                return (
                  <div
                    key={k.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCooldown
                        ? "bg-red-950/20 border-red-500/50 shadow-inner"
                        : "bg-[#131314] border-[#282a2c] hover:border-[#3c4043]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white truncate max-w-[140px]">
                        {k.alias}
                      </span>
                      <button
                        onClick={() => handleRemoveKey(k.id, k.alias)}
                        className="text-[#8e918f] hover:text-red-400 text-xs leading-none"
                        title="Usuń z puli"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="font-mono text-[11px] text-[#8e918f] mt-1 truncate">
                      ...{k.key.slice(-10)}
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#282a2c] flex items-center justify-between text-xs">
                      <div>
                        {isCooldown ? (
                          <span className="inline-flex items-center gap-1 text-red-400 font-mono text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                            429 ({remainingSec}s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Gotowy
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#c4c7c5]">
                        Req: <span className="text-white font-bold">{k.totalRequests}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Key Input */}
            <div className="bg-[#131314] p-3 rounded-xl border border-[#282a2c] flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Alias (np. Groq_Account_3)"
                value={newKeyAlias}
                onChange={(e) => setNewKeyAlias(e.target.value)}
                className="sm:w-1/4 bg-[#1e1f20] border border-[#3c4043] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-amber-400"
              />
              <input
                type="text"
                placeholder="Wklej API Key (np. gsk_..., AIzaSy..., sk-or-...)"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                className="flex-1 bg-[#1e1f20] border border-[#3c4043] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                onClick={handleAddKey}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
              >
                + Dodaj do Puli
              </button>
            </div>
          </div>

          {/* Realtime Terminal Log & Code Exporter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Live Terminal Log */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c] flex flex-col h-[320px]">
              <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]">
                <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Live Router Event Log
                </span>
                <span className="text-[10px] font-mono text-[#8e918f]">Auto-Failover Active</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 mt-2 font-mono text-[11px] pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="leading-tight">
                    <span className="text-[#8e918f]">[{log.timestamp}]</span>{" "}
                    <span
                      className={
                        log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "warn"
                          ? "text-amber-400"
                          : log.type === "error"
                          ? "text-red-400 font-semibold"
                          : "text-[#a8c7fa]"
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Production Code Generator */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c] flex flex-col h-[320px]">
              <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]">
                <span className="text-xs font-semibold text-white">Eksportuj Gotowy Proxy Anti-429</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSelectedProxyFormat("fastapi")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      selectedProxyFormat === "fastapi" ? "bg-amber-400 text-black font-bold" : "text-[#8e918f] hover:text-white"
                    }`}
                  >
                    Python FastAPI
                  </button>
                  <button
                    onClick={() => setSelectedProxyFormat("litellm")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      selectedProxyFormat === "litellm" ? "bg-amber-400 text-black font-bold" : "text-[#8e918f] hover:text-white"
                    }`}
                  >
                    LiteLLM YAML
                  </button>
                  <button
                    onClick={() => setSelectedProxyFormat("cloudflare")}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      selectedProxyFormat === "cloudflare" ? "bg-amber-400 text-black font-bold" : "text-[#8e918f] hover:text-white"
                    }`}
                  >
                    Cloudflare Worker
                  </button>
                </div>
              </div>

              <div className="relative flex-1 mt-2 overflow-hidden rounded-xl bg-[#131314] border border-[#282a2c]">
                <pre className="h-full overflow-y-auto p-3 text-[11px] font-mono text-[#c4c7c5]">
                  {selectedProxyFormat === "fastapi" && pooler.generatePythonFastApiProxy()}
                  {selectedProxyFormat === "litellm" && pooler.generateLiteLLMConfig()}
                  {selectedProxyFormat === "cloudflare" && pooler.generateCloudflareWorker()}
                </pre>
                <button
                  onClick={() => {
                    const code =
                      selectedProxyFormat === "fastapi"
                        ? pooler.generatePythonFastApiProxy()
                        : selectedProxyFormat === "litellm"
                        ? pooler.generateLiteLLMConfig()
                        : pooler.generateCloudflareWorker();
                    handleCopyCode(code);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-[#282a2c] hover:bg-[#37393b] border border-[#3c4043] text-xs rounded-lg text-white font-medium transition-all shadow"
                >
                  {copiedCode ? "✓ Skopiowano!" : "Kopiuj kod"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ZERO-AUTH ENDPOINTS */}
      {activeSubTab === "zeroauth" && (
        <div className="space-y-4">
          <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
            <h3 className="text-base font-semibold text-white">
              Publiczne Endpointy Zero-Auth ($0 Bez Wymaganego Klucza)
            </h3>
            <p className="text-xs text-[#8e918f] mt-1">
              Sprawdzone przez społeczność r/LocalLLaMA endpointy umożliwiające wywoływanie LLM bez podawania karty kredytowej ani generowania kluczy API.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ZERO_AUTH_ENDPOINTS.map((endpoint) => (
              <div
                key={endpoint.id}
                className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] flex flex-col justify-between space-y-3 hover:border-[#3c4043] transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{endpoint.name}</span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Zero-Key Auth
                    </span>
                  </div>

                  <p className="text-xs text-[#c4c7c5] leading-relaxed">{endpoint.notes}</p>

                  <div className="text-xs space-y-1 text-[#8e918f] pt-1">
                    <div>
                      <strong className="text-white">Dostępne modele:</strong>{" "}
                      <span className="font-mono text-[#a8c7fa]">{endpoint.primaryModels.join(", ")}</span>
                    </div>
                    <div>
                      <strong className="text-white">Limity:</strong> {endpoint.rateLimitNote}
                    </div>
                  </div>
                </div>

                <div className="bg-[#131314] p-3 rounded-xl border border-[#282a2c] space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-[#8e918f]">
                    <span className="font-mono">Gotowy cURL / Snippet:</span>
                    <button
                      onClick={() => handleCopyCode(endpoint.snippetJs)}
                      className="text-amber-400 hover:underline"
                    >
                      Kopiuj JS
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre-wrap max-h-24">
                    {endpoint.snippetJs}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: ABLITERATED & ZERO-REFUSAL RADAR */}
      {activeSubTab === "abliterated" && (
        <div className="space-y-4">
          <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
            <h3 className="text-base font-semibold text-white">
              Radar Modeli Abliterated & No-Refusal (Zero Moralizowania)
            </h3>
            <p className="text-xs text-[#8e918f] mt-1">
              Dla degenów kodowania i badaczy bezpieczeństwa: modele, które nie odmawiają wykonania surowych poleceń, nie rzucają wykładów etycznych i nie obcinają długich fragmentów kodu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ABLITERATED_PRESETS.map((preset, idx) => (
              <div
                key={preset.slug}
                className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{preset.name}</span>
                    <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-lg">
                      {preset.refusalScore}% No-Refusal
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {preset.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono bg-[#282a2c] text-[#8e918f] px-1.5 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-[#c4c7c5]">{preset.degenComment}</p>
                </div>

                <div className="bg-[#131314] p-3 rounded-xl border border-[#282a2c] space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-[#8e918f]">
                    <span className="font-semibold text-white">System Prompt Preset:</span>
                    <button
                      onClick={() => handleCopyPreset(preset.recommendedSystemPrompt, idx)}
                      className="text-amber-400 hover:underline text-xs"
                    >
                      {copiedPresetIdx === idx ? "✓ Skopiowano" : "Kopiuj Prompt"}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-[#a8c7fa] italic leading-tight">
                    "{preset.recommendedSystemPrompt}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: PROMPT CACHING LOOPHOLE */}
      {activeSubTab === "caching" && (
        <div className="space-y-4">
          <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Kalkulator Prompt Caching Loophole (Zniżka 90% na Dużym Kontekście)
              </h3>
              <p className="text-xs text-[#8e918f] mt-1">
                W modelach DeepSeek, Gemini i Anthropic pierwsze zapytanie ładuje bazowy kontekst (np. całe repozytorium 100k tokenów),
                a wszystkie kolejne zapytania korzystają z pamięci podręcznej ze zniżką rzędu 90% lub darmowym czytaniem cache.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#c4c7c5] block mb-1">
                    Rozmiar cachowanego kontekstu (np. kod projektu):{" "}
                    <span className="font-mono text-amber-400">
                      {(cachePromptTokens / 1000).toFixed(0)}k tokenów
                    </span>
                  </label>
                  <input
                    type="range"
                    min={10000}
                    max={1000000}
                    step={10000}
                    value={cachePromptTokens}
                    onChange={(e) => setCachePromptTokens(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-[#8e918f] mt-1 font-mono">
                    <span>10k</span>
                    <span>250k</span>
                    <span>500k</span>
                    <span>1M</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#c4c7c5] block mb-1">
                    Liczba zapytań dziennie o ten sam kontekst:{" "}
                    <span className="font-mono text-amber-400">{cacheRequestsPerDay} zapytania/dzień</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={300}
                    step={5}
                    value={cacheRequestsPerDay}
                    onChange={(e) => setCacheRequestsPerDay(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              <div className="bg-[#131314] p-4 rounded-xl border border-[#282a2c] flex flex-col justify-between space-y-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Koszt bez Caching Loophole:</span>
                    <span className="font-mono text-red-400">
                      ${cacheCalc.dailyUncachedCost.toFixed(3)} / dzień (${(cacheCalc.dailyUncachedCost * 30).toFixed(2)}/mc)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Koszt z DeepSeek/Gemini Cache:</span>
                    <span className="font-mono text-emerald-400">
                      ${cacheCalc.dailyCachedCost.toFixed(3)} / dzień (${(cacheCalc.dailyCachedCost * 30).toFixed(2)}/mc)
                    </span>
                  </div>
                  <div className="border-t border-[#282a2c] pt-2 flex justify-between font-semibold text-sm">
                    <span className="text-white">Oszczędność w kieszeni:</span>
                    <span className="font-mono text-emerald-400">
                      +${cacheCalc.monthlySavings.toFixed(2)} / mc (-{cacheCalc.discountPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                  💡 <strong>Tip degena:</strong> Utrzymuj wspólny System Prompt jako pierwszy blok wiadomości w sesji – API automatycznie utrzyma go w cache przez 5–60 minut.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
