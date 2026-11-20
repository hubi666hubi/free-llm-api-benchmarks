import { useState, useEffect, useMemo, useRef } from "react";
import GeminiChatView, { ChatMessage } from "./components/GeminiChatView";
import DegenLabView from "./components/DegenLabView";
import { defaultCatalog } from "./data/catalog";
import { BenchmarkAssistantAgent } from "./core/chat/BenchmarkAssistantAgent";
import { createBenchmarkContainer } from "./adapters/bootstrap";
import { LocalStorageSettingsStore } from "./adapters/LocalStorageSettingsStore";
import { OllamaSettingsRepository } from "./core/settings/OllamaSettings";
import { TOKENS } from "./core/di/tokens";
import { LLMModel } from "./core/models/LLMModel";
import { ModelComparison } from "./core/catalog/BenchmarkCatalog";
import {
  LocalModelInfo,
  ProviderHealth,
  RECOMMENDED_HEXAGONAL_OLLAMA_MODELS,
} from "./core/chat/LLMProvider";

export function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "catalog" | "arbitrage" | "providers" | "degen">("chat");

  // Benchmark Agent instance (singleton per app life)
  const agentRef = useRef<BenchmarkAssistantAgent | null>(null);
  if (!agentRef.current) {
    agentRef.current = createBenchmarkContainer({ catalog: defaultCatalog }).resolve<BenchmarkAssistantAgent>(TOKENS.BenchmarkAgent);
  }
  const agent = agentRef.current;

  // Persisted Ollama settings (port: ISettingsStore, adapter: localStorage)
  const settingsRepoRef = useRef<OllamaSettingsRepository | null>(null);
  const savedOllamaRef = useRef<ReturnType<OllamaSettingsRepository["load"]> | null>(null);
  if (!settingsRepoRef.current) {
    settingsRepoRef.current = new OllamaSettingsRepository(new LocalStorageSettingsStore());
    savedOllamaRef.current = settingsRepoRef.current.load();
    if (savedOllamaRef.current.enabled) {
      agentRef.current.configureOllama({
        baseUrl: savedOllamaRef.current.baseUrl,
        model: savedOllamaRef.current.model,
        numCtx: savedOllamaRef.current.numCtx,
        enabled: true,
      });
    }
  }
  const savedOllama = savedOllamaRef.current!;

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(agent.session.messages);
  const [isLoading, setIsLoading] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [ollamaEnabled, setOllamaEnabled] = useState(savedOllama.enabled);
  const [ollamaUrl, setOllamaUrl] = useState(savedOllama.baseUrl);
  const [ollamaModel, setOllamaModel] = useState(savedOllama.model);
  const [ollamaNumCtx, setOllamaNumCtx] = useState(savedOllama.numCtx);
  const [ollamaHealth, setOllamaHealth] = useState<ProviderHealth | null>(null);
  const [ollamaLocalModels, setOllamaLocalModels] = useState<LocalModelInfo[]>([]);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [, setProviderTick] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleProbeOllama = async () => {
    setIsCheckingOllama(true);
    try {
      agent.configureOllama({
        baseUrl: ollamaUrl,
        model: ollamaModel,
        numCtx: ollamaNumCtx,
        enabled: ollamaEnabled,
      });
      const health = await agent.checkOllamaHealth();
      setOllamaHealth(health);
      if (health.ok) {
        const models = await agent.listOllamaModels();
        setOllamaLocalModels(models);
        if (models.length > 0 && !models.some((m) => m.name === ollamaModel)) {
          setOllamaModel(models[0].name);
        }
      }
    } finally {
      setIsCheckingOllama(false);
    }
  };

  // Modals state
  const [snippetModel, setSnippetModel] = useState<LLMModel | null>(null);
  const [snippetLang, setSnippetLang] = useState<"python" | "typescript" | "curl">("python");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Comparison Modal state
  const [compareModelA, setCompareModelA] = useState<LLMModel | null>(null);
  const [compareModelB, setCompareModelB] = useState<LLMModel | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Subscribe to session changes
  useEffect(() => {
    const unsubscribe = agent.session.subscribe((updatedMessages) => {
      setMessages(updatedMessages);
    });
    return unsubscribe;
  }, [agent]);

  // Catalog Explorer State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [filterMillionPlus, setFilterMillionPlus] = useState(false);
  const [filterTools, setFilterTools] = useState(false);
  const [filterReasoning, setFilterReasoning] = useState(false);
  const [filterParetoOnly, setFilterParetoOnly] = useState(false);

  // Arbitrage Calculator State
  const [monthlyTokens, setMonthlyTokens] = useState<number>(10); // in millions
  const [selectedModelSlug, setSelectedModelSlug] = useState<string>("kyma/glm-5.3-flash");

  // Compute Pareto Frontier once
  const paretoFrontier = useMemo(() => defaultCatalog.getParetoFrontier(), []);
  const paretoSlugs = useMemo(() => new Set(paretoFrontier.map((m) => m.slug)), [paretoFrontier]);

  // Send message handler
  const handleSendMessage = async (text: string) => {
    setIsLoading(true);
    try {
      await agent.ask(text);
    } finally {
      setIsLoading(false);
    }
  };

  // Ask about a specific model from catalog
  const handleAskAboutModel = (model: LLMModel) => {
    setActiveTab("chat");
    handleSendMessage(`Opowiedz mi szczegółowo o modelu ${model.toolName} od ${model.provider} (slug: ${model.slug}). Jaki ma kontekst, koszty i możliwości?`);
  };

  // Open comparison modal
  const handleOpenComparison = (model: LLMModel) => {
    const defaultCompetitor =
      model.slug === "google/gemini-exp-1206"
        ? defaultCatalog.findBySlug("kyma/glm-5.3-flash") || defaultCatalog.models[1]
        : defaultCatalog.findBySlug("google/gemini-exp-1206") || defaultCatalog.models[0];

    setCompareModelA(model);
    setCompareModelB(defaultCompetitor);
    setShowCompareModal(true);
  };

  // Filtered models for catalog tab
  const filteredModels = useMemo(() => {
    return defaultCatalog
      .filter({
        provider: selectedProvider || undefined,
        minContext: filterMillionPlus ? 1_000_000 : 0,
        requireTools: filterTools,
        requireReasoning: filterReasoning,
      })
      .filter((m) => {
        if (filterParetoOnly && !paretoSlugs.has(m.slug)) return false;
        return m.matchesQuery(searchQuery);
      });
  }, [searchQuery, selectedProvider, filterMillionPlus, filterTools, filterReasoning, filterParetoOnly, paretoSlugs]);

  // Providers list for filter dropdown
  const providers = useMemo(() => defaultCatalog.getProviders(), []);

  // Provider Summaries for Provider View
  const providerSummaries = useMemo(() => {
    return providers.map((p) => defaultCatalog.getProviderSummary(p)!).filter(Boolean);
  }, [providers]);

  // Selected model for calculator
  const calcModel = useMemo(() => {
    return defaultCatalog.findBySlug(selectedModelSlug) || defaultCatalog.models[0];
  }, [selectedModelSlug]);

  // Arbitrage calculations
  const baselineCost = monthlyTokens * 3.0; // $3.00/1M standard SaaS
  const targetCost = monthlyTokens * (calcModel ? calcModel.blendedCostPer1M : 0);
  const netSavings = baselineCost - targetCost;
  const savingsPct = baselineCost > 0 ? ((netSavings / baselineCost) * 100).toFixed(1) : "0";

  // Comparison result
  const comparisonResult: ModelComparison | null = useMemo(() => {
    if (!compareModelA || !compareModelB) return null;
    return defaultCatalog.compareModels(compareModelA, compareModelB);
  }, [compareModelA, compareModelB]);

  // Copy snippet
  const handleCopySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  // Export conversation
  const handleExportChat = () => {
    const mdContent = agent.session.messages
      .map((m) => `### ${m.role === "user" ? "Użytkownik" : "Asystent"}\n\n${m.content}\n\n---`)
      .join("\n\n");
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `konwersacja-llm-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick prompt suggestions
  const quickPrompts = [
    "Który model ma największy kontekst?",
    "Pokaż najtańsze modele z obsługą Tool Calling",
    "Jak działa arbitraż cenowy Open-Weights vs SaaS?",
    "Pokaż modele na Pareto Frontier",
    "Wyszukaj modele DeepSeek",
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131314] text-[#e3e3e3] overflow-hidden">
      {/* Global Top Header Bar */}
      <header className="h-14 border-b border-[#282a2c] bg-[#1e1f20] px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1a73e8] to-[#a8c7fa] flex items-center justify-center font-bold text-black text-sm shadow-md">
            LLM
          </div>
          <div>
            <h1 className="font-semibold text-sm sm:text-base leading-tight text-white flex items-center gap-2">
              Free LLM API Benchmarks
              <span className="text-[10px] bg-gradient-to-r from-amber-500/20 to-amber-300/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-medium">
                Maxi Maxi Pro
              </span>
            </h1>
            <p className="text-[11px] text-[#8e918f] hidden sm:block">
              100 Top-Tier Modeli • Asystent Gemini • Pareto Frontier • Generator Kodu
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 bg-[#131314] p-1 rounded-xl border border-[#282a2c]">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "chat"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-[#c4c7c5] hover:text-white hover:bg-[#1e1f20]"
            }`}
          >
            Czat Gemini
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "catalog"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-[#c4c7c5] hover:text-white hover:bg-[#1e1f20]"
            }`}
          >
            Katalog ({filteredModels.length})
          </button>
          <button
            onClick={() => setActiveTab("arbitrage")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "arbitrage"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-[#c4c7c5] hover:text-white hover:bg-[#1e1f20]"
            }`}
          >
            Arbitraż & ROI
          </button>
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "providers"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-[#c4c7c5] hover:text-white hover:bg-[#1e1f20]"
            }`}
          >
            Dostawcy ({providers.length})
          </button>
          <button
            onClick={() => setActiveTab("degen")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              activeTab === "degen"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/20"
                : "text-amber-400 hover:text-amber-300 hover:bg-[#1e1f20]"
            }`}
          >
            <span>🔥</span> Degen Lab
          </button>
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {activeTab === "chat" && (
            <button
              onClick={handleExportChat}
              title="Eksportuj konwersację do Markdown"
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg border border-[#3c4043] bg-[#282a2c] hover:bg-[#37393b] text-xs text-[#c4c7c5] hover:text-white transition-colors"
            >
              Eksportuj .md
            </button>
          )}

          <button
            onClick={() => setShowSettingsModal(true)}
            title="Ustawienia Providera AI"
            className="px-2.5 py-1.5 rounded-lg border border-[#3c4043] bg-[#282a2c] hover:bg-[#37393b] text-xs text-[#e3e3e3] flex items-center gap-1.5 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="hidden sm:inline">Silnik:</span>
            <span className="font-mono text-[#a8c7fa]">
              {agent.client.getActiveProviderName().split(" ")[0]}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {/* TAB 1: GEMINI CHAT VIEW */}
        {activeTab === "chat" && (
          <div className="h-full w-full flex flex-col justify-between">
            {/* Quick Prompts Bar */}
            <div className="bg-[#1e1f20]/60 border-b border-[#282a2c] px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
              <span className="text-xs text-[#8e918f] shrink-0 font-medium">Szybkie zapytania:</span>
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-[#282a2c] hover:bg-[#37393b] text-[#c4c7c5] hover:text-white border border-[#3c4043] transition-all disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat View Component */}
            <div className="flex-1 overflow-hidden">
              <GeminiChatView
                title="Antigravity Gemini AI • Intelligence Oracle Maxi Pro"
                messages={messages}
                isLoading={isLoading}
                placeholder="Zadaj pytanie o modele LLM, okno 1M+, najtańsze API, arbitraż lub kod..."
                onSendMessage={handleSendMessage}
                onMenuClick={() => setActiveTab("catalog")}
                onClose={() => agent.reset()}
              />
            </div>
          </div>
        )}

        {/* TAB 2: CATALOG EXPLORER */}
        {activeTab === "catalog" && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Filter Bar */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Szukaj po nazwie, slugu lub dostawcy..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#131314] border border-[#3c4043] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#8e918f] focus:outline-none focus:border-[#a8c7fa]"
                />

                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="bg-[#131314] border border-[#3c4043] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#a8c7fa]"
                >
                  <option value="">Wszyscy dostawcy ({providers.length})</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-3 text-xs font-medium col-span-2 flex-wrap">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#c4c7c5]">
                    <input
                      type="checkbox"
                      checked={filterMillionPlus}
                      onChange={(e) => setFilterMillionPlus(e.target.checked)}
                      className="rounded bg-[#131314] border-[#3c4043] text-[#1a73e8]"
                    />
                    1M+ Kontekst
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#c4c7c5]">
                    <input
                      type="checkbox"
                      checked={filterTools}
                      onChange={(e) => setFilterTools(e.target.checked)}
                      className="rounded bg-[#131314] border-[#3c4043] text-[#1a73e8]"
                    />
                    Tool Calling
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#c4c7c5]">
                    <input
                      type="checkbox"
                      checked={filterReasoning}
                      onChange={(e) => setFilterReasoning(e.target.checked)}
                      className="rounded bg-[#131314] border-[#3c4043] text-[#1a73e8]"
                    />
                    Reasoning
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-amber-300 font-semibold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30">
                    <input
                      type="checkbox"
                      checked={filterParetoOnly}
                      onChange={(e) => setFilterParetoOnly(e.target.checked)}
                      className="rounded bg-[#131314] border-amber-400 text-amber-400"
                    />
                    ⭐ Tylko Pareto
                  </label>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="bg-[#1e1f20] rounded-2xl border border-[#282a2c] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#282a2c]/80 text-[#8e918f] uppercase text-[11px] font-semibold border-b border-[#3c4043]">
                    <tr>
                      <th className="py-3 px-4">Model & Dostawca</th>
                      <th className="py-3 px-4">Kontekst</th>
                      <th className="py-3 px-4">Koszt Blended / 1M</th>
                      <th className="py-3 px-4 text-center">Narzędzia</th>
                      <th className="py-3 px-4 text-center">Reasoning</th>
                      <th className="py-3 px-4">Wdrożenie</th>
                      <th className="py-3 px-4 text-right">Akcje Maxi Pro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#282a2c]">
                    {filteredModels.map((model) => {
                      const isPareto = paretoSlugs.has(model.slug);
                      return (
                        <tr key={model.slug} className="hover:bg-[#282a2c]/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{model.toolName}</span>
                              {isPareto && (
                                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-mono">
                                  ⭐ Pareto
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-[#8e918f]">{model.slug}</div>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {model.contextWindowTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-mono text-emerald-400">
                            {model.blendedCostPer1M === 0 ? "Darmowy ($0.00)" : `$${model.blendedCostPer1M.toFixed(4)}`}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {model.supportsToolCall ? (
                              <span className="text-emerald-400 font-bold">✓</span>
                            ) : (
                              <span className="text-[#5e6166]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {model.supportsReasoning ? (
                              <span className="text-emerald-400 font-bold">✓</span>
                            ) : (
                              <span className="text-[#5e6166]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#c4c7c5] text-xs">
                            {model.deploymentType}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSnippetModel(model)}
                              title="Wygeneruj kod API"
                              className="px-2 py-1 rounded-lg bg-[#282a2c] hover:bg-[#37393b] text-[#c4c7c5] hover:text-white font-mono text-xs border border-[#3c4043] transition-all"
                            >
                              &lt;/&gt; Kod
                            </button>
                            <button
                              onClick={() => handleOpenComparison(model)}
                              title="Porównaj z innym modelem"
                              className="px-2 py-1 rounded-lg bg-[#282a2c] hover:bg-[#37393b] text-[#a8c7fa] hover:text-white text-xs border border-[#3c4043] transition-all"
                            >
                              Porównaj
                            </button>
                            <button
                              onClick={() => handleAskAboutModel(model)}
                              title="Zadaj pytanie asystentowi"
                              className="px-2.5 py-1 rounded-lg bg-[#0b57d0]/30 text-[#7cacf8] hover:bg-[#0b57d0]/50 font-medium text-xs transition-all"
                            >
                              Czat
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ARBITRAGE & ANALYTICS */}
        {activeTab === "arbitrage" && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
                <div className="text-xs text-[#8e918f]">Zindeksowane Modele (Katalog)</div>
                <div className="text-2xl font-bold text-white mt-1">11,381</div>
                <div className="text-xs text-emerald-400 mt-1">359 zweryfikowanych dostawców</div>
              </div>
              <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
                <div className="text-xs text-[#8e918f]">Top Free-Tier w Repo</div>
                <div className="text-2xl font-bold text-[#a8c7fa] mt-1">100 Modeli</div>
                <div className="text-xs text-[#8e918f] mt-1">100% z oknem do 2M tokenów</div>
              </div>
              <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
                <div className="text-xs text-[#8e918f]">Mediana Arbitrażu Kosztowego</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">82.5% Oszczędności</div>
                <div className="text-xs text-[#8e918f] mt-1">$0.525 vs $3.000 / 1M tokenów</div>
              </div>
              <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
                <div className="text-xs text-[#8e918f]">Maksymalny Kontekst</div>
                <div className="text-2xl font-bold text-purple-400 mt-1">2,097,152</div>
                <div className="text-xs text-[#8e918f] mt-1">gemini-exp-1206 & auto router</div>
              </div>
            </div>

            {/* Interactive ROI & Monthly Savings Calculator */}
            <div className="bg-[#1e1f20] p-6 rounded-2xl border border-[#282a2c] space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Kalkulator Oszczędności Arbitrażowych (ROI) Maxi Pro
                </h3>
                <p className="text-xs text-[#8e918f]">
                  Porównaj miesięczny koszt wybranego modelu z bazy z rynkowym standardem Proprietary SaaS ($3.00 / 1M tokenów).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#c4c7c5] font-medium block mb-1">
                      Miesięczny wolumen tokenów: <span className="font-mono text-[#a8c7fa]">{monthlyTokens}M tokenów</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={monthlyTokens}
                      onChange={(e) => setMonthlyTokens(Number(e.target.value))}
                      className="w-full accent-[#1a73e8]"
                    />
                    <div className="flex justify-between text-[10px] text-[#8e918f] mt-1">
                      <span>1M</span>
                      <span>25M</span>
                      <span>50M</span>
                      <span>75M</span>
                      <span>100M</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#c4c7c5] font-medium block mb-1">
                      Wybierz model do porównania:
                    </label>
                    <select
                      value={selectedModelSlug}
                      onChange={(e) => setSelectedModelSlug(e.target.value)}
                      className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#a8c7fa]"
                    >
                      {defaultCatalog.models.map((m) => (
                        <option key={m.slug} value={m.slug}>
                          {m.toolName} ({m.provider}) — ${m.blendedCostPer1M.toFixed(4)}/1M
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-[#131314] p-5 rounded-xl border border-[#282a2c] flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8e918f]">Standardowy koszt SaaS ($3.00/1M):</span>
                      <span className="font-mono text-red-400">${baselineCost.toFixed(2)} / mc</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8e918f]">Koszt modelu ({calcModel?.toolName}):</span>
                      <span className="font-mono text-emerald-400">${targetCost.toFixed(2)} / mc</span>
                    </div>
                    <div className="border-t border-[#282a2c] pt-2 flex justify-between text-sm font-semibold">
                      <span className="text-white">Oszczędność netto w kieszeni:</span>
                      <span className="font-mono text-emerald-400">
                        +${netSavings.toFixed(2)} ({savingsPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button
                      onClick={() => setSnippetModel(calcModel)}
                      className="flex-1 py-2 bg-[#282a2c] hover:bg-[#37393b] text-[#e3e3e3] border border-[#3c4043] rounded-xl text-xs font-medium transition-colors"
                    >
                      Pobierz kod API
                    </button>
                    <button
                      onClick={() => handleAskAboutModel(calcModel)}
                      className="flex-1 py-2 bg-[#1a73e8] hover:bg-[#1b66ca] text-white rounded-xl text-xs font-medium transition-colors"
                    >
                      Czat o tym modelu
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROVIDERS INTELLIGENCE */}
        {activeTab === "providers" && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c]">
              <h2 className="text-base font-semibold text-white">Przegląd Dostawców AI ({providers.length})</h2>
              <p className="text-xs text-[#8e918f] mt-1">
                Zestawienie providerów zindeksowanych w repozytorium wraz ze statystykami cenowymi, maksymalnym oknem i endpointami optymalnymi Pareto.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providerSummaries.map((summary) => (
                <div
                  key={summary.provider}
                  className="bg-[#1e1f20] p-4 rounded-2xl border border-[#282a2c] flex flex-col justify-between hover:border-[#444746] transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-sm uppercase bg-[#282a2c] px-2 py-0.5 rounded-lg border border-[#3c4043]">
                        {summary.provider}
                      </span>
                      <span className="text-xs text-[#a8c7fa] font-mono">
                        {summary.modelCount} {summary.modelCount === 1 ? "model" : "modele"}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-[#c4c7c5] pt-1">
                      <div className="flex justify-between">
                        <span className="text-[#8e918f]">Maks. kontekst:</span>
                        <span className="font-mono text-white">{summary.maxContextWindowTokens.toLocaleString()} tok.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8e918f]">Śr. koszt blended:</span>
                        <span className="font-mono text-emerald-400">
                          {summary.avgBlendedCostPer1M === 0 ? "Darmowy ($0.00)" : `$${summary.avgBlendedCostPer1M.toFixed(4)}/1M`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8e918f]">Tool Calling / Reasoning:</span>
                        <span className="text-white">{summary.toolCallCount} / {summary.reasoningCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#282a2c] mt-3 flex justify-between items-center">
                    <span className="text-[11px] text-[#8e918f] font-mono truncate max-w-[160px]" title={summary.bestValueSlug}>
                      Best: {summary.bestValueSlug.split("/")[1] || summary.bestValueSlug}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedProvider(summary.provider);
                        setActiveTab("catalog");
                      }}
                      className="text-xs text-[#a8c7fa] hover:underline"
                    >
                      Pokaż modele →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: DEGEN LAB */}
        {activeTab === "degen" && <DegenLabView />}
      </main>

      {/* CODE SNIPPET MODAL */}
      {snippetModel && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base flex items-center gap-2">
                  Generator Kodu API: {snippetModel.toolName}
                </h3>
                <p className="text-xs font-mono text-[#8e918f]">{snippetModel.slug}</p>
              </div>
              <button
                onClick={() => setSnippetModel(null)}
                className="text-[#8e918f] hover:text-white text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Language Tabs */}
            <div className="flex gap-2 border-b border-[#282a2c] pb-2">
              <button
                onClick={() => setSnippetLang("python")}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  snippetLang === "python" ? "bg-[#a8c7fa] text-black font-semibold" : "text-[#c4c7c5] hover:text-white"
                }`}
              >
                Python (OpenAI / LiteLLM)
              </button>
              <button
                onClick={() => setSnippetLang("typescript")}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  snippetLang === "typescript" ? "bg-[#a8c7fa] text-black font-semibold" : "text-[#c4c7c5] hover:text-white"
                }`}
              >
                TypeScript (Fetch)
              </button>
              <button
                onClick={() => setSnippetLang("curl")}
                className={`px-3 py-1 rounded-lg text-xs font-mono ${
                  snippetLang === "curl" ? "bg-[#a8c7fa] text-black font-semibold" : "text-[#c4c7c5] hover:text-white"
                }`}
              >
                cURL (Bash)
              </button>
            </div>

            {/* Code Box */}
            <div className="relative">
              <pre className="bg-[#131314] p-4 rounded-xl border border-[#282a2c] text-xs font-mono text-[#e3e3e3] overflow-x-auto max-h-[300px]">
                {snippetLang === "python" && snippetModel.generatePythonSnippet(geminiApiKey || "YOUR_API_KEY")}
                {snippetLang === "typescript" && snippetModel.generateTypeScriptSnippet(geminiApiKey || "YOUR_API_KEY")}
                {snippetLang === "curl" && snippetModel.generateCurlSnippet(geminiApiKey || "YOUR_API_KEY")}
              </pre>
              <button
                onClick={() => {
                  const code =
                    snippetLang === "python"
                      ? snippetModel.generatePythonSnippet(geminiApiKey || "YOUR_API_KEY")
                      : snippetLang === "typescript"
                      ? snippetModel.generateTypeScriptSnippet(geminiApiKey || "YOUR_API_KEY")
                      : snippetModel.generateCurlSnippet(geminiApiKey || "YOUR_API_KEY");
                  handleCopySnippet(code);
                }}
                className="absolute top-2 right-2 px-2.5 py-1 bg-[#282a2c] hover:bg-[#37393b] border border-[#3c4043] text-xs rounded-lg text-[#e3e3e3] transition-colors"
              >
                {copiedSnippet ? "✓ Skopiowano!" : "Kopiuj kod"}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSnippetModel(null)}
                className="px-4 py-1.5 bg-[#282a2c] hover:bg-[#37393b] text-white text-xs rounded-xl"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON MODAL */}
      {showCompareModal && compareModelA && compareModelB && comparisonResult && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-3xl p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-base">
                Porównanie Modeli Side-by-Side (Maxi Pro)
              </h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-[#8e918f] hover:text-white text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Verdict Box */}
            <div className="bg-gradient-to-r from-[#0b57d0]/20 to-purple-500/10 border border-[#0b57d0]/40 p-3.5 rounded-xl text-xs text-[#a8c7fa] leading-relaxed">
              <strong>Werdykt Analityczny:</strong> {comparisonResult.verdict}
            </div>

            {/* Side-by-side Comparison Matrix */}
            <div className="grid grid-cols-2 gap-4">
              {/* Model A */}
              <div className="bg-[#131314] p-4 rounded-xl border border-[#282a2c] space-y-3">
                <div className="border-b border-[#282a2c] pb-2">
                  <div className="font-semibold text-white text-sm">{compareModelA.toolName}</div>
                  <div className="text-[11px] font-mono text-[#8e918f]">{compareModelA.slug}</div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Dostawca:</span>
                    <span className="font-mono text-white">{compareModelA.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Kontekst:</span>
                    <span className="font-mono text-white">{compareModelA.contextWindowTokens.toLocaleString()} tok.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Koszt Blended:</span>
                    <span className="font-mono text-emerald-400">
                      {compareModelA.blendedCostPer1M === 0 ? "$0.00 (Darmowy)" : `$${compareModelA.blendedCostPer1M.toFixed(4)}/1M`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Input / Output:</span>
                    <span className="font-mono text-white">${compareModelA.inputCostPer1M} / ${compareModelA.outputCostPer1M}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Tool Calling:</span>
                    <span className={compareModelA.supportsToolCall ? "text-emerald-400 font-bold" : "text-[#5e6166]"}>
                      {compareModelA.supportsToolCall ? "Tak" : "Nie"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Reasoning:</span>
                    <span className={compareModelA.supportsReasoning ? "text-emerald-400 font-bold" : "text-[#5e6166]"}>
                      {compareModelA.supportsReasoning ? "Tak" : "Nie"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Model B */}
              <div className="bg-[#131314] p-4 rounded-xl border border-[#282a2c] space-y-3">
                <div className="border-b border-[#282a2c] pb-2 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-white text-sm">{compareModelB.toolName}</div>
                    <div className="text-[11px] font-mono text-[#8e918f]">{compareModelB.slug}</div>
                  </div>
                  <select
                    value={compareModelB.slug}
                    onChange={(e) => {
                      const m = defaultCatalog.findBySlug(e.target.value);
                      if (m) setCompareModelB(m);
                    }}
                    className="bg-[#1e1f20] border border-[#3c4043] rounded-lg text-[11px] text-[#a8c7fa] px-2 py-1"
                  >
                    {defaultCatalog.models.map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.toolName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Dostawca:</span>
                    <span className="font-mono text-white">{compareModelB.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Kontekst:</span>
                    <span className="font-mono text-white">{compareModelB.contextWindowTokens.toLocaleString()} tok.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Koszt Blended:</span>
                    <span className="font-mono text-emerald-400">
                      {compareModelB.blendedCostPer1M === 0 ? "$0.00 (Darmowy)" : `$${compareModelB.blendedCostPer1M.toFixed(4)}/1M`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Input / Output:</span>
                    <span className="font-mono text-white">${compareModelB.inputCostPer1M} / ${compareModelB.outputCostPer1M}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Tool Calling:</span>
                    <span className={compareModelB.supportsToolCall ? "text-emerald-400 font-bold" : "text-[#5e6166]"}>
                      {compareModelB.supportsToolCall ? "Tak" : "Nie"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8e918f]">Reasoning:</span>
                    <span className={compareModelB.supportsReasoning ? "text-emerald-400 font-bold" : "text-[#5e6166]"}>
                      {compareModelB.supportsReasoning ? "Tak" : "Nie"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCompareModal(false);
                  handleAskAboutModel(compareModelA);
                }}
                className="px-3.5 py-1.5 bg-[#1a73e8] hover:bg-[#1b66ca] text-white text-xs rounded-xl transition-colors"
              >
                Zadaj pytanie o model A
              </button>
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-3.5 py-1.5 bg-[#282a2c] hover:bg-[#37393b] text-white text-xs rounded-xl transition-colors"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white text-base">Ustawienia Silnika AI (Hexagonal Local-First)</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#8e918f] hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#c4c7c5] leading-relaxed">
              Łańcuch suwerenny: <strong>Lokalna Ollama → Google Gemini API → Wbudowany Asystent Bazy (Offline)</strong>. Gdy lokalny serwer nie odpowiada, agent automatycznie spada do kolejnego dostępnego adaptera.
            </p>

            {/* LOCAL OLLAMA SECTION */}
            <div className="bg-[#131314] border border-[#282a2c] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ollamaEnabled}
                    onChange={(e) => setOllamaEnabled(e.target.checked)}
                    className="rounded bg-[#1e1f20] border-[#3c4043] accent-emerald-400"
                  />
                  Lokalna Ollama (Suwerenny Local-First)
                </label>
                <button
                  type="button"
                  onClick={handleProbeOllama}
                  disabled={isCheckingOllama}
                  className="px-2.5 py-1 rounded-lg bg-[#282a2c] hover:bg-[#37393b] border border-[#3c4043] text-[11px] text-[#a8c7fa] disabled:opacity-50"
                >
                  {isCheckingOllama ? "Sprawdzanie..." : "Testuj i wykryj modele"}
                </button>
              </div>

              {ollamaHealth && (
                <div
                  className={`text-[11px] rounded-lg px-3 py-2 border ${
                    ollamaHealth.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  }`}
                >
                  {ollamaHealth.ok ? (
                    <>
                      Połączono z Ollama {ollamaHealth.version ? `v${ollamaHealth.version}` : ""} ({ollamaHealth.latencyMs}ms) • Wykryte modele: {ollamaHealth.modelsCount ?? ollamaLocalModels.length}
                    </>
                  ) : (
                    <>
                      {ollamaHealth.error} — uruchom lokalnie: <code className="font-mono">OLLAMA_ORIGINS="*" ollama serve</code>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-[#8e918f] block mb-1">Adres serwera Ollama:</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#a8c7fa]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8e918f] block mb-1">Kontekst (num_ctx):</label>
                  <select
                    value={ollamaNumCtx}
                    onChange={(e) => setOllamaNumCtx(Number(e.target.value))}
                    className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#a8c7fa]"
                  >
                    <option value={8192}>8,192 tok (lekki)</option>
                    <option value={16384}>16,384 tok (8GB VRAM)</option>
                    <option value={32768}>32,768 tok (zalecane Hex)</option>
                    <option value={65536}>65,536 tok (całe repo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#8e918f] block mb-1">Model lokalny (wpisz lub wybierz preset pod architekturę heksagonalną):</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="qwen3-coder:30b lub hex-architect"
                  className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#a8c7fa]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(ollamaLocalModels.length > 0
                    ? ollamaLocalModels.slice(0, 6).map((m) => ({
                        model: m.name,
                        label: m.parameterSize ? `${m.name} (${m.parameterSize})` : m.name,
                        numCtx: ollamaNumCtx,
                      }))
                    : RECOMMENDED_HEXAGONAL_OLLAMA_MODELS.map((p) => ({
                        model: p.model,
                        label: `${p.model} • ${p.minRamVram}`,
                        numCtx: p.recommendedNumCtx,
                      }))
                  ).map((item) => (
                    <button
                      key={item.model}
                      type="button"
                      onClick={() => {
                        setOllamaModel(item.model);
                        setOllamaNumCtx(item.numCtx);
                      }}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-colors ${
                        ollamaModel === item.model
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                          : "bg-[#1e1f20] border-[#3c4043] text-[#c4c7c5] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CLOUD FALLBACK SECTION */}
            <div>
              <label className="text-xs text-[#8e918f] block mb-1">
                Klucz Google Gemini API (opcjonalny fallback chmurowy):
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5e6166] focus:outline-none focus:border-[#a8c7fa]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  agent.setGeminiApiKey(geminiApiKey);
                  agent.configureOllama({
                    baseUrl: ollamaUrl,
                    model: ollamaModel,
                    numCtx: ollamaNumCtx,
                    enabled: ollamaEnabled,
                  });
                  settingsRepoRef.current?.save({
                    enabled: ollamaEnabled,
                    baseUrl: ollamaUrl,
                    model: ollamaModel,
                    numCtx: ollamaNumCtx,
                  });
                  setProviderTick((t) => t + 1);
                  setShowSettingsModal(false);
                }}
                className="px-4 py-2 bg-[#a8c7fa] hover:bg-white text-black font-medium rounded-xl text-xs transition-colors"
              >
                Zapisz i zastosuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
