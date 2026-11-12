export type AnswerMode = "auto" | "general" | "rag" | "sql" | "file";
export type UserRole = "Admin" | "Store Staff" | "Rider" | "Customer";
export type ReplyBadge = "General" | "RAG" | "SQL" | "File";

export interface CitationChunk {
  ref: number;
  chunk_id: string;
  doc_id: string;
  title: string;
  section: string;
  source_path: string;
  score: number;
  vector_score: number;
  bm25_score: number;
  rrf_score: number;
  content: string;
}

export interface ThoughtStage {
  stage: string;
  label: string;
  detail: string;
  status: "running" | "done";
  ms: number;
}

export interface SqlPayload {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  latency_ms: number;
  topic: string;
  blocked_reason?: string | null;
}

export interface FileArtifactCard {
  file_id: string;
  file_name: string;
  file_format: string;
  size_bytes: number;
  report_topic: string;
  download_url: string;
  expires_at: string;
  preview?: {
    type?: string;
    slides?: string[];
    sheets?: string[];
    formatting?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    kpis?: [string, string][];
  };
}

export interface PipelineTrace {
  stages: ThoughtStage[];
  rewritten_query: string;
  expanded_queries: string[];
  max_score: number;
  is_grounded: boolean;
  llm_provider: string;
  total_ms: number;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  badge?: ReplyBadge | null;
  citations?: CitationChunk[];
  sql_text?: string | null;
  sql_preview?: SqlPayload | null;
  thought_steps?: ThoughtStage[];
  pipeline_trace?: PipelineTrace | null;
  file_card?: FileArtifactCard | null;
  log_id?: string | null;
  feedback?: "up" | "down" | null;
  created_at: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  session_id: string;
  title: string;
  user_role: UserRole | string;
  mode: AnswerMode | string;
  viva_mode: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface HealthInfo {
  status: string;
  app: string;
  llm_provider: string;
  embedding_backend: string;
  indexed_chunks: number;
  indexed_documents: number;
}

export interface EvalMetrics {
  in_domain_queries: number;
  trap_queries: number;
  hit_rate_at_3: number;
  hit_rate_at_5: number;
  mrr: number;
  faithfulness_rate: number;
  trap_refusal_rate: number;
}

