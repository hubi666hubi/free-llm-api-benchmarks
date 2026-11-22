import { useEffect, useRef, useState } from "react";
import { BenchmarkAssistantAgent } from "../core/chat/BenchmarkAssistantAgent";
import { BenchmarkCatalog } from "../core/catalog/BenchmarkCatalog";
import { ChatMessage } from "../core/models/ChatMessage";
import { OllamaSettings } from "../core/settings/OllamaSettings";
import { createBenchmarkContainer } from "../adapters/bootstrap";
import { TOKENS } from "../core/di/tokens";

/** Owns the benchmark agent (one per app life), its chat messages and loading flag. */
export function useChatAgent(catalog: BenchmarkCatalog, initialOllama: OllamaSettings) {
  const agentRef = useRef<BenchmarkAssistantAgent | null>(null);
  if (!agentRef.current) {
    const agent = createBenchmarkContainer({ catalog }).resolve<BenchmarkAssistantAgent>(TOKENS.BenchmarkAgent);
    if (initialOllama.enabled) agent.configureOllama({ ...initialOllama, enabled: true });
    agentRef.current = agent;
  }
  const agent = agentRef.current;

  const [messages, setMessages] = useState<ChatMessage[]>(agent.session.messages);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => agent.session.subscribe(setMessages), [agent]);

  const send = async (text: string) => {
    setIsLoading(true);
    try {
      await agent.ask(text);
    } finally {
      setIsLoading(false);
    }
  };

  return { agent, messages, isLoading, send };
}
