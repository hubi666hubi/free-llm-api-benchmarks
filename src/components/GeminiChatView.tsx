import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string | Date;
}

export interface GeminiChatViewProps {
  /** Title shown in the top app bar */
  title?: string;
  /** List of chat messages to display */
  messages?: ChatMessage[];
  /** Placeholder for the text input box */
  placeholder?: string;
  /** Legal / accuracy disclaimer text below the input */
  disclaimerText?: string;
  /** Text for the link inside the disclaimer */
  disclaimerLinkText?: string;
  /** URL for the disclaimer link */
  disclaimerLinkHref?: string;
  /** Initial value for the input field */
  initialInput?: string;
  /** Whether the assistant is currently generating a response */
  isLoading?: boolean;
  /** Optional custom CSS classes for the root container */
  className?: string;
  /** Called when the user submits a message */
  onSendMessage?: (message: string) => void;
  /** Called when the hamburger menu button is clicked */
  onMenuClick?: () => void;
  /** Called when the close (X) button is clicked */
  onClose?: () => void;
  /** Called when the attachment / Workspace action button is clicked */
  onAttachClick?: () => void;
  /** Optional custom message renderer */
  renderMessageContent?: (content: string, role: ChatMessage["role"]) => ReactNode;
}

/**
 * Default sample message reproducing the content in the reference screenshot
 */
const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content: `...świecie realnym zarabia się na takim kodzie konkretne pieniądze, bez budowania żadnych „subskrypcyjnych aplikacji”:

### 1. Arbitraż i szybki handel (Arbitrage & Sniper Bots)
*Tam, gdzie liczą się sekundy, a błędy pamięci eliminują z gry:*

• **Giełdy i krypto (DEX/CEX):**
Wykrywanie różnic w płynności na różnych giełdach i natychmiastowe egzekwowanie transakcji. Jeśli bot zawiesi się z powodu wycieku pamięci albo zablokowania IP – tracisz okazję. Twój orkiestrator dba o to, żeby instancje zawsze były podłączone i gotowe do akcji.

• **Zakupy biletów / rzadkich dóbr (E-commerce Sniping):**
Masowy monitoring dostępności przedmiotów lub biletów na wydarzenia i ich natychmiastowy zakup, gdy tylko pojawią się w ofercie.`,
  },
];

