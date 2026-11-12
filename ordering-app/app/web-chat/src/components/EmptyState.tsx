import React from "react";
import { motion } from "framer-motion";
import { Cpu, Database, FileSpreadsheet, GitBranch } from "lucide-react";

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const STARTER_CARDS = [
  {
    icon: Cpu,
    tag: "RAG",
    title: "Explain our RAG pipeline",
    desc: "Hybrid Vector + BM25, Reciprocal Rank Fusion & Cross-Encoder reranking",
    prompt: "Explain our RAG pipeline step by step",
  },
  {
    icon: Database,
    tag: "SQL",
    title: "Top 10 products this week",
    desc: "Run a read-only SQL query across Order_Item & Product revenues",
    prompt: "Top 10 selling products this week with revenue",
  },
  {
    icon: FileSpreadsheet,
    tag: "File",
    title: "Generate a sales PPT",
    desc: "Build a multi-slide PowerPoint deck with KPIs, chart & insights",
    prompt: "Generate a sales report PPT",
  },
  {
    icon: GitBranch,
    tag: "Viva / ER",
    title: "Explain the ER diagram",
    desc: "Walk through all 12 normalized tables, foreign keys & cardinalities",
    prompt: "Explain the ER diagram and all 12 entities in Audit-X",
  },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-[760px] flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xl font-bold text-emerald-500 shadow-sm">
        AX
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        Audit-X Assistant
      </h1>
      <p className="mt-2 max-w-lg text-sm text-[var(--text-secondary)]">
        Ask general coding or conceptual questions freely, query live dark-store SQL analytics, explore cited project
        docs in English &amp; ಕನ್ನಡ, or generate `.pptx`, `.pdf`, `.docx`, `.xlsx` reports.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {STARTER_CARDS.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.title}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx, duration: 0.25 }}
              onClick={() => onSelectPrompt(card.prompt)}
              className="group flex flex-col justify-between rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 transition hover:border-emerald-500/60 hover:bg-[var(--bg-elevated)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {card.tag}
                </span>
              </div>
              <div className="mt-3 text-sm font-medium text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {card.title}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">{card.desc}</div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

