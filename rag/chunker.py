"""Document parser and structure-aware sliding-window chunker for Audit-X RAG.

Supports PDF, DOCX, CSV, Markdown, plain text, SQL, and source files with
overlap and preserved section/file metadata.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ChunkDraft:
    """Intermediate chunk produced before persistence and vector encoding."""

    chunk_index: int
    title: str
    section: str
    source_path: str
    doc_type: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


def extract_text_from_bytes(filename: str, payload: bytes) -> tuple[str, str]:
    """Extract clean Unicode text and normalized document type from raw bytes."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        text = _extract_pdf_bytes(payload)
        return text, "pdf"
    if ext == ".docx":
        text = _extract_docx_bytes(payload)
        return text, "docx"
    if ext == ".csv":
        text = _extract_csv_bytes(payload)
        return text, "csv"

    # Markdown, txt, sql, py, json, etc.
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return payload.decode(encoding), ext.lstrip(".") or "txt"
        except UnicodeDecodeError:
            continue
    return payload.decode("utf-8", errors="replace"), ext.lstrip(".") or "txt"


def _extract_pdf_bytes(payload: bytes) -> str:
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=payload, filetype="pdf")
        pages = [f"## Page {i + 1}\n{page.get_text('text')}" for i, page in enumerate(doc)]
        return "\n\n".join(pages).strip()
    except Exception:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(payload))
        pages = [f"## Page {i + 1}\n{(page.extract_text() or '').strip()}" for i, page in enumerate(reader.pages)]
        return "\n\n".join(pages).strip()


def _extract_docx_bytes(payload: bytes) -> str:
    from docx import Document

    document = Document(io.BytesIO(payload))
    parts: list[str] = []
    for para in document.paragraphs:
        txt = para.text.strip()
        if not txt:
            continue
        style_name = (para.style.name or "").lower() if para.style else ""
        if "heading 1" in style_name:
            parts.append(f"# {txt}")
        elif "heading 2" in style_name:
            parts.append(f"## {txt}")
        elif "heading" in style_name:
            parts.append(f"### {txt}")
        else:
            parts.append(txt)
    for tbl in document.tables:
        rows_txt = [" | ".join(cell.text.strip() for cell in row.cells) for row in tbl.rows]
        if rows_txt:
            parts.append("\n".join(rows_txt))
    return "\n\n".join(parts).strip()


def _extract_csv_bytes(payload: bytes) -> str:
    decoded = payload.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)
    if not rows:
        return ""
    header = rows[0]
    lines = ["## CSV Dataset Summary", "Columns: " + ", ".join(header)]
    for i, row in enumerate(rows[1:201], start=1):
        paired = ", ".join(f"{h}={v}" for h, v in zip(header, row))
        lines.append(f"Row {i}: {paired}")
    if len(rows) > 201:
        lines.append(f"... ({len(rows) - 201} additional rows truncated during indexing)")
    return "\n".join(lines)


def _split_sections(text: str, default_title: str) -> list[tuple[str, str]]:
    """Split markdown/structured text by headings while preserving section titles."""
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = []
    current_section = default_title
    buffer: list[str] = []

    heading_re = re.compile(r"^(#{1,3})\s+(.+?)\s*$")
    for line in lines:
        match = heading_re.match(line)
        if match:
            if buffer and any(b.strip() for b in buffer):
                sections.append((current_section, buffer))
            current_section = match.group(2).strip()
            buffer = [line]
        else:
            buffer.append(line)

    if buffer and any(b.strip() for b in buffer):
        sections.append((current_section, buffer))

    return [(sec, "\n".join(buf).strip()) for sec, buf in sections if any(b.strip() for b in buf)]


def chunk_document(
    text: str,
    title: str,
    source_path: str,
    doc_type: str = "md",
    chunk_size: int = 650,
    chunk_overlap: int = 120,
) -> list[ChunkDraft]:
    """Split a document into overlapping semantically coherent chunks with metadata."""
    cleaned = re.sub(r"\r\n?", "\n", text).strip()
    if not cleaned:
        return []

    sections = _split_sections(cleaned, default_title=title)
    drafts: list[ChunkDraft] = []
    chunk_idx = 0

    for section_title, section_body in sections:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", section_body) if p.strip()]
        current = ""

        for para in paragraphs:
            if len(current) + len(para) + 2 <= chunk_size:
                current = f"{current}\n\n{para}".strip() if current else para
                continue

            if current:
                drafts.append(
                    _make_draft(chunk_idx, title, section_title, source_path, doc_type, current)
                )
                chunk_idx += 1
                overlap_seed = current[-chunk_overlap:].lstrip() if chunk_overlap > 0 else ""
                # Avoid splitting mid-word in overlap seed
                if " " in overlap_seed and len(overlap_seed) > 20:
                    overlap_seed = overlap_seed.split(" ", 1)[1]
                current = f"{overlap_seed}\n\n{para}".strip() if overlap_seed else para
            else:
                current = para

            # Handle oversized single paragraph/table cleanly with hard sliding window
            while len(current) > chunk_size * 1.35:
                slice_end = current.rfind(" ", int(chunk_size * 0.75), chunk_size)
                if slice_end <= 0:
                    slice_end = chunk_size
                head = current[:slice_end].strip()
                drafts.append(
                    _make_draft(chunk_idx, title, section_title, source_path, doc_type, head)
                )
                chunk_idx += 1
                step_back = max(0, slice_end - chunk_overlap)
                current = current[step_back:].strip()

        if current:
            drafts.append(
                _make_draft(chunk_idx, title, section_title, source_path, doc_type, current)
            )
            chunk_idx += 1

    return drafts


def _make_draft(
    chunk_idx: int,
    title: str,
    section: str,
    source_path: str,
    doc_type: str,
    content: str,
) -> ChunkDraft:
    tokens = re.findall(r"[A-Za-z0-9_]+|[\u0C80-\u0CFF]+", content)
    return ChunkDraft(
        chunk_index=chunk_idx,
        title=title,
        section=section,
        source_path=source_path,
        doc_type=doc_type,
        content=content,
        metadata={
            "title": title,
            "section": section,
            "source_path": source_path,
            "doc_type": doc_type,
            "chunk_index": chunk_idx,
            "char_count": len(content),
            "token_count": len(tokens),
        },
    )

