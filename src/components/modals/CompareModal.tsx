import { LLMModel } from "../../core/models/LLMModel";
import { ModelComparison } from "../../core/catalog/BenchmarkCatalog";
import { defaultCatalog } from "../../data/catalog";

export interface CompareModalProps {
  compareModelA: LLMModel;
  compareModelB: LLMModel;
  comparisonResult: ModelComparison;
  setCompareModelB: (m: LLMModel) => void;
  setShowCompareModal: (v: boolean) => void;
  handleAskAboutModel: (model: LLMModel) => void;
}

export function CompareModal({
  compareModelA,
  compareModelB,
  comparisonResult,
  setCompareModelB,
  setShowCompareModal,
  handleAskAboutModel,
}: CompareModalProps) {
  return (
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
  );
}

export default CompareModal;
