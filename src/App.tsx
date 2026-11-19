import { useState, useEffect, useMemo, useRef } from "react";
import GeminiChatView, { ChatMessage } from "./components/GeminiChatView";
import { defaultCatalog } from "./data/catalog";
import { BenchmarkAssistantAgent } from "./core/chat/BenchmarkAssistantAgent";
import { LLMModel } from "./core/models/LLMModel";

export function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "catalog" | "arbitrage">("chat");

  // Benchmark Agent instance (singleton per app life)
  const agentRef = useRef<BenchmarkAssistantAgent | null>(null);
  if (!agentRef.current) {
    agentRef.current = new BenchmarkAssistantAgent(defaultCatalog);
  }
  const agent = agentRef.current;

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(agent.session.messages);
  const [isLoading, setIsLoading] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  // Arbitrage Calculator State
  const [monthlyTokens, setMonthlyTokens] = useState<number>(10); // in millions
  const [selectedModelSlug, setSelectedModelSlug] = useState<string>("kyma/glm-5.3-flash");

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

  // Filtered models for catalog tab
  const filteredModels = useMemo(() => {
    return defaultCatalog.filter({
      provider: selectedProvider || undefined,
      minContext: filterMillionPlus ? 1_000_000 : 0,
      requireTools: filterTools,
      requireReasoning: filterReasoning,
    }).filter((m) => m.matchesQuery(searchQuery));
  }, [searchQuery, selectedProvider, filterMillionPlus, filterTools, filterReasoning]);

  // Providers list for filter dropdown
  const providers = useMemo(() => defaultCatalog.getProviders(), []);

  // Selected model for calculator
  const calcModel = useMemo(() => {
    return defaultCatalog.findBySlug(selectedModelSlug) || defaultCatalog.models[0];
  }, [selectedModelSlug]);

  // Arbitrage calculations
  const baselineCost = monthlyTokens * 3.00; // $3.00/1M standard SaaS
  const targetCost = monthlyTokens * (calcModel ? calcModel.blendedCostPer1M : 0);
  const netSavings = baselineCost - targetCost;
  const savingsPct = baselineCost > 0 ? ((netSavings / baselineCost) * 100).toFixed(1) : "0";

  // Quick prompt suggestions
  const quickPrompts = [
    "Który model ma największy kontekst?",
    "Pokaż najtańsze modele z obsługą Tool Calling",
    "Jak działa arbitraż cenowy Open-Weights vs SaaS?",
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
              <span className="text-[10px] bg-[#0b57d0]/30 text-[#7cacf8] border border-[#0b57d0]/50 px-1.5 py-0.5 rounded-full font-mono">
                100 Models Top-Tier
              </span>
            </h1>
            <p className="text-[11px] text-[#8e918f] hidden sm:block">
              Inteligentny katalog modeli i asystent AI z interfejsem Gemini
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
            Katalog Modeli ({filteredModels.length})
          </button>
          <button
            onClick={() => setActiveTab("arbitrage")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "arbitrage"
                ? "bg-[#282a2c] text-white shadow-sm"
                : "text-[#c4c7c5] hover:text-white hover:bg-[#1e1f20]"
            }`}
          >
            Arbitraż & Kalkulator
          </button>
        </nav>

        {/* Settings button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Ustawienia API"
            className="px-2.5 py-1.5 rounded-lg border border-[#3c4043] bg-[#282a2c] hover:bg-[#37393b] text-xs text-[#e3e3e3] flex items-center gap-1.5 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="hidden sm:inline">Provider:</span>
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
                title="Antigravity Gemini AI • Intelligence Oracle"
                messages={messages}
                isLoading={isLoading}
                placeholder="Zadaj pytanie o modele LLM, darmowe API, okno kontekstowe lub koszty..."
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div className="flex items-center gap-4 text-xs font-medium">
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
                      <th className="py-3 px-4">Kontekst (Tokeny)</th>
                      <th className="py-3 px-4">Koszt Blended / 1M</th>
                      <th className="py-3 px-4 text-center">Narzędzia</th>
                      <th className="py-3 px-4 text-center">Reasoning</th>
                      <th className="py-3 px-4">Typ wdrożenia</th>
                      <th className="py-3 px-4 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#282a2c]">
                    {filteredModels.map((model) => (
                      <tr key={model.slug} className="hover:bg-[#282a2c]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{model.toolName}</div>
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
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleAskAboutModel(model)}
                            className="px-2.5 py-1 rounded-lg bg-[#0b57d0]/25 text-[#7cacf8] hover:bg-[#0b57d0]/40 font-medium text-xs transition-all"
                          >
                            Zapytaj w czacie
                          </button>
                        </td>
                      </tr>
                    ))}
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
                  Kalkulator Oszczędności Arbitrażowych (ROI)
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

                  <div className="pt-4">
                    <button
                      onClick={() => handleAskAboutModel(calcModel)}
                      className="w-full py-2 bg-[#1a73e8] hover:bg-[#1b66ca] text-white rounded-xl text-xs font-medium transition-colors"
                    >
                      Skonfiguruj ten model w Czat Gemini
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white text-base">Ustawienia Providera AI</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#8e918f] hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#c4c7c5] leading-relaxed">
              Domyślnie asystent działa w trybie <strong>Wbudowanego Asystenta Bazy (Oracle Assistant)</strong>, który natychmiastowo przeszukuje katalog modeli bez wymogu posiadania kluczy.
            </p>

            <div>
              <label className="text-xs text-[#8e918f] block mb-1">
                Opcjonalny klucz Google Gemini API (dla zapytań ogólnych):
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
                  setShowSettingsModal(false);
                }}
                className="px-4 py-2 bg-[#a8c7fa] hover:bg-white text-black font-medium rounded-xl text-xs transition-colors"
              >
                Zapisz i zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
