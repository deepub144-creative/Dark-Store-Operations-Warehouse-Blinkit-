import React, { useState } from "react";
import { Download, Eye, EyeOff, FileSpreadsheet, FileText, Presentation, Table2 } from "lucide-react";
import { FileArtifactCard } from "../types/chat";

interface FileCardProps {
  file: FileArtifactCard;
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FileCard: React.FC<FileCardProps> = ({ file }) => {
  const [showPreview, setShowPreview] = useState(false);

  const Icon =
    file.file_format === "pptx"
      ? Presentation
      : file.file_format === "xlsx" || file.file_format === "csv"
      ? FileSpreadsheet
      : FileText;

  const badgeTone =
    file.file_format === "pptx"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : file.file_format === "xlsx" || file.file_format === "csv"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : file.file_format === "docx"
      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-400";

  const fullDownloadHref = file.download_url.startsWith("http")
    ? file.download_url
    : `${API_BASE}${file.download_url}`;

  const previewRows = file.preview?.rows || [];
  const previewCols = file.preview?.columns || [];

  return (
    <div className="my-3 overflow-hidden rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-secondary)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badgeTone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{file.file_name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="uppercase font-semibold">{file.file_format}</span>
              <span>•</span>
              <span>{formatBytes(file.size_bytes)}</span>
              <span>•</span>
              <span>Signed URL ready</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(file.preview?.slides || previewRows.length > 0 || file.preview?.sheets) && (
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showPreview ? "Hide preview" : "Preview"}</span>
            </button>
          )}
          <a
            href={fullDownloadHref}
            download={file.file_name}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {showPreview && file.preview && (
        <div className="border-t border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 text-xs">
          {file.preview.slides && (
            <div className="mb-2.5">
              <div className="mb-1 font-semibold text-[var(--text-secondary)]">Deck Slide Outline</div>
              <div className="flex flex-wrap gap-1.5">
                {file.preview.slides.map((s) => (
                  <span key={s} className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2 py-1 text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {file.preview.sheets && (
            <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Table2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Sheets: {file.preview.sheets.join(" • ")}</span>
            </div>
          )}

          {file.preview.formatting && (
            <div className="mb-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              Format spec: {file.preview.formatting}
            </div>
          )}

          {previewRows.length > 0 && previewCols.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border-soft)]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <tr>
                    {previewCols.slice(0, 6).map((c) => (
                      <th key={c} className="px-2.5 py-1.5 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 5).map((r, rIdx) => (
                    <tr key={rIdx} className="border-t border-[var(--border-soft)]">
                      {previewCols.slice(0, 6).map((c) => (
                        <td key={c} className="px-2.5 py-1.5 text-[var(--text-primary)]">
                          {String(r[c] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

