import { createContext, useContext, useReducer, useCallback, ReactNode, Dispatch } from "react";
import { OllamaSettingsRepository } from "../core/settings/OllamaSettings";
import { SettingsAction, SettingsState, settingsReducer } from "./settingsReducer";

interface SettingsContextValue {
  state: SettingsState;
  dispatch: Dispatch<SettingsAction>;
  /** Persists the current Ollama settings (explicit "Save", not on every keystroke). */
  saveOllama: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  repo,
  children,
}: {
  repo: OllamaSettingsRepository;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(settingsReducer, undefined, () => ({
    ollama: repo.load(),
    geminiApiKey: "",
  }));
  const saveOllama = useCallback(() => repo.save(state.ollama), [repo, state.ollama]);
  return (
    <SettingsContext.Provider value={{ state, dispatch, saveOllama }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
