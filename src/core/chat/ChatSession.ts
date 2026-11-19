import { ChatMessage } from "../../components/GeminiChatView";

export type SessionListener = (messages: ChatMessage[]) => void;

export class ChatSession {
  readonly id: string;
  private _title: string;
  private _messages: ChatMessage[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _listeners: Set<SessionListener> = new Set();

  constructor(id: string = `session-${Date.now()}`, initialMessages: ChatMessage[] = [], title: string = "Nowa konwersacja") {
    this.id = id;
    this._title = title;
    this._messages = [...initialMessages];
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  get title(): string {
    return this._title;
  }

  set title(newTitle: string) {
    this._title = newTitle;
    this._updatedAt = new Date();
  }

  get messages(): ChatMessage[] {
    return [...this._messages];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Adds a message to the session and notifies subscribers.
   */
  addMessage(role: ChatMessage["role"], content: string): ChatMessage {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role,
      content,
      timestamp: new Date(),
    };
    this._messages.push(msg);
    this._updatedAt = new Date();
    this.notify();
    return msg;
  }

  /**
   * Updates an existing message (e.g. streaming chunks or error states).
   */
  updateMessage(id: string, newContent: string): void {
    const idx = this._messages.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this._messages[idx] = {
        ...this._messages[idx],
        content: newContent,
      };
      this._updatedAt = new Date();
      this.notify();
    }
  }

  /**
   * Clears all messages from the session.
   */
  clear(): void {
    this._messages = [];
    this._updatedAt = new Date();
    this.notify();
  }

  /**
   * Rough token estimation for messages (~4 chars per token).
   */
  estimateTokens(): number {
    const totalChars = this._messages.reduce((acc, m) => acc + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Subscribes to conversation changes.
   */
  subscribe(listener: SessionListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.messages;
    this._listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("Error in ChatSession listener:", err);
      }
    });
  }

  /**
   * Exports session state to JSON.
   */
  toJSON(): string {
    return JSON.stringify({
      id: this.id,
      title: this.title,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      messages: this._messages,
    });
  }

  /**
   * Imports session state from JSON.
   */
  static fromJSON(jsonStr: string): ChatSession {
    const parsed = JSON.parse(jsonStr);
    const session = new ChatSession(parsed.id, parsed.messages || [], parsed.title || "Wczytana sesja");
    return session;
  }
}
