import { LLMModel } from "../../core/models/LLMModel";

export interface CatalogTabProps {
  filterMillionPlus: boolean;
  filterParetoOnly: boolean;
  filterReasoning: boolean;
  filterTools: boolean;
  filteredModels: LLMModel[];
  handleAskAboutModel: (model: LLMModel) => void;
  handleOpenComparison: (model: LLMModel) => void;
  paretoSlugs: ReadonlySet<string>;
  providers: string[];
  searchQuery: string;
  selectedProvider: string;
  setFilterMillionPlus: (v: boolean) => void;
  setFilterParetoOnly: (v: boolean) => void;
  setFilterReasoning: (v: boolean) => void;
  setFilterTools: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  setSelectedProvider: (v: string) => void;
  setSnippetModel: (m: LLMModel | null) => void;
}

export function CatalogTab({
  filterMillionPlus,
  filterParetoOnly,
  filterReasoning,
  filterTools,
  filteredModels,
  handleAskAboutModel,
  handleOpenComparison,
  paretoSlugs,
  providers,
  searchQuery,
  selectedProvider,
  setFilterMillionPlus,
  setFilterParetoOnly,
  setFilterReasoning,
  setFilterTools,
  setSearchQuery,
  setSelectedProvider,
  setSnippetModel,
}: CatalogTabProps) {
  return (
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
  );
}

export default CatalogTab;
