import { ProviderSummary } from "../../core/catalog/BenchmarkCatalog";
import { Tab } from "./Tab";

export interface ProvidersTabProps {
  providers: string[];
  setSelectedProvider: (v: string) => void;
  providerSummaries: ProviderSummary[];
  setActiveTab: (tab: Tab) => void;
}

export function ProvidersTab({
  providers,
  setSelectedProvider,
  providerSummaries,
  setActiveTab,
}: ProvidersTabProps) {
  return (
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
  );
}

export default ProvidersTab;
