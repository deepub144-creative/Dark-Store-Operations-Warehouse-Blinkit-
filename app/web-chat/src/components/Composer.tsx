import React, { useEffect, useRef } from "react";
import { ArrowUp, GraduationCap, Paperclip, Square } from "lucide-react";
import { AnswerMode } from "../types/chat";

interface ComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  onUploadFile: (file: File) => void;
  isStreaming: boolean;
  uploading: boolean;
  mode: AnswerMode;
  onModeChange: (m: AnswerMode) => void;
  vivaMode: boolean;
  onToggleViva: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  onUploadFile,
  isStreaming,
  uploading,
  mode,
  onModeChange,
  vivaMode,
  onToggleViva,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="sticky bottom-0 z-10 border-t border-[var(--border-soft)] bg-[var(--bg-primary)]/90 px-3 pb-3 pt-2.5 backdrop-blur-md">
      <div className="mx-auto max-w-[760px]">
        <div className="rounded-[16px] border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2.5 shadow-sm transition focus-within:border-emerald-500/70">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything in English or ಕನ್ನಡ — code, ER schema, SQL sales, or 'generate a PPT'..."
            aria-label="Message Audit-X Assistant"
            className="max-h-[180px] w-full resize-none bg-transparent px-1.5 py-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                title="Ingest PDF, DOCX, TXT, MD, or CSV into RAG knowledge base"
                className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:border-emerald-500/50 hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5 text-emerald-500" />
                <span>{uploading ? "Indexing..." : "Add Doc"}</span>
              </button>

              <select
                value={mode}
                onChange={(e) => onModeChange(e.target.value as AnswerMode)}
                aria-label="Composer Mode Override"
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] focus:outline-none sm:hidden"
              >
                <option value="auto">Mode: Auto</option>
                <option value="general">Mode: General</option>
                <option value="rag">Mode: Project RAG</option>
                <option value="sql">Mode: SQL</option>
                <option value="file">Mode: File</option>
              </select>

              <button
                type="button"
                onClick={onToggleViva}
                className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-medium transition sm:hidden ${
                  vivaMode
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                    : "border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Viva</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">
                Enter to send • Shift+Enter newline • Esc stop
              </span>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!value.trim()}
                  aria-label="Send message"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

