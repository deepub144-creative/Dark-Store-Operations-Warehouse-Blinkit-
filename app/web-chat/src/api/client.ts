import {
  AnswerMode,
  ChatMessage,
  ChatSession,
  CitationChunk,
  EvalMetrics,
  FileArtifactCard,
  HealthInfo,
  PipelineTrace,
  SqlPayload,
  ThoughtStage,
  UserRole,
} from "../types/chat";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export interface StreamCallbacks {
  onMeta?: (meta: {
    session_id: string;
    user_message_id: string;
    assistant_message_id: string;
    log_id: string;
    intent: string;
    badge: "General" | "RAG" | "SQL" | "File";
  }) => void;
  onStage?: (stage: ThoughtStage) => void;
  onCitations?: (citations: CitationChunk[]) => void;
  onSql?: (sql: SqlPayload) => void;
  onFile?: (file: FileArtifactCard) => void;
  onToken?: (text: string) => void;
  onPipeline?: (trace: PipelineTrace) => void;
  onDone?: (done: { message_id: string; log_id: string; latency_ms: number }) => void;
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend API unreachable");
  return res.json();
}

export async function listSessions(query = ""): Promise<ChatSession[]> {
  const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const res = await fetch(`${API_BASE}/api/history${params}`);
  if (!res.ok) throw new Error("Failed to load chat history");
  return res.json();
}

export async function fetchSessionDetail(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function deleteSessionApi(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function renameSessionApi(sessionId: string, title: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename session");
}

export async function sendFeedbackApi(
  messageId: string | undefined,
  logId: string | null | undefined,
  feedback: "up" | "down"
): Promise<void> {
  await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: messageId, log_id: logId, feedback }),
  });
}

export async function uploadKnowledgeFile(file: File): Promise<{
  doc_id: string;
  title: string;
  chunk_count: number;
  total_chunks_in_kb: number;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/ingest`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function runEvalBenchmark(): Promise<EvalMetrics> {
  const res = await fetch(`${API_BASE}/api/evaluate`);
  if (!res.ok) throw new Error("Evaluation failed");
  return res.json();
}

export async function streamChatRequest(
  payload: {
    session_id?: string | null;
    message: string;
    mode: AnswerMode;
    viva_mode: boolean;
    user_role: UserRole;
    edit_message_id?: string;
    regenerate?: boolean;
  },
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(errBody.detail || `Server error (${res.status})`);
  }
  if (!res.body) {
    throw new Error("Streaming response body missing");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      let evName = "message";
      let dataStr = "{}";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) {
          evName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataStr = line.slice(5).trim();
        }
      }
      const parsed = JSON.parse(dataStr);
      if (evName === "meta") callbacks.onMeta?.(parsed);
      else if (evName === "stage") callbacks.onStage?.(parsed);
      else if (evName === "citations") callbacks.onCitations?.(parsed.citations || []);
      else if (evName === "sql") callbacks.onSql?.(parsed);
      else if (evName === "file") callbacks.onFile?.(parsed);
      else if (evName === "token") callbacks.onToken?.(parsed.text || "");
      else if (evName === "pipeline") callbacks.onPipeline?.(parsed);
      else if (evName === "done") callbacks.onDone?.(parsed);
    }
  }
}

