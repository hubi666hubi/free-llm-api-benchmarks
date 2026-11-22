import { OllamaSettings } from "../core/settings/OllamaSettings";

export interface SettingsState {
  ollama: OllamaSettings;
  /** In-memory only: never persisted (secret). */
  geminiApiKey: string;
}

export type SettingsAction =
  | { type: "ollama/patch"; patch: Partial<OllamaSettings> }
  | { type: "gemini/setKey"; key: string };

export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "ollama/patch":
      return { ...state, ollama: { ...state.ollama, ...action.patch } };
    case "gemini/setKey":
      return { ...state, geminiApiKey: action.key };
  }
}
