import { ChatMessage } from "../models/ChatMessage";

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
}

export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  sendMessage(messages: ChatMessage[], options?: LLMGenerateOptions): Promise<string>;
}
