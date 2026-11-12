import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import {
  deleteSessionApi,
  fetchHealth,
  fetchSessionDetail,
  listSessions,
  renameSessionApi,
  sendFeedbackApi,
  streamChatRequest,
  uploadKnowledgeFile,
} from "./api/client";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";
import { HeaderBar } from "./components/HeaderBar";
import { MessageBubble } from "./components/MessageBubble";
import { PipelineInspector } from "./components/PipelineInspector";
import { Sidebar } from "./components/Sidebar";
import { SourceDrawer } from "./components/SourceDrawer";
import {
  AnswerMode,
  ChatMessage,
  ChatSession,
  CitationChunk,
  HealthInfo,
  PipelineTrace,
  UserRole,
} from "./types/chat";

interface ToastItem {
  id: string;
  text: string;
  tone: "ok" | "err";
}

function resolveInitialTheme(): "light" | "dark" {
  const saved = localStorage.getItem("auditx_chat_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(resolveInitialTheme);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => window.innerWidth >= 1024);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const [mode, setMode] = useState<AnswerMode>("auto");
  const [vivaMode, setVivaMode] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("Admin");

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [composerValue, setComposerValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationChunk | null>(null);
  const [activeTrace, setActiveTrace] = useState<PipelineTrace | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const pushToast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  // Theme class sync
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("auditx_chat_theme", theme);
  }, [theme]);

  const refreshHealthAndHistory = useCallback(async (q = searchQuery) => {
    try {
      const [h, hist] = await Promise.all([fetchHealth(), listSessions(q)]);
      setHealth(h);
      setSessions(hist);
    } catch {
      // keep UI responsive even while API boots
    } finally {
      setSessionsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    refreshHealthAndHistory("");
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      listSessions(searchQuery)
        .then(setSessions)
        .catch(() => {});
    }, 180);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Global keyboard shortcuts: Ctrl+K search, Esc stop/close drawers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else if (e.key === "Escape") {
        if (isStreaming) {
          abortRef.current?.abort();
          setIsStreaming(false);
          pushToast("Generation stopped.", "ok");
        } else if (selectedCitation) {
          setSelectedCitation(null);
        } else if (inspectorOpen) {
          setInspectorOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isStreaming, selectedCitation, inspectorOpen, pushToast]);

  // Smooth auto-scroll unless user scrolled upward
  useEffect(() => {
    if (userScrolledUp) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, userScrolledUp, isStreaming]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 90);
  };

  const scrollToBottom = () => {
    setUserScrolledUp(false);
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const detail = await fetchSessionDetail(sessionId);
      setActiveSessionId(sessionId);
      setMessages(detail.messages);
      const lastTrace = [...detail.messages].reverse().find((m) => m.pipeline_trace)?.pipeline_trace || null;
      setActiveTrace(lastTrace);
      setUserScrolledUp(false);
      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch {
      pushToast("Could not load selected conversation.", "err");
    }
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setActiveSessionId(null);
    setMessages([]);
    setActiveTrace(null);
    setUserScrolledUp(false);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const sendMessage = async (
    textToSend: string,
    opts?: { editMessageId?: string; regenerate?: boolean }
  ) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming) return;

    setUserScrolledUp(false);
    if (!opts?.regenerate) setComposerValue("");

    const tempUserId = `u-${Date.now()}`;
    const tempAssistantId = `a-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setMessages((prev) => {
      let base = prev;
      if (opts?.editMessageId) {
        const idx = prev.findIndex((m) => m.message_id === opts.editMessageId);
        if (idx >= 0) base = prev.slice(0, idx);
      } else if (opts?.regenerate) {
        const lastIdx = prev.length - 1;
        if (lastIdx >= 0 && prev[lastIdx].role === "assistant") {
          base = prev.slice(0, lastIdx);
        }
      }

      const nextList = [...base];
      if (!opts?.regenerate) {
        nextList.push({
          message_id: tempUserId,
          session_id: activeSessionId || "pending",
          role: "user",
          content: trimmed,
          created_at: nowIso,
        });
      }
      nextList.push({
        message_id: tempAssistantId,
        session_id: activeSessionId || "pending",
        role: "assistant",
        content: "",
        badge: "General",
        citations: [],
        thought_steps: [],
        created_at: nowIso,
        isStreaming: true,
      });
      return nextList;
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    try {
      await streamChatRequest(
        {
          session_id: activeSessionId,
          message: trimmed,
          mode,
          viva_mode: vivaMode,
          user_role: userRole,
          edit_message_id: opts?.editMessageId,
          regenerate: opts?.regenerate,
        },
        {
          onMeta: (meta) => {
            setActiveSessionId(meta.session_id);
            setMessages((prev) =>
              prev.map((m) => {
                if (m.message_id === tempUserId) {
                  return { ...m, message_id: meta.user_message_id, session_id: meta.session_id };
                }
                if (m.message_id === tempAssistantId) {
                  return {
                    ...m,
                    message_id: meta.assistant_message_id,
                    session_id: meta.session_id,
                    badge: meta.badge,
                    log_id: meta.log_id,
                  };
                }
                return m;
              })
            );
          },
          onStage: (stage) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (!m.isStreaming) return m;
                const existing = m.thought_steps || [];
                const filtered = existing.filter((s) => !(s.stage === stage.stage && s.status === "running"));
                return { ...m, thought_steps: [...filtered, stage] };
              })
            );
          },
          onCitations: (citations) => {
            setMessages((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, citations } : m))
            );
          },
          onSql: (sql) => {
            setMessages((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, sql_preview: sql, sql_text: sql.sql } : m))
            );
          },
          onFile: (file) => {
            setMessages((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, file_card: file } : m))
            );
          },
          onToken: (text) => {
            setMessages((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, content: `${m.content}${text}` } : m))
            );
          },
          onPipeline: (trace) => {
            setActiveTrace(trace);
            setMessages((prev) =>
              prev.map((m) => (m.isStreaming ? { ...m, pipeline_trace: trace } : m))
            );
          },
          onDone: () => {
            setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
          },
        },
        controller.signal
      );
      await refreshHealthAndHistory(searchQuery);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message || "Unable to connect to Audit-X backend.";
        pushToast(msg, "err");
        setMessages((prev) =>
          prev.map((m) =>
            m.isStreaming
              ? {
                  ...m,
                  isStreaming: false,
                  content: m.content || `**Error:** ${msg} Check that the FastAPI server is running on port 8000.`,
                }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      sendMessage(lastUser.content, { regenerate: true });
    }
  };

  const handleEditResend = (messageId: string, newContent: string) => {
    sendMessage(newContent, { editMessageId: messageId });
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadKnowledgeFile(file);
      pushToast(`Indexed "${res.title}" (${res.chunk_count} chunks)`, "ok");
      refreshHealthAndHistory();
    } catch (err) {
      pushToast((err as Error).message || "Document upload failed", "err");
    } finally {
      setUploading(false);
    }
  };

  const handleFeedback = async (messageId: string, logId: string | null | undefined, fb: "up" | "down") => {
    setMessages((prev) => prev.map((m) => (m.message_id === messageId ? { ...m, feedback: fb } : m)));
    try {
      await sendFeedbackApi(messageId, logId, fb);
      pushToast(fb === "up" ? "Feedback recorded — thank you!" : "Feedback logged for retrieval tuning.", "ok");
    } catch {
      // ignore non-fatal toast noise
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionApi(sessionId);
      if (activeSessionId === sessionId) handleNewChat();
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      pushToast("Conversation deleted.", "ok");
    } catch {
      pushToast("Failed to delete conversation.", "err");
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      await renameSessionApi(sessionId, newTitle);
      setSessions((prev) => prev.map((s) => (s.session_id === sessionId ? { ...s, title: newTitle } : s)));
    } catch {
      pushToast("Failed to rename conversation.", "err");
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.message_id;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        loading={sessionsLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          mode={mode}
          onModeChange={setMode}
          vivaMode={vivaMode}
          onToggleViva={() => setVivaMode((p) => !p)}
          userRole={userRole}
          onRoleChange={setUserRole}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((p) => !p)}
          health={health}
        />

        <div className="relative flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={handleScroll}>
          {messages.length === 0 ? (
            <EmptyState onSelectPrompt={(prompt) => sendMessage(prompt)} />
          ) : (
            <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-3 py-6 sm:px-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.message_id}
                  message={msg}
                  theme={theme}
                  isLastAssistant={msg.message_id === lastAssistantId}
                  onSelectCitation={setSelectedCitation}
                  onFeedback={handleFeedback}
                  onRegenerate={handleRegenerate}
                  onEditResend={handleEditResend}
                  onInspectPipeline={(trace) => {
                    setActiveTrace(trace);
                    setInspectorOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {userScrolledUp && messages.length > 0 && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="fixed bottom-28 right-6 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-lg transition hover:border-emerald-500"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-4 w-4 text-emerald-500" />
            </button>
          )}
        </div>

        <Composer
          value={composerValue}
          onChange={setComposerValue}
          onSend={() => sendMessage(composerValue)}
          onStop={handleStop}
          onUploadFile={handleUploadFile}
          isStreaming={isStreaming}
          uploading={uploading}
          mode={mode}
          onModeChange={setMode}
          vivaMode={vivaMode}
          onToggleViva={() => setVivaMode((p) => !p)}
        />
      </div>

      <PipelineInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        trace={activeTrace}
      />

      <SourceDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} />

      {/* Toast Notifications */}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`rounded-xl border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur ${
                t.tone === "err"
                  ? "border-rose-500/40 bg-rose-950/90 text-rose-100"
                  : "border-emerald-500/40 bg-slate-900/95 text-emerald-100"
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

