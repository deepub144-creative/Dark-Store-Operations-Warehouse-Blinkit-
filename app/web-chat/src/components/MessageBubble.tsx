import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Edit2,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { ChatMessage, CitationChunk, PipelineTrace, ReplyBadge } from "../types/chat";
import { CodeBlock, MermaidBlock } from "./CodeAndMermaid";
import { FileCard } from "./FileCard";
import { ThoughtProcess } from "./ThoughtProcess";

interface MessageBubbleProps {
  message: ChatMessage;
  theme: "light" | "dark";
  isLastAssistant: boolean;
  onSelectCitation: (citation: CitationChunk) => void;
  onFeedback: (messageId: string, logId: string | null | undefined, fb: "up" | "down") => void;
  onRegenerate: () => void;
  onEditResend: (messageId: string, newContent: string) => void;
  onInspectPipeline: (trace: PipelineTrace) => void;
}

const BADGE_COLORS: Record<ReplyBadge, string> = {
  General: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/30",
  RAG: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  SQL: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  File: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

function linkifyCitationsOutsideCode(markdown: string, citations: CitationChunk[] = []): string {
  if (!citations.length) return markdown;
  const maxRef = citations.length;
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg;
      return seg.replace(/\[(\d+)\](?!\()/g, (full, numStr) => {
        const n = Number(numStr);
        return n >= 1 && n <= maxRef ? `[[${n}]](#cite-${n})` : full;
      });
    })
    .join("");
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  theme,
  isLastAssistant,
  onSelectCitation,
  onFeedback,
  onRegenerate,
  onEditResend,
  onInspectPipeline,
}) => {
  const [copied, setCopied] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  const renderedMarkdown = useMemo(
    () => linkifyCitationsOutsideCode(message.content || "", message.citations),
    [message.content, message.citations]
  );

  const copyContent = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="group flex justify-end"
      >
        <div className="max-w-[85%] rounded-[16px] border border-[var(--border-soft)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm">
          {editing ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                className="w-full min-w-[240px] rounded-lg border border-emerald-500 bg-[var(--bg-primary)] p-2 text-sm text-[var(--text-primary)] focus:outline-none"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditDraft(message.content);
                  }}
                  className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    if (editDraft.trim()) onEditResend(message.message_id, editDraft.trim());
                  }}
                  className="rounded-lg bg-emerald-500 px-3 py-1 font-medium text-white"
                >
                  Save &amp; Resend
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <button
                type="button"
                onClick={() => {
                  setEditDraft(message.content);
                  setEditing(true);
                }}
                className="mt-0.5 shrink-0 rounded p-1 text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] group-hover:opacity-100"
                title="Edit and resend"
                aria-label="Edit and resend message"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const badge: ReplyBadge = (message.badge as ReplyBadge) || "General";
  const hasTokens = Boolean(message.content && message.content.length > 0);
  const citations = message.citations || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="group flex items-start gap-3"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-500">
        AX
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">Audit-X Assistant</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[badge]}`}>
            {badge}
          </span>
        </div>

        <ThoughtProcess
          stages={message.thought_steps || []}
          isStreaming={Boolean(message.isStreaming)}
          hasTokens={hasTokens}
        />

        {/* Markdown Body */}
        <div className="markdown-body prose prose-sm max-w-none text-sm leading-relaxed text-[var(--text-primary)] dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              a({ href, children }) {
                if (href?.startsWith("#cite-")) {
                  const refNum = Number(href.replace("#cite-", ""));
                  const matched = citations.find((c) => c.ref === refNum);
                  return (
                    <button
                      type="button"
                      onClick={() => matched && onSelectCitation(matched)}
                      className="mx-0.5 inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-500 hover:text-white dark:text-emerald-400"
                      title={matched ? `${matched.title} — ${matched.section}` : "Open source"}
                    >
                      {children}
                    </button>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer" className="text-emerald-500 underline">
                    {children}
                  </a>
                );
              },
              code({ className, children }) {
                const raw = String(children).replace(/\n$/, "");
                const match = /language-(\w+)/.exec(className || "");
                const isBlock = Boolean(match) || raw.includes("\n");
                if (!isBlock) {
                  return (
                    <code className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {raw}
                    </code>
                  );
                }
                const lang = match?.[1] || "text";
                if (lang === "mermaid") {
                  return <MermaidBlock chart={raw} theme={theme} />;
                }
                return <CodeBlock language={lang} code={raw} theme={theme} />;
              },
            }}
          >
            {renderedMarkdown}
          </ReactMarkdown>
          {message.isStreaming && <span className="streaming-caret" aria-hidden="true" />}
        </div>

        {/* Collapsible Generated SQL Block */}
        {message.sql_preview?.sql && (
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]">
            <button
              type="button"
              onClick={() => setSqlOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-sky-500" />
                <span>
                  Generated Read-Only SQL ({message.sql_preview.row_count} rows • {message.sql_preview.latency_ms} ms)
                </span>
              </div>
              {sqlOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {sqlOpen && (
              <div className="border-t border-[var(--border-soft)] p-3 pt-1">
                <CodeBlock language="sql" code={message.sql_preview.sql} theme={theme} />
              </div>
            )}
          </div>
        )}

        {/* Downloadable File Card */}
        {message.file_card && <FileCard file={message.file_card} />}

        {/* Clickable Citations Chip Row */}
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Sources:</span>
            {citations.map((cit) => (
              <button
                key={cit.chunk_id}
                type="button"
                onClick={() => onSelectCitation(cit)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition hover:border-emerald-500/60 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                <span className="font-mono font-bold text-emerald-500">[{cit.ref}]</span>
                <span className="max-w-[180px] truncate">{cit.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Toolbar */}
        {!message.isStreaming && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1 text-xs text-[var(--text-muted)]">
            <button
              type="button"
              onClick={copyContent}
              className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              title="Copy response"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              type="button"
              onClick={() => onFeedback(message.message_id, message.log_id, "up")}
              className={`rounded-lg p-1.5 transition hover:bg-[var(--bg-elevated)] ${
                message.feedback === "up" ? "text-emerald-500" : "hover:text-[var(--text-primary)]"
              }`}
              title="Helpful answer"
              aria-label="Thumbs up"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onFeedback(message.message_id, message.log_id, "down")}
              className={`rounded-lg p-1.5 transition hover:bg-[var(--bg-elevated)] ${
                message.feedback === "down" ? "text-rose-500" : "hover:text-[var(--text-primary)]"
              }`}
              title="Needs improvement"
              aria-label="Thumbs down"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>

            {isLastAssistant && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                title="Regenerate response"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            {message.pipeline_trace && (
              <button
                type="button"
                onClick={() => onInspectPipeline(message.pipeline_trace!)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-[var(--bg-elevated)] hover:text-emerald-500"
                title="Inspect retrieval and generation trace"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Pipeline ({message.pipeline_trace.total_ms} ms)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

