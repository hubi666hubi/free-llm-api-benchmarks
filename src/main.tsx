import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SettingsProvider } from "./state";
import { OllamaSettingsRepository } from "./core/settings/OllamaSettings";
import { LocalStorageSettingsStore } from "./adapters/LocalStorageSettingsStore";

const settingsRepo = new OllamaSettingsRepository(new LocalStorageSettingsStore());

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <SettingsProvider repo={settingsRepo}>
        <App />
      </SettingsProvider>
    </React.StrictMode>
  );
}
