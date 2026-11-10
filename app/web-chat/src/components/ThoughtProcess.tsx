import React, { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { ThoughtStage } from "../types/chat";

interface ThoughtProcessProps {
  stages: ThoughtStage[];
  isStreaming: boolean;
  hasTokens: boolean;
}

export const ThoughtProcess: React.FC<ThoughtProcessProps> = ({ stages, isStreaming, hasTokens }) => {
  const [expanded, setExpanded] = useState(!hasTokens);

  if (stages.length === 0 && !isStreaming) return null;

  const activeStage = stages.find((s) => s.status === "running");
  const totalMs = stages.reduce((acc, s) => acc + (s.ms || 0), 0);
  const doneStages = stages.filter((s) => s.status === "done");

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2.5">
          {isStreaming && !hasTokens ? (
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [0.65, 1, 0.65] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
            />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          )}

          {isStreaming && !hasTokens ? (
            <span className="thinking-shimmer font-medium">
              {activeStage ? `${activeStage.label}...` : "Thinking..."}
            </span>
          ) : (
            <span className="font-medium text-[var(--text-secondary)]">
              Thought process ({doneStages.length} steps • {totalMs} ms)
            </span>
          )}
        </div>

        <span className="text-[var(--text-muted)]">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>

      {expanded && stages.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t border-[var(--border-soft)] pt-2">
          {stages.map((st, idx) => (
            <div key={`${st.stage}-${idx}`} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {st.status === "running" ? (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-emerald-500" />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                )}
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{st.label}</div>
                  {st.detail && <div className="text-[11px] text-[var(--text-muted)]">{st.detail}</div>}
                </div>
              </div>
              {st.status === "done" && (
                <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">{st.ms} ms</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

