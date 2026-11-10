"""Pydantic v2 API contracts and SSE payload schemas for Audit-X Assistant."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ModeChoice = Literal["auto", "general", "rag", "sql", "file"]
RoleChoice = Literal["Admin", "Store Staff", "Rider", "Customer"]
FeedbackChoice = Literal["up", "down"]


class ChatStreamRequest(BaseModel):
    session_id: str | None = Field(default=None, description="Existing session UUID or omitted for a new chat")
    message: str = Field(min_length=1, max_length=6000)
    mode: ModeChoice = "auto"
    viva_mode: bool = False
    user_role: RoleChoice = "Admin"
    edit_message_id: str | None = None
    regenerate: bool = False


class FeedbackRequest(BaseModel):
    message_id: str | None = None
    log_id: str | None = None
    feedback: FeedbackChoice


class SessionRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class SQLPreviewRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    user_role: RoleChoice = "Admin"


class IngestResponse(BaseModel):
    doc_id: str
    title: str
    source_path: str
    doc_type: str
    chunk_count: int
    total_chunks_in_kb: int


class SessionSummary(BaseModel):
    session_id: str
    title: str
    user_role: str
    mode: str
    viva_mode: bool
    created_at: str
    updated_at: str
    message_count: int = 0


class GeneratedFileSummary(BaseModel):
    file_id: str
    file_name: str
    file_format: str
    size_bytes: int
    report_topic: str
    download_url: str
    expires_at: str
    created_by_role: str
    created_at: str
    preview: dict[str, Any] = Field(default_factory=dict)

