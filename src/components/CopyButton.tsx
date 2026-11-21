import { useEffect, useState } from "react";

export interface CopyButtonProps {
  /** Text written to the clipboard. */
  text: string;
  /** Idle label. */
  label?: string;
  /** Label shown after a successful copy. */
  copiedLabel?: string;
  /** How long the "copied" state lasts, in ms. */
  resetAfterMs?: number;
  className?: string;
}

/**
 * Accessible copy-to-clipboard button.
 * The single focus path is the native <button>; status is announced via a polite live region.
 *
 * Usage: <CopyButton text="ollama run qwen3-coder" />
 */
export default function CopyButton({
  text,
  label = "Kopiuj",
  copiedLabel = "Skopiowano",
  resetAfterMs = 1500,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  // Explicit side effect: reset the state after a delay, cleaned up on unmount/re-copy.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), resetAfterMs);
    return () => window.clearTimeout(id);
  }, [copied, resetAfterMs]);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard unavailable (e.g. insecure context)
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-[#282a2c] bg-[#1e1f20] text-[#e3e3e3] hover:bg-[#282a2c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c7fa] transition-colors ${className}`}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
