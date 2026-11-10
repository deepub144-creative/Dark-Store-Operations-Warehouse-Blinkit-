import React from "react";
import {
  Activity,
  GraduationCap,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { AnswerMode, HealthInfo, UserRole } from "../types/chat";

interface HeaderBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  mode: AnswerMode;
  onModeChange: (m: AnswerMode) => void;
  vivaMode: boolean;
  onToggleViva: () => void;
  userRole: UserRole;
  onRoleChange: (r: UserRole) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  health: HealthInfo | null;
}

const MODE_OPTIONS: { id: AnswerMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "general", label: "General" },
  { id: "rag", label: "Project RAG" },
  { id: "sql", label: "SQL" },
  { id: "file", label: "File" },
];

const ROLES: UserRole[] = ["Admin", "Store Staff", "Rider", "Customer"];

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onToggleSidebar,
  mode,
  onModeChange,
  vivaMode,
  onToggleViva,
  userRole,
  onRoleChange,
  theme,
  onToggleTheme,
  inspectorOpen,
  onToggleInspector,
  health,
}) => {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--bg-primary)]/90 px-3 py-2.5 backdrop-blur-md md:px-5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg border border-[var(--border-soft)] p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          aria-label="Toggle sidebar"
          title="Toggle chat history"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 font-bold text-emerald-500">
            AX
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <span>Audit-X Assistant</span>
              {health && (
                <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-block">
                  {health.indexed_chunks} chunks indexed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Answer Mode Switcher */}
        <div
          className="hidden items-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-0.5 sm:flex"
          role="group"
          aria-label="Answer mode"
        >
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onModeChange(opt.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                mode === opt.id
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Viva / Deep Academic Toggle */}
        <button
          type="button"
          onClick={onToggleViva}
          title="Explain like a viva / Deep academic mode"
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
            vivaMode
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Viva Mode</span>
        </button>

        {/* RBAC Role Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2 py-1 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <select
            value={userRole}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            aria-label="Active RBAC Role"
            className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Pipeline Inspector */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
            inspectorOpen
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="Open Academic Pipeline Inspector"
        >
          <Activity className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Inspector</span>
        </button>

        {/* System / Dark / Light Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};

