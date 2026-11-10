"""Unit tests for all 5 document builders (.pptx, .pdf, .docx, .xlsx, .csv) & signed URLs."""

from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest
from docx import Document
from pptx import Presentation

from backend.file_builders import generate_report_artifact
from backend.security import sign_file_token, verify_file_token
from data.seed_db import seed_database


@pytest.mark.parametrize(
    "fmt,prompt",
    [
        ("pptx", "Make a sales report PPT"),
        ("pdf", "Give shrinkage report PDF"),
        ("docx", "Generate an academic project report DOCX"),
        ("xlsx", "Export top-selling products as Excel"),
        ("csv", "Export low stock inventory as CSV"),
    ],
)
def test_generate_all_supported_formats(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fmt: str, prompt: str) -> None:
    db_file = tmp_path / f"files_{fmt}.db"
    seed_database(db_file, force_reset=True)
    monkeypatch.setenv("AUDITX_DB_PATH", str(db_file))

    art = generate_report_artifact(prompt=prompt, file_format=fmt, user_role="Admin", db_path=db_file)
    assert art.file_path.exists()
    assert art.size_bytes > 500
    assert art.file_format == fmt
    assert "sig=" in art.download_url

    if fmt == "pptx":
        prs = Presentation(str(art.file_path))
        assert len(prs.slides) == 4
    elif fmt == "docx":
        doc = Document(str(art.file_path))
        assert doc.styles["Normal"].font.name == "Times New Roman"
        assert doc.styles["Normal"].font.size.pt == 13
        assert len(doc.paragraphs) >= 5
    elif fmt == "xlsx":
        wb = openpyxl.load_workbook(str(art.file_path))
        assert set(["Executive_Summary", "Detailed_Data", "Audit_Metadata"]).issubset(set(wb.sheetnames))
        ws = wb["Detailed_Data"]
        formulas = [cell.value for row in ws.iter_rows() for cell in row if isinstance(cell.value, str) and cell.value.startswith("=")]
        assert len(formulas) >= 1
        assert len(ws._charts) >= 1
    elif fmt == "pdf":
        header = art.file_path.read_bytes()[:4]
        assert header == b"%PDF"


def test_signed_file_token_verification() -> None:
    import time

    future = int(time.time()) + 300
    sig = sign_file_token("abc123", future)
    assert verify_file_token("abc123", future, sig) is True
    assert verify_file_token("abc123", future - 600, sig) is False
    assert verify_file_token("tampered", future, sig) is False


def test_customer_cannot_export_shrinkage_report(tmp_path: Path) -> None:
    db_file = tmp_path / "rbac_files.db"
    seed_database(db_file, force_reset=True)
    with pytest.raises(PermissionError):
        generate_report_artifact("Give shrinkage report PDF", user_role="Customer", db_path=db_file)

