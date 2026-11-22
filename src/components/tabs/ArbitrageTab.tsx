import { defaultCatalog } from "../../data/catalog";
import { LLMModel } from "../../core/models/LLMModel";

export interface ArbitrageTabProps {
  handleAskAboutModel: (model: LLMModel) => void;
  setSnippetModel: (m: LLMModel | null) => void;
  baselineCost: number;
  calcModel: LLMModel;
  monthlyTokens: number;
  netSavings: number;
  savingsPct: string;
  selectedModelSlug: string;
  targetCost: number;
  setMonthlyTokens: (v: number) => void;
  setSelectedModelSlug: (v: string) => void;
}

export function ArbitrageTab({
  handleAskAboutModel,
  setSnippetModel,
  baselineCost,
  calcModel,
  monthlyTokens,
  netSavings,
  savingsPct,
  selectedModelSlug,
  targetCost,
  setMonthlyTokens,
  setSelectedModelSlug,
}: ArbitrageTabProps) {
  return (
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
  );
}

export default ArbitrageTab;
