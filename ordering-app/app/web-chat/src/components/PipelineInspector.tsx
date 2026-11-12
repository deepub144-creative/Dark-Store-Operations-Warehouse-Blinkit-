import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, BarChart3, CheckCircle2, Sparkles, X } from "lucide-react";
import { EvalMetrics, PipelineTrace } from "../types/chat";
import { runEvalBenchmark } from "../api/client";

interface PipelineInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  trace: PipelineTrace | null;
}

const PIPELINE_NODES = ["Query", "Embed", "Retrieve", "Rerank", "Prompt", "LLM", "Answer"];

export const PipelineInspector: React.FC<PipelineInspectorProps> = ({ isOpen, onClose, trace }) => {
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalMetrics, setEvalMetrics] = useState<EvalMetrics | null>(null);

  const triggerEval = async () => {
    setEvalLoading(true);
    try {
      const m = await runEvalBenchmark();
      setEvalMetrics(m);
    } catch {
      // handled gracefully in UI
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 380, opacity: 0.7 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-[var(--border-soft)] bg-[var(--bg-secondary)] shadow-2xl xl:static"
          aria-label="Academic Pipeline Inspector"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span>Pipeline Inspector</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {/* Stage Chain Visualization */}
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3">
              <div className="mb-2 font-semibold text-[var(--text-secondary)]">Execution Flow</div>
              <div className="flex flex-wrap items-center gap-1">
                {PIPELINE_NODES.map((node, i) => (
                  <React.Fragment key={node}>
                    <motion.span
                      initial={{ scale: 0.92 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      {node}
                    </motion.span>
                    {i < PIPELINE_NODES.length - 1 && <ArrowRight className="h-3 w-3 text-[var(--text-muted)]" />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {trace ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-2.5">
                    <div className="text-[var(--text-muted)]">Total Latency</div>
                    <div className="mt-0.5 font-mono text-sm font-bold text-[var(--text-primary)]">{trace.total_ms} ms</div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-2.5">
                    <div className="text-[var(--text-muted)]">Grounding Score</div>
                    <div
                      className={`mt-0.5 font-mono text-sm font-bold ${
                        trace.is_grounded ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {trace.max_score.toFixed(3)} ({trace.is_grounded ? "PASS" : "WEAK"})
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3">
                  <div className="font-semibold text-[var(--text-secondary)]">Stage Timings</div>
                  <div className="mt-2 space-y-2">
                    {trace.stages.map((st, idx) => {
                      const pct = Math.max(8, Math.min(100, Math.round((st.ms / Math.max(1, trace.total_ms)) * 100)));
                      return (
                        <div key={`${st.stage}-${idx}`}>
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-[var(--text-primary)]">{st.label}</span>
                            <span className="font-mono text-[var(--text-muted)]">{st.ms} ms</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 space-y-2">
                  <div>
                    <div className="font-semibold text-[var(--text-secondary)]">Rewritten Query</div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-primary)]">{trace.rewritten_query}</div>
                  </div>
                  {trace.expanded_queries.length > 1 && (
                    <div>
                      <div className="font-semibold text-[var(--text-secondary)]">Multi-Query Expansions</div>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px] text-[var(--text-muted)]">
                        {trace.expanded_queries.map((eq, i) => (
                          <li key={i}>{eq}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[var(--text-muted)]">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    <span>LLM Adapter: {trace.llm_provider}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-center text-[var(--text-muted)]">
                Send a message or click <strong>Inspect</strong> on any assistant reply to view stage latencies, query
                rewrites, and grounding scores.
              </div>
            )}

            {/* Academic RAG Benchmark Section */}
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  <span>RAG Eval Suite</span>
                </div>
                <button
                  type="button"
                  onClick={triggerEval}
                  disabled={evalLoading}
                  className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {evalLoading ? "Running..." : "Run Eval"}
                </button>
              </div>
              {evalMetrics && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2">
                    <div className="text-[var(--text-muted)]">Hit-Rate@5</div>
                    <div className="font-mono font-bold text-emerald-500">
                      {(evalMetrics.hit_rate_at_5 * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2">
                    <div className="text-[var(--text-muted)]">MRR</div>
                    <div className="font-mono font-bold text-emerald-500">{evalMetrics.mrr.toFixed(3)}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2">
                    <div className="text-[var(--text-muted)]">Faithfulness</div>
                    <div className="font-mono font-bold text-[var(--text-primary)]">
                      {(evalMetrics.faithfulness_rate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2">
                    <div className="text-[var(--text-muted)]">Trap Refusal</div>
                    <div className="flex items-center gap-1 font-mono font-bold text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {(evalMetrics.trap_refusal_rate * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

