export class LLMClient {
    primaryProvider;
    fallbackProvider;
    constructor(config) {
        this.primaryProvider = config.primaryProvider;
        this.fallbackProvider = config.fallbackProvider;
    }
    setPrimaryProvider(provider) {
        this.primaryProvider = provider;
    }
    setFallbackProvider(provider) {
        this.fallbackProvider = provider;
    }
    getActiveProviderName() {
        if (this.primaryProvider.isAvailable()) {
            return this.primaryProvider.name;
        }
        if (this.fallbackProvider && this.fallbackProvider.isAvailable()) {
            return this.fallbackProvider.name;
        }
        return "Brak dostępnego providera";
    }
    /**
     * Dispatches conversation to the active provider and handles fallback if needed.
     */
    async dispatchMessage(session, options) {
        const messages = session.messages;
        if (messages.length === 0) {
            throw new Error("Brak wiadomości w sesji do wysłania.");
        }
        let providerToUse = this.primaryProvider;
        if (!providerToUse.isAvailable() && this.fallbackProvider && this.fallbackProvider.isAvailable()) {
            providerToUse = this.fallbackProvider;
        }
        try {
            return await providerToUse.sendMessage(messages, options);
        }
        catch (primaryError) {
            if (this.fallbackProvider && providerToUse !== this.fallbackProvider && this.fallbackProvider.isAvailable()) {
                console.warn("Primary provider failed, switching to fallback:", primaryError);
                return await this.fallbackProvider.sendMessage(messages, options);
            }
            throw primaryError;
        }
    }
}
