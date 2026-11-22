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
import SnippetModal from "./components/modals/SnippetModal";
import CompareModal from "./components/modals/CompareModal";
import SettingsModal from "./components/modals/SettingsModal";
import { filterModels } from "./core/catalog/filterModels";
import { LLMModel } from "./core/models/LLMModel";
import { ModelComparison } from "./core/catalog/BenchmarkCatalog";
import {
  LocalModelInfo,
  ProviderHealth,
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

  // Apply settings from the modal (agent config + persistence)
  const handleApplySettings = () => {
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
      {snippetModel && <SnippetModal snippetModel={snippetModel} snippetLang={snippetLang} setSnippetLang={setSnippetLang} setSnippetModel={setSnippetModel} copiedSnippet={copiedSnippet} handleCopySnippet={handleCopySnippet} geminiApiKey={geminiApiKey} />}

      {/* COMPARISON MODAL */}
      {showCompareModal && compareModelA && compareModelB && comparisonResult && <CompareModal compareModelA={compareModelA} compareModelB={compareModelB} comparisonResult={comparisonResult} setCompareModelB={setCompareModelB} setShowCompareModal={setShowCompareModal} handleAskAboutModel={handleAskAboutModel} />}

      {/* SETTINGS MODAL */}
      {showSettingsModal && <SettingsModal geminiApiKey={geminiApiKey} handleProbeOllama={handleProbeOllama} isCheckingOllama={isCheckingOllama} ollamaEnabled={ollamaEnabled} ollamaHealth={ollamaHealth} ollamaLocalModels={ollamaLocalModels} ollamaModel={ollamaModel} ollamaNumCtx={ollamaNumCtx} ollamaUrl={ollamaUrl} setGeminiApiKey={setGeminiApiKey} setOllamaEnabled={setOllamaEnabled} setOllamaModel={setOllamaModel} setOllamaNumCtx={setOllamaNumCtx} setOllamaUrl={setOllamaUrl} setShowSettingsModal={setShowSettingsModal} onApply={handleApplySettings} />}
    </div>
  );
}

export default App;
