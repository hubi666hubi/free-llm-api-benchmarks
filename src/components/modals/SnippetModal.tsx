import { LLMModel } from "../../core/models/LLMModel";

export interface SnippetModalProps {
  snippetModel: LLMModel;
  snippetLang: "python" | "typescript" | "curl";
  setSnippetLang: (l: "python" | "typescript" | "curl") => void;
  setSnippetModel: (m: LLMModel | null) => void;
  copiedSnippet: boolean;
  handleCopySnippet: (code: string) => void;
  geminiApiKey: string;
}

export function SnippetModal({
  snippetModel,
  snippetLang,
  setSnippetLang,
  setSnippetModel,
  copiedSnippet,
  handleCopySnippet,
  geminiApiKey,
}: SnippetModalProps) {
  return (
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
  );
}

export default SnippetModal;
