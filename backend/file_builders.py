"""Tool-called multi-format report builders (.pptx, .pdf, .docx, .xlsx, .csv) for Audit-X Assistant."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import pandas as pd

from backend.config import get_settings
from backend.database import get_connection
from backend.security import UserRole, build_signed_download_url, normalize_role
from backend.sql_engine import SQLQueryResult, run_nl_to_sql


@dataclass(slots=True)
class GeneratedArtifact:
    file_id: str
    file_name: str
    file_format: str
    file_path: Path
    size_bytes: int
    report_topic: str
    download_url: str
    expires_at: str
    sql_used: str
    preview: dict[str, Any]


REPORT_QUERY_MAP: dict[str, str] = {
    "sales": "Show top 12 selling products with revenue and category",
    "sales_darkstore": "Compare sales and revenue by darkstore hub",
    "inventory": "List low stock and out of stock inventory items across hubs",
    "forecast": "Show demand forecast predicted vs actual quantities",
    "shrinkage": "Show shrinkage dump write-off losses by product and reason",
    "rider": "Show rider performance on-time SLA rate and ratings",
    "funnel": "Show order funnel status counts and average SLA minutes",
    "academic_report": "Compare sales and revenue by darkstore hub",
}


def detect_file_request_spec(prompt: str) -> tuple[str, str]:
    """Infer target format (pptx|pdf|docx|xlsx|csv) and report topic from natural prompt."""
    q = prompt.lower()
    fmt = "pdf"
    if any(k in q for k in ("ppt", "pptx", "powerpoint", "presentation", "slide", "deck")):
        fmt = "pptx"
    elif any(k in q for k in ("excel", "xlsx", "spreadsheet", "workbook")):
        fmt = "xlsx"
    elif "csv" in q:
        fmt = "csv"
    elif any(k in q for k in ("docx", "word", "doc report", "assignment", "college report", "project report")):
        fmt = "docx"
    elif "pdf" in q:
        fmt = "pdf"

    topic = "sales"
    if any(k in q for k in ("academic", "college report", "project report", "thesis", "documentation")):
        topic = "academic_report"
    elif any(k in q for k in ("shrinkage", "dump", "dad", "write-off", "loss")):
        topic = "shrinkage"
    elif any(k in q for k in ("inventory", "low stock", "out of stock", "oos", "stock")):
        topic = "inventory"
    elif any(k in q for k in ("forecast", "demand", "predict")):
        topic = "forecast"
    elif any(k in q for k in ("rider", "delivery", "captain", "fleet")):
        topic = "rider"
    elif any(k in q for k in ("funnel", "status", "conversion")):
        topic = "funnel"
    elif any(k in q for k in ("darkstore", "hub", "store")):
        topic = "sales_darkstore"

    return fmt, topic


def _safe_str(val: Any) -> str:
    if val is None:
        return "—"
    if isinstance(val, float):
        return f"{val:,.2f}"
    return str(val)


def _create_chart_png(df: pd.DataFrame, title: str, out_png: Path) -> Path | None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import pandas as pd

    if df.empty or len(df.columns) < 2:
        return None
    label_col = df.columns[0]
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if not numeric_cols:
        return None

    value_col = numeric_cols[-1]
    sub = df.head(8)
    labels = [str(v)[:20] for v in sub[label_col]]
    values = [float(v) if pd.notna(v) else 0.0 for v in sub[value_col]]

    fig, ax = plt.subplots(figsize=(7.2, 3.6), dpi=140)
    bars = ax.barh(labels[::-1], values[::-1], color="#10b981", edgecolor="#065f46")
    ax.set_title(title, fontsize=11, fontweight="bold", color="#0f172a")
    ax.set_xlabel(value_col.replace("_", " ").title(), fontsize=9)
    ax.grid(axis="x", linestyle="--", alpha=0.35)
    for bar in bars:
        w = bar.get_width()
        ax.text(w, bar.get_y() + bar.get_height() / 2, f" {w:,.1f}", va="center", fontsize=8)
    plt.tight_layout()
    fig.savefig(out_png, bbox_inches="tight")
    plt.close(fig)
    return out_png


def _compute_kpis(df: pd.DataFrame, topic: str) -> list[tuple[str, str]]:
    import pandas as pd

    if df.empty:
        return [("Rows Analyzed", "0"), ("Topic", topic.replace("_", " ").title())]

    kpis: list[tuple[str, str]] = [("Records Analyzed", str(len(df)))]
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]) and len(kpis) < 4:
            total = float(df[col].fillna(0).sum())
            label = col.replace("_", " ").title()
            if "pct" in col or "rate" in col or "rating" in col or "mins" in col:
                avg_v = float(df[col].fillna(0).mean())
                kpis.append((f"Avg {label}", f"{avg_v:,.2f}"))
            elif "inr" in col or "loss" in col or "revenue" in col:
                kpis.append((f"Total {label}", f"INR {total:,.2f}"))
            else:
                kpis.append((f"Total {label}", f"{total:,.0f}"))
    return kpis[:4]


def _build_pptx(
    out_path: Path,
    title: str,
    topic: str,
    df: pd.DataFrame,
    sql_used: str,
    rag_notes: str,
    tmp_dir: Path,
) -> dict[str, Any]:
    from pptx import Presentation
    from pptx.dml.color import RGBColor as PptRGB
    from pptx.util import Inches, Pt as PptPt

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]
    kpis = _compute_kpis(df, topic)

    # Slide 1: Title Slide
    s1 = prs.slides.add_slide(blank_layout)
    bg = s1.background.fill
    bg.solid()
    bg.fore_color.rgb = PptRGB(15, 23, 42)

    tb = s1.shapes.add_textbox(Inches(0.9), Inches(2.0), Inches(11.5), Inches(2.2))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = f"AUDIT-X WAREHOUSE INTELLIGENCE\n{title}"
    p.font.size = PptPt(34)
    p.font.bold = True
    p.font.color.rgb = PptRGB(248, 250, 252)

    sub = s1.shapes.add_textbox(Inches(0.9), Inches(4.5), Inches(11.5), Inches(1.2))
    sp = sub.text_frame.paragraphs[0]
    sp.text = (
        f"Tiptur HUB - KA44 & Regional Dark Stores  |  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"Topic: {topic.replace('_', ' ').title()}  |  Audit-X Assistant Tool-Called Export"
    )
    sp.font.size = PptPt(16)
    sp.font.color.rgb = PptRGB(16, 185, 129)

    # Slide 2: Executive KPIs
    s2 = prs.slides.add_slide(blank_layout)
    h2 = s2.shapes.add_textbox(Inches(0.7), Inches(0.45), Inches(11.8), Inches(0.7))
    hp2 = h2.text_frame.paragraphs[0]
    hp2.text = "Executive Operational KPIs"
    hp2.font.size = PptPt(26)
    hp2.font.bold = True
    hp2.font.color.rgb = PptRGB(15, 23, 42)

    card_w = Inches(2.8)
    for idx, (label, val) in enumerate(kpis):
        left = Inches(0.7 + idx * 3.05)
        shape = s2.shapes.add_shape(1, left, Inches(1.45), card_w, Inches(1.6))
        shape.fill.solid()
        shape.fill.fore_color.rgb = PptRGB(241, 245, 249)
        shape.line.color.rgb = PptRGB(16, 185, 129)
        ctf = shape.text_frame
        ctf.word_wrap = True
        cp0 = ctf.paragraphs[0]
        cp0.text = label
        cp0.font.size = PptPt(13)
        cp0.font.color.rgb = PptRGB(71, 85, 105)
        cp1 = ctf.add_paragraph()
        cp1.text = val
        cp1.font.size = PptPt(22)
        cp1.font.bold = True
        cp1.font.color.rgb = PptRGB(15, 23, 42)

    table_df = df.head(7)
    if not table_df.empty:
        rows_cnt = len(table_df) + 1
        cols_cnt = min(len(table_df.columns), 6)
        tbl_shape = s2.shapes.add_table(rows_cnt, cols_cnt, Inches(0.7), Inches(3.4), Inches(11.9), Inches(3.4))
        tbl = tbl_shape.table
        for c_i in range(cols_cnt):
            cell = tbl.cell(0, c_i)
            cell.text = str(table_df.columns[c_i]).replace("_", " ").upper()
            cell.fill.solid()
            cell.fill.fore_color.rgb = PptRGB(15, 23, 42)
            cell.text_frame.paragraphs[0].font.color.rgb = PptRGB(255, 255, 255)
            cell.text_frame.paragraphs[0].font.size = PptPt(10)
        for r_i, (_, row) in enumerate(table_df.iterrows(), start=1):
            for c_i in range(cols_cnt):
                cell = tbl.cell(r_i, c_i)
                cell.text = _safe_str(row.iloc[c_i])[:28]
                cell.text_frame.paragraphs[0].font.size = PptPt(10)

    # Slide 3: Visual Chart Slide
    s3 = prs.slides.add_slide(blank_layout)
    h3 = s3.shapes.add_textbox(Inches(0.7), Inches(0.45), Inches(11.8), Inches(0.7))
    hp3 = h3.text_frame.paragraphs[0]
    hp3.text = "Quantitative Distribution & Chart Analysis"
    hp3.font.size = PptPt(24)
    hp3.font.bold = True
    chart_png = _create_chart_png(df, title, tmp_dir / f"{out_path.stem}_chart.png")
    if chart_png and chart_png.exists():
        s3.shapes.add_picture(str(chart_png), Inches(0.8), Inches(1.3), width=Inches(11.5))

    # Slide 4: Insights, Architecture & Conclusion
    s4 = prs.slides.add_slide(blank_layout)
    h4 = s4.shapes.add_textbox(Inches(0.7), Inches(0.45), Inches(11.8), Inches(0.7))
    hp4 = h4.text_frame.paragraphs[0]
    hp4.text = "Key Operational Insights & Recommendations"
    hp4.font.size = PptPt(24)
    hp4.font.bold = True

    body = s4.shapes.add_textbox(Inches(0.8), Inches(1.4), Inches(11.6), Inches(5.4))
    btf = body.text_frame
    btf.word_wrap = True
    lines = [
        f"1. Primary Audit Findings: {rag_notes[:350]}",
        "2. 10-Minute SLA Governance: Maintain OD Picking under 2:00 min at Tiptur HUB - KA44 across staging racks B7, H2, D5, T1, S4.",
        "3. Inventory Continuity: Prioritize immediate replenishment on below-ROP SKUs identified in this run.",
        f"4. Executed Read-Only Query: {sql_used}",
        "5. Conclusion: Audit-X unifies relational SQL accuracy with Hybrid RAG governance for real-time dark store profitability.",
    ]
    for idx, line in enumerate(lines):
        para = btf.paragraphs[0] if idx == 0 else btf.add_paragraph()
        para.text = line
        para.font.size = PptPt(15)
        para.space_after = PptPt(12)

    prs.save(str(out_path))
    return {
        "type": "pptx",
        "slides": [
            "1. Title & Audit-X Dark Store Overview",
            "2. Executive KPIs & Top Tabular Snapshot",
            "3. Quantitative Bar Chart Analysis",
            "4. Operational Insights, SQL & Conclusion",
        ],
        "columns": list(df.columns),
        "rows": df.head(6).to_dict(orient="records"),
    }


def _build_pdf(
    out_path: Path,
    title: str,
    topic: str,
    df: pd.DataFrame,
    sql_used: str,
    rag_notes: str,
) -> dict[str, Any]:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "AuditTitle",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "AuditMeta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14,
    )
    section_style = ParagraphStyle(
        "AuditSection",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#065f46"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "AuditBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=8,
    )

    kpis = _compute_kpis(df, topic)
    kpi_text = "  |  ".join(f"<b>{k}:</b> {v}" for k, v in kpis)

    story = [
        Paragraph(f"Audit-X Warehouse Intelligence Report — {title}", title_style),
        Paragraph(
            f"Generated by Audit-X Assistant | Hub: Tiptur HUB KA44 & Network | {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            meta_style,
        ),
        Paragraph(kpi_text, body_style),
        Spacer(1, 8),
        Paragraph("Executive Context & Grounded Insights", section_style),
        Paragraph(rag_notes.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")[:900], body_style),
        Paragraph("Verified Relational Query Output", section_style),
    ]

    if not df.empty:
        sub = df.head(20)
        cols = list(sub.columns)[:6]
        table_data = [[c.replace("_", " ").title() for c in cols]]
        for _, row in sub.iterrows():
            table_data.append([_safe_str(row[c])[:28] for c in cols])

        tbl = Table(table_data, repeatRows=1)
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(tbl)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Audited Read-Only SQL Statement", section_style))
    story.append(Paragraph(f"<font face='Courier' size='8'>{sql_used}</font>", body_style))

    doc.build(story)
    return {
        "type": "pdf",
        "columns": list(df.columns),
        "rows": df.head(8).to_dict(orient="records"),
        "kpis": kpis,
    }


def _build_docx(
    out_path: Path,
    title: str,
    topic: str,
    df: pd.DataFrame,
    sql_used: str,
    rag_notes: str,
) -> dict[str, Any]:
    """Build academic/ops DOCX strictly adhering to Times New Roman, 14pt headings, 13pt body, 1.5x justified."""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt, RGBColor

    document = Document()
    normal_style = document.styles["Normal"]
    normal_style.font.name = "Times New Roman"
    normal_style.font.size = Pt(13)

    def add_heading_14pt(text: str) -> None:
        p = document.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.5
        run = p.add_run(text)
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(15, 23, 42)

    def add_body_13pt(text: str) -> None:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(13)

    add_heading_14pt(f"AUDIT-X PROJECT REPORT: {title.upper()}")
    add_body_13pt(
        "Submitted for BCA (Data Science) 5th Semester Academic Project at Kalpataru First Grade Science College, "
        f"Tiptur. Operational Focus: Dark Store Management & Audit-X Intelligence ({topic.replace('_', ' ').title()})."
    )

    add_heading_14pt("1. Executive Overview & Hybrid RAG Architecture")
    add_body_13pt(
        rag_notes
        + " Audit-X combines an unrestricted general intelligence mode with a strict citation-grounded Hybrid RAG pipeline "
        "(dense vectors + Okapi BM25 fused via Reciprocal Rank Fusion and Cross-Encoder reranking) and a read-only Text-to-SQL engine."
    )

    add_heading_14pt("2. Relational ER Summary & Live Data Snapshot")
    add_body_13pt(
        "All operational queries operate against 12 normalized tables: Darkstore, Staff, Customer, Product, Inventory, Rider, "
        "Order, Order_Item, Delivery, Demand_Forecast, Shrinkage_Dump_Log, and Rag_Query_Log."
    )

    if not df.empty:
        sub = df.head(15)
        cols = list(sub.columns)[:6]
        table = document.add_table(rows=1, cols=len(cols))
        table.style = "Table Grid"
        hdr_cells = table.rows[0].cells
        for i, col_name in enumerate(cols):
            hdr_cells[i].text = col_name.replace("_", " ").title()
            for r in hdr_cells[i].paragraphs[0].runs:
                r.bold = True
                r.font.name = "Times New Roman"
                r.font.size = Pt(11)
        for _, row in sub.iterrows():
            cells = table.add_row().cells
            for i, col_name in enumerate(cols):
                cells[i].text = _safe_str(row[col_name])
                for r in cells[i].paragraphs[0].runs:
                    r.font.name = "Times New Roman"
                    r.font.size = Pt(11)

    add_heading_14pt("3. Executed SQL Telemetry & Conclusion")
    add_body_13pt(f"Verified SQL Audit Query: {sql_used}")
    add_body_13pt(
        "Conclusion: By uniting sub-10-minute warehouse execution SLA tracking with automated demand forecasting, "
        "shrinkage monitoring, and citation-verified reporting, Audit-X delivers enterprise-grade transparency across dark store operations."
    )

    document.save(str(out_path))
    return {
        "type": "docx",
        "formatting": "Times New Roman | Headings 14pt | Body 13pt | 1.5 line spacing | Justified",
        "columns": list(df.columns),
        "rows": df.head(8).to_dict(orient="records"),
    }


def _build_xlsx(
    out_path: Path,
    title: str,
    topic: str,
    df: pd.DataFrame,
    sql_used: str,
) -> dict[str, Any]:
    """Build formatted multi-sheet Excel workbook with SUM/AVERAGE formulas and embedded BarChart."""
    import pandas as pd
    from openpyxl.chart import BarChart, Reference
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    kpis = _compute_kpis(df, topic)
    summary_df = pd.DataFrame(kpis, columns=["KPI Metric", "Value"])
    meta_df = pd.DataFrame(
        [
            {"Field": "Report Title", "Value": title},
            {"Field": "Topic", "Value": topic},
            {"Field": "Generated At", "Value": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
            {"Field": "SQL Query", "Value": sql_used},
        ]
    )

    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        summary_df.to_excel(writer, sheet_name="Executive_Summary", index=False)
        df.to_excel(writer, sheet_name="Detailed_Data", index=False)
        meta_df.to_excel(writer, sheet_name="Audit_Metadata", index=False)

        wb = writer.book
        header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True, size=11)

        for sheet_name in ("Executive_Summary", "Detailed_Data", "Audit_Metadata"):
            ws = wb[sheet_name]
            for cell in ws[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center")
            for col_idx, col_cells in enumerate(ws.columns, start=1):
                max_len = max((len(str(c.value or "")) for c in col_cells), default=10)
                ws.column_dimensions[get_column_letter(col_idx)].width = min(max(max_len + 4, 14), 42)

        # Add live Excel SUM / AVERAGE total row & embedded openpyxl BarChart on Detailed_Data
        ws_data = wb["Detailed_Data"]
        row_count = len(df)
        if row_count >= 1 and len(df.columns) >= 2:
            total_row = row_count + 2
            ws_data.cell(row=total_row, column=1, value="TOTAL / AVG").font = Font(bold=True)
            for c_idx, col_name in enumerate(df.columns, start=1):
                if pd.api.types.is_numeric_dtype(df[col_name]):
                    col_letter = get_column_letter(c_idx)
                    fn = "AVERAGE" if any(k in col_name for k in ("rate", "pct", "rating", "mins")) else "SUM"
                    formula_cell = ws_data.cell(row=total_row, column=c_idx, value=f"={fn}({col_letter}2:{col_letter}{row_count + 1})")
                    formula_cell.font = Font(bold=True, color="065F46")
                    formula_cell.number_format = "#,##0.00"

            numeric_col_indices = [
                i for i, c in enumerate(df.columns, start=1) if pd.api.types.is_numeric_dtype(df[c])
            ]
            if numeric_col_indices:
                chart = BarChart()
                chart.type = "col"
                chart.title = title
                chart.style = 10
                val_col = numeric_col_indices[-1]
                data_ref = Reference(ws_data, min_col=val_col, min_row=1, max_row=min(row_count + 1, 13))
                cats_ref = Reference(ws_data, min_col=1, min_row=2, max_row=min(row_count + 1, 13))
                chart.add_data(data_ref, titles_from_data=True)
                chart.set_categories(cats_ref)
                chart.height = 11
                chart.width = 20
                ws_data.add_chart(chart, f"{get_column_letter(len(df.columns) + 2)}2")

    return {
        "type": "xlsx",
        "sheets": ["Executive_Summary", "Detailed_Data", "Audit_Metadata"],
        "columns": list(df.columns),
        "rows": df.head(8).to_dict(orient="records"),
    }


def _build_csv(out_path: Path, df: pd.DataFrame) -> dict[str, Any]:
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    return {
        "type": "csv",
        "columns": list(df.columns),
        "rows": df.head(10).to_dict(orient="records"),
    }


def generate_report_artifact(
    prompt: str,
    file_format: str | None = None,
    topic: str | None = None,
    user_role: str | UserRole = UserRole.ADMIN,
    rag_context_summary: str = "",
    db_path: Path | None = None,
) -> GeneratedArtifact:
    """Query live DB via validated Text-to-SQL, build requested file, and register expiring URL."""
    settings = get_settings()
    role = normalize_role(user_role) if isinstance(user_role, str) else user_role
    inferred_fmt, inferred_topic = detect_file_request_spec(prompt)
    fmt = (file_format or inferred_fmt).lower().lstrip(".")
    chosen_topic = topic or inferred_topic

    sql_question = REPORT_QUERY_MAP.get(chosen_topic, REPORT_QUERY_MAP["sales"])
    sql_res: SQLQueryResult = run_nl_to_sql(sql_question, user_role=role, db_path=db_path)
    if sql_res.blocked_reason:
        raise PermissionError(sql_res.blocked_reason)

    import pandas as pd

    df = pd.DataFrame(sql_res.rows, columns=sql_res.columns) if sql_res.rows else pd.DataFrame(columns=sql_res.columns)
    file_id = uuid.uuid4().hex[:12]
    safe_topic = chosen_topic.replace(" ", "_")
    file_name = f"auditx_{safe_topic}_{file_id[:6]}.{fmt}"
    out_path = settings.generated_dir / file_name

    title = f"{chosen_topic.replace('_', ' ').title()} Report"
    rag_notes = (
        rag_context_summary.strip()
        or "Generated dynamically from live Audit-X relational database (TIPTUR-HUB-KA44, TUMKUR-HUB-KA06, ARSIKERE-HUB-KA13)."
    )

    if fmt == "pptx":
        preview = _build_pptx(out_path, title, chosen_topic, df, sql_res.sql, rag_notes, settings.generated_dir)
    elif fmt == "docx":
        preview = _build_docx(out_path, title, chosen_topic, df, sql_res.sql, rag_notes)
    elif fmt == "xlsx":
        preview = _build_xlsx(out_path, title, chosen_topic, df, sql_res.sql)
    elif fmt == "csv":
        preview = _build_csv(out_path, df)
    else:
        fmt = "pdf"
        file_name = f"auditx_{safe_topic}_{file_id[:6]}.pdf"
        out_path = settings.generated_dir / file_name
        preview = _build_pdf(out_path, title, chosen_topic, df, sql_res.sql, rag_notes)

    size_bytes = out_path.stat().st_size
    download_url, expires_ts = build_signed_download_url(file_id)
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    exp_iso = datetime.fromtimestamp(expires_ts, tz=timezone.utc).replace(microsecond=0).isoformat()

    with get_connection(db_path=db_path) as conn:
        conn.execute(
            "INSERT INTO Generated_File (file_id, file_name, file_format, file_path, size_bytes, report_topic, preview_json, created_by_role, created_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                file_id,
                file_name,
                fmt,
                str(out_path),
                size_bytes,
                chosen_topic,
                json.dumps(preview, ensure_ascii=False, default=str),
                role.value,
                now_iso,
                exp_iso,
            ),
        )
        conn.commit()

    return GeneratedArtifact(
        file_id=file_id,
        file_name=file_name,
        file_format=fmt,
        file_path=out_path,
        size_bytes=size_bytes,
        report_topic=chosen_topic,
        download_url=download_url,
        expires_at=exp_iso,
        sql_used=sql_res.sql,
        preview=preview,
    )

