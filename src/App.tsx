import { useState, useMemo } from "react";
import GeminiChatView from "./components/GeminiChatView";
import DegenLabView from "./components/DegenLabView";
import { defaultCatalog } from "./data/catalog";
import { useSettings } from "./state";
import { useChatAgent } from "./hooks/useChatAgent";
import CatalogTab from "./components/tabs/CatalogTab";
import ArbitrageTab from "./components/tabs/ArbitrageTab";
import ProvidersTab from "./components/tabs/ProvidersTab";
import { Tab } from "./components/tabs/Tab";
import { filterModels } from "./core/catalog/filterModels";
import { LLMModel } from "./core/models/LLMModel";
import { ModelComparison } from "./core/catalog/BenchmarkCatalog";
import {
  LocalModelInfo,
  ProviderHealth,
  RECOMMENDED_HEXAGONAL_OLLAMA_MODELS,
} from "./core/chat/LLMProvider";

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // Global settings (Ollama persisted via SettingsProvider -> ISettingsStore)
  const { state: settings, dispatch, saveOllama } = useSettings();
  const { agent, messages, isLoading, send: handleSendMessage } = useChatAgent(defaultCatalog, settings.ollama);

  const geminiApiKey = settings.geminiApiKey;
  const setGeminiApiKey = (key: string) => dispatch({ type: "gemini/setKey", key });
  const ollamaEnabled = settings.ollama.enabled;
  const ollamaUrl = settings.ollama.baseUrl;
  const ollamaModel = settings.ollama.model;
  const ollamaNumCtx = settings.ollama.numCtx;
  const setOllamaEnabled = (enabled: boolean) => dispatch({ type: "ollama/patch", patch: { enabled } });
  const setOllamaUrl = (baseUrl: string) => dispatch({ type: "ollama/patch", patch: { baseUrl } });
  const setOllamaModel = (model: string) => dispatch({ type: "ollama/patch", patch: { model } });
  const setOllamaNumCtx = (numCtx: number) => dispatch({ type: "ollama/patch", patch: { numCtx } });
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
    return filterModels(
      defaultCatalog,
      {
        query: searchQuery,
        provider: selectedProvider,
        millionPlus: filterMillionPlus,
        requireTools: filterTools,
        requireReasoning: filterReasoning,
        paretoOnly: filterParetoOnly,
      },
      paretoSlugs
    );
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
        {activeTab === "catalog" && <CatalogTab filterMillionPlus={filterMillionPlus} filterParetoOnly={filterParetoOnly} filterReasoning={filterReasoning} filterTools={filterTools} filteredModels={filteredModels} handleAskAboutModel={handleAskAboutModel} handleOpenComparison={handleOpenComparison} paretoSlugs={paretoSlugs} providers={providers} searchQuery={searchQuery} selectedProvider={selectedProvider} setFilterMillionPlus={setFilterMillionPlus} setFilterParetoOnly={setFilterParetoOnly} setFilterReasoning={setFilterReasoning} setFilterTools={setFilterTools} setSearchQuery={setSearchQuery} setSelectedProvider={setSelectedProvider} setSnippetModel={setSnippetModel} />}
        {/* TAB 3: ARBITRAGE & ANALYTICS */}
        {activeTab === "arbitrage" && <ArbitrageTab handleAskAboutModel={handleAskAboutModel} setSnippetModel={setSnippetModel} baselineCost={baselineCost} calcModel={calcModel} monthlyTokens={monthlyTokens} netSavings={netSavings} savingsPct={savingsPct} selectedModelSlug={selectedModelSlug} targetCost={targetCost} setMonthlyTokens={setMonthlyTokens} setSelectedModelSlug={setSelectedModelSlug} />}
        {/* TAB 4: PROVIDERS INTELLIGENCE */}
        {activeTab === "providers" && <ProvidersTab providers={providers} setSelectedProvider={setSelectedProvider} providerSummaries={providerSummaries} setActiveTab={setActiveTab} />}
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
                  saveOllama();
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
