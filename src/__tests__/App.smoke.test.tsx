// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "../App";
import { SettingsProvider } from "../state";
import { OllamaSettingsRepository, MemorySettingsStore } from "../core/settings/OllamaSettings";

const renderApp = () =>
  render(
    <SettingsProvider repo={new OllamaSettingsRepository(new MemorySettingsStore())}>
      <App />
    </SettingsProvider>
  );

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);

describe("App smoke (tabs and modals render without crashing)", () => {
  it("renders every tab", () => {
    renderApp();
    for (const label of [/Katalog \(/, /Arbitraż/, /Dostawcy \(/, /Czat Gemini/]) {
      fireEvent.click(screen.getByText(label));
    }
    fireEvent.click(screen.getByText(/Katalog \(/));
    expect(screen.getAllByText("Porównaj").length).toBeGreaterThan(0);
  });

  it("opens the comparison modal from the catalog", () => {
    renderApp();
    fireEvent.click(screen.getByText(/Katalog \(/));
    fireEvent.click(screen.getAllByText("Porównaj")[0]);
    expect(screen.getByText(/Porównanie Modeli/)).toBeTruthy();
  });

  it("opens the snippet modal from arbitrage", () => {
    renderApp();
    fireEvent.click(screen.getByText(/Arbitraż/));
    fireEvent.click(screen.getByText("Pobierz kod API"));
    expect(screen.getByText(/Generator Kodu API/)).toBeTruthy();
  });

  it("opens and applies the settings modal", () => {
    renderApp();
    fireEvent.click(screen.getByTitle("Ustawienia Providera AI"));
    expect(screen.getByText(/Ustawienia Silnika AI/)).toBeTruthy();
    fireEvent.click(screen.getByText("Zapisz i zastosuj"));
    expect(screen.queryByText(/Ustawienia Silnika AI/)).toBeNull();
  });
});
