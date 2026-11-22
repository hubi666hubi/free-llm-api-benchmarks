import { LocalModelInfo, ProviderHealth, RECOMMENDED_HEXAGONAL_OLLAMA_MODELS } from "../../core/chat/LLMProvider";

export interface SettingsModalProps {
  geminiApiKey: string;
  handleProbeOllama: () => void;
  isCheckingOllama: boolean;
  ollamaEnabled: boolean;
  ollamaHealth: ProviderHealth | null;
  ollamaLocalModels: LocalModelInfo[];
  ollamaModel: string;
  ollamaNumCtx: number;
  ollamaUrl: string;
  setGeminiApiKey: (k: string) => void;
  setOllamaEnabled: (v: boolean) => void;
  setOllamaModel: (v: string) => void;
  setOllamaNumCtx: (v: number) => void;
  setOllamaUrl: (v: string) => void;
  setShowSettingsModal: (v: boolean) => void;
  onApply: () => void;
}

export function SettingsModal({
  geminiApiKey,
  handleProbeOllama,
  isCheckingOllama,
  ollamaEnabled,
  ollamaHealth,
  ollamaLocalModels,
  ollamaModel,
  ollamaNumCtx,
  ollamaUrl,
  setGeminiApiKey,
  setOllamaEnabled,
  setOllamaModel,
  setOllamaNumCtx,
  setOllamaUrl,
  setShowSettingsModal,
  onApply,
}: SettingsModalProps) {
  return (
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
            onClick={onApply}
            className="px-4 py-2 bg-[#a8c7fa] hover:bg-white text-black font-medium rounded-xl text-xs transition-colors"
          >
            Zapisz i zastosuj
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
