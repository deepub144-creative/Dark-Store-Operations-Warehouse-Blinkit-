import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Plus, Search, Trash2, Edit3, Check, X, Sparkles } from "lucide-react";
import { ChatSession } from "../types/chat";

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

function groupByTimeBucket(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86_400_000;
  const startOfYesterday = startOfToday - oneDay;
  const startOf7Days = startOfToday - 7 * oneDay;

  const buckets: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const s of sessions) {
    const ts = new Date(s.updated_at || s.created_at).getTime();
    if (ts >= startOfToday) buckets["Today"].push(s);
    else if (ts >= startOfYesterday) buckets["Yesterday"].push(s);
    else if (ts >= startOf7Days) buckets["Previous 7 days"].push(s);
    else buckets["Older"].push(s);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  sessions,
  activeSessionId,
  loading,
  searchQuery,
  onSearchChange,
  searchInputRef,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const grouped = useMemo(() => groupByTimeBucket(sessions), [sessions]);

  const startEdit = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.session_id);
    setEditTitle(s.title);
  };

  const commitEdit = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editTitle.trim()) onRenameSession(id, editTitle.trim());
    setEditingId(null);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-y-0 left-0 z-40 flex w-[272px] shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--bg-secondary)] lg:static"
            aria-label="Chat history navigation"
          >
            <div className="flex items-center justify-between gap-2 p-3">
              <button
                type="button"
                onClick={onNewChat}
                className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm transition hover:border-emerald-500/60"
              >
                <Plus className="h-4 w-4 text-emerald-500" />
                <span>New chat</span>
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs focus-within:border-emerald-500">
                <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search chats... (Ctrl+K)"
                  aria-label="Search chat history"
                  className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loading && (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                  ))}
                </div>
              )}

              {!loading && grouped.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                  No conversations yet. Start a chat to save history cleanly.
                </div>
              )}

              {!loading &&
                grouped.map((group) => (
                  <div key={group.label} className="mt-3">
                    <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((sess) => {
                        const active = sess.session_id === activeSessionId;
                        return (
                          <div
                            key={sess.session_id}
                            onClick={() => onSelectSession(sess.session_id)}
                            className={`group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition ${
                              active
                                ? "bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400"
                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {editingId === sess.session_id ? (
                              <form
                                onSubmit={(e) => commitEdit(sess.session_id, e)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex flex-1 items-center gap-1"
                              >
                                <input
                                  autoFocus
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="w-full rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none"
                                />
                                <button type="submit" className="text-emerald-500" aria-label="Save title">
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            ) : (
                              <>
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                  <span className="truncate">{sess.title || "Untitled chat"}</span>
                                </div>
                                <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                                  <button
                                    type="button"
                                    onClick={(e) => startEdit(sess, e)}
                                    className="rounded p-1 hover:bg-[var(--bg-primary)]"
                                    aria-label="Rename chat"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSession(sess.session_id);
                                    }}
                                    className="rounded p-1 text-rose-500 hover:bg-[var(--bg-primary)]"
                                    aria-label="Delete chat"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>

            <div className="border-t border-[var(--border-soft)] p-3 text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span>Audit-X Dual AI Studio</span>
              </div>
              <div className="mt-0.5">Tiptur HUB - KA44 • General + Hybrid RAG + SQL</div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

