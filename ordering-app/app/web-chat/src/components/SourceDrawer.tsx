import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, FileCode2, X } from "lucide-react";
import { CitationChunk } from "../types/chat";

interface SourceDrawerProps {
  citation: CitationChunk | null;
  onClose: () => void;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({ citation, onClose }) => {
  return (
    <AnimatePresence>
      {citation && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border-soft)] bg-[var(--bg-primary)] shadow-2xl"
            aria-label="Source chunk viewer"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-xs font-bold text-emerald-500">
                  [{citation.ref}]
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Retrieved Source Chunk</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                aria-label="Close source drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm">
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <span>{citation.title}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <FileCode2 className="h-3.5 w-3.5" />
                  <span className="font-mono">{citation.source_path}</span>
                </div>
                <div className="mt-2 text-xs text-[var(--text-secondary)]">
                  Section: <span className="font-medium text-[var(--text-primary)]">{citation.section}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2.5">
                  <div className="text-[var(--text-muted)]">Cross-Encoder Rerank</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-emerald-500">{citation.score.toFixed(4)}</div>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2.5">
                  <div className="text-[var(--text-muted)]">Vector Cosine</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {citation.vector_score.toFixed(4)}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2.5">
                  <div className="text-[var(--text-muted)]">Okapi BM25</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {citation.bm25_score.toFixed(3)}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2.5">
                  <div className="text-[var(--text-muted)]">RRF Fusion (k=60)</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-primary)]">
                    {citation.rrf_score.toFixed(5)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Chunk Text Excerpt ({citation.chunk_id})
                </div>
                <div className="whitespace-pre-wrap rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3.5 text-xs leading-relaxed text-[var(--text-primary)]">
                  {citation.content}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