/**
 * Lightweight helper to format markdown-like text (bold, headings, bullet points, italics)
 * without requiring heavy external dependencies.
 */
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-[#e3e3e3] leading-relaxed text-[15px] sm:text-base">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // Headings like '### 1. ...' or '1. ...'
        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={idx}
              className="text-base sm:text-lg font-semibold text-white pt-2 text-balance"
            >
              {trimmed.replace(/^###\s+/, "")}
            </h3>
          );
        }

        // Bullet point lines starting with • or - or *
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const bulletContent = trimmed.replace(/^[•\-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-1">
              <span className="text-[#a8c7fa] select-none text-lg leading-none mt-0.5">•</span>
              <div className="flex-1">{renderInlineFormatting(bulletContent)}</div>
            </div>
          );
        }

        // Italic lines wrapped in *...*
        if (trimmed.startsWith("*") && trimmed.endsWith("*") && trimmed.length > 2) {
          return (
            <p key={idx} className="text-[#c4c7c5] italic text-sm sm:text-[15px]">
              {trimmed.slice(1, -1)}
            </p>
          );
        }

        return <p key={idx}>{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

/**
 * Formats inline bold (**text**) and code (`text`)
 */
function renderInlineFormatting(line: string): ReactNode {
  const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={i}
          className="bg-[#282a2c] text-[#a8c7fa] text-xs sm:text-sm px-1.5 py-0.5 rounded font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Inline SVG Icons to guarantee zero external runtime icon dependencies
 */
const HamburgerIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SendUpIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const DocumentContextIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <line x1="7" y1="8" x2="17" y2="8" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="7" y1="16" x2="13" y2="16" />
  </svg>
);

/**
 * GeminiChatView Component
 *
 * Implements the dark-themed mobile chat interface shown in the screenshot.
 * Features an accessible top bar, scrollable rich message area with a floating
 * scroll-to-bottom button, rounded composer with context/attachment and send actions,
 * and standard disclaimer footer.
 */
export const GeminiChatView: React.FC<GeminiChatViewProps> = ({
  title = "Daj znać czy to spoko",
  messages = DEFAULT_MESSAGES,
  placeholder = "Zadaj pytanie",
  disclaimerText = "Funkcja Gemini w Workspace może popełniać błędy.",
  disclaimerLinkText = "Więcej informacji",
  disclaimerLinkHref = "https://support.google.com",
  initialInput = "",
  isLoading = false,
  className = "",
  onSendMessage,
  onMenuClick,
  onClose,
  onAttachClick,
  renderMessageContent,
}) => {
  const [input, setInput] = useState<string>(initialInput);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Smoothly scroll down to newest message
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Monitor scroll position to display the floating down chevron button when scrolled up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Show button if user is scrolled more than 80px above the bottom
      const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 80;
      setShowScrollBottom(isFarFromBottom);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Auto-scroll on new messages when user is already near bottom
  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom("smooth");
    }
  }, [messages, showScrollBottom, scrollToBottom]);

  // Auto-resize the textarea height based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  // Form submit handler
  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Keyboard shortcut: Enter sends message, Shift+Enter creates a new line
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSendActive = input.trim().length > 0 && !isLoading;

  return (
    <div
      className={`flex flex-col h-full w-full max-w-md mx-auto bg-[#131314] text-[#e3e3e3] font-sans select-text relative overflow-hidden ${className}`}
      data-testid="gemini-chat-view"
    >
      {/* 1. Header App Bar */}
      <header
        className="flex items-center justify-between px-3 h-14 bg-[#131314] border-b border-[#282a2c]/60 shrink-0 z-10"
        role="banner"
      >
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Otwórz menu nawigacyjne"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#c4c7c5] hover:bg-[#282a2c] active:bg-[#37393b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa] transition-colors"
        >
          <HamburgerIcon />
        </button>

        <h1
          className="text-[17px] font-medium text-white truncate px-2 max-w-[70%] text-center tracking-normal"
          title={title}
        >
          {title}
        </h1>

        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij czat"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#c4c7c5] hover:bg-[#282a2c] active:bg-[#37393b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa] transition-colors"
        >
          <CloseIcon />
        </button>
      </header>

      {/* 2. Chat Message List */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700"
        role="log"
        aria-label="Historia konwersacji"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`transition-opacity duration-200 ${
              msg.role === "user"
                ? "bg-[#282a2c] text-white p-3.5 rounded-2xl rounded-br-sm max-w-[85%] ml-auto"
                : "w-full"
            }`}
          >
            {renderMessageContent ? (
              renderMessageContent(msg.content, msg.role)
            ) : (
              <FormattedMessage text={msg.content} />
            )}
          </article>
        ))}

        {isLoading && (
          <div
            className="flex items-center gap-1.5 py-2 text-[#a8c7fa] text-sm animate-pulse"
            aria-label="Generowanie odpowiedzi..."
          >
            <span className="w-2 h-2 rounded-full bg-[#a8c7fa]" />
            <span className="w-2 h-2 rounded-full bg-[#a8c7fa]" />
            <span className="w-2 h-2 rounded-full bg-[#a8c7fa]" />
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden="true" className="h-2" />
      </main>

      {/* 3. Floating Scroll To Bottom Button */}
      {showScrollBottom && (
        <div className="absolute bottom-[115px] left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Przewiń na dół"
            className="w-9 h-9 rounded-full bg-[#282a2c] border border-[#3c4043] text-[#e3e3e3] shadow-lg flex items-center justify-center hover:bg-[#37393b] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa] transition-all"
          >
            <ChevronDownIcon />
          </button>
        </div>
      )}

      {/* 4. Bottom Input Composer */}
      <div className="px-3.5 pt-1 pb-1 bg-[#131314] shrink-0">
        <form
          onSubmit={handleSubmit}
          className="bg-[#1e1f20] rounded-[24px] px-3.5 py-2.5 flex flex-col gap-1.5 border border-transparent focus-within:border-[#444746] transition-colors shadow-sm"
          role="search"
          aria-label="Pole wprowadzania wiadomości"
        >
          {/* Textarea */}
          <label htmlFor="gemini-chat-input" className="sr-only">
            {placeholder}
          </label>
          <textarea
            ref={textareaRef}
            id="gemini-chat-input"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-transparent border-0 text-[#e3e3e3] placeholder-[#8e918f] focus:outline-none resize-none text-[15px] sm:text-base leading-snug py-1 px-0.5 max-h-[120px]"
          />

          {/* Action Toolbar */}
          <div className="flex items-center justify-between pt-0.5">
            {/* Attachment / Context Tool Button */}
            <button
              type="button"
              onClick={onAttachClick}
              aria-label="Dodaj kontekst lub załącznik z Workspace"
              className="w-9 h-9 rounded-xl bg-[#0b57d0]/25 text-[#7cacf8] hover:bg-[#0b57d0]/40 active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa] transition-all"
            >
              <DocumentContextIcon />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!isSendActive}
              aria-label="Wyślij wiadomość"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isSendActive
                  ? "bg-[#e3e3e3] text-[#131314] hover:bg-white active:scale-95 shadow-sm"
                  : "bg-[#282a2c] text-[#5e6166] cursor-not-allowed opacity-60"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa]`}
            >
              <SendUpIcon />
            </button>
          </div>
        </form>
      </div>

      {/* 5. Legal Disclaimer Footer */}
      <footer className="text-center py-2 px-3 text-[11px] text-[#8e918f] shrink-0 leading-tight">
        <span>{disclaimerText} </span>
        <a
          href={disclaimerLinkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#c4c7c5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a8c7fa] transition-colors"
        >
          {disclaimerLinkText}
        </a>
      </footer>
    </div>
  );
};

export default GeminiChatView;
