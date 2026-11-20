import { ChatMessage } from "../models/ChatMessage";
import { IChatSession, IClock, IIdGenerator, SessionListener } from "../di/interfaces";
import { SystemClock, DefaultIdGenerator } from "../di/defaults";

export class ChatSession implements IChatSession {
  readonly id: string;
  private _title: string;
  private _messages: ChatMessage[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _listeners: Set<SessionListener> = new Set();
  private readonly clock: IClock;
  private readonly idGenerator: IIdGenerator;

  constructor(
    id?: string,
    initialMessages: ChatMessage[] = [],
    title: string = "Nowa konwersacja",
    clock: IClock = new SystemClock(),
    idGenerator: IIdGenerator = new DefaultIdGenerator()
  ) {
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.id = id || this.idGenerator.generateId("session");
    this._title = title;
    this._messages = [...initialMessages];
    this._createdAt = this.clock.now();
    this._updatedAt = this.clock.now();
  }

  get title(): string {
    return this._title;
  }

  set title(newTitle: string) {
    this._title = newTitle;
    this._updatedAt = this.clock.now();
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
      id: this.idGenerator.generateId("msg"),
      role,
      content,
      timestamp: this.clock.now(),
    };
    this._messages.push(msg);
    this._updatedAt = this.clock.now();
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
      this._updatedAt = this.clock.now();
      this.notify();
    }
  }

  /**
   * Clears all messages from the session.
   */
  clear(): void {
    this._messages = [];
    this._updatedAt = this.clock.now();
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
  static fromJSON(
    jsonStr: string,
    clock: IClock = new SystemClock(),
    idGenerator: IIdGenerator = new DefaultIdGenerator()
  ): ChatSession {
    const parsed = JSON.parse(jsonStr);
    const session = new ChatSession(
      parsed.id,
      parsed.messages || [],
      parsed.title || "Wczytana sesja",
      clock,
      idGenerator
    );
    return session;
  }
}
