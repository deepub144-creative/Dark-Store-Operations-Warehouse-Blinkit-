import React, { useEffect, useId, useState } from "react";
import { Check, Copy } from "lucide-react";

let shikiPromise: Promise<typeof import("shiki")> | null = null;
let mermaidPromise: Promise<typeof import("mermaid")> | null = null;

interface CodeBlockProps {
  language: string;
  code: string;
  theme: "light" | "dark";
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, theme }) => {
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (!shikiPromise) shikiPromise = import("shiki");
    shikiPromise
      .then((shiki) =>
        shiki.codeToHtml(code, {
          lang: language || "text",
          theme: theme === "dark" ? "github-dark" : "github-light",
        })
      )
      .then((html) => {
        if (active) setHighlightedHtml(html);
      })
      .catch(() => {
        if (active) setHighlightedHtml("");
      });
    return () => {
      active = false;
    };
  }, [code, language, theme]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
        <span className="font-mono uppercase">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      {highlightedHtml ? (
        <div
          className="overflow-x-auto p-3 text-xs [&>pre]:!bg-transparent [&>pre]:!m-0 [&>pre]:font-mono"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-xs text-[var(--text-primary)]">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

interface MermaidBlockProps {
  chart: string;
  theme: "light" | "dark";
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ chart, theme }) => {
  const uid = useId().replace(/[:]/g, "_");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!mermaidPromise) mermaidPromise = import("mermaid");
    mermaidPromise
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "loose",
        });
        const rendered = await mermaid.render(`ax_mmd_${uid}`, chart);
        if (active) {
          setSvg(rendered.svg);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [chart, theme, uid]);

  if (error || !svg) {
    return <CodeBlock language="mermaid" code={chart} theme={theme} />;
  }

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Architecture / ER Diagram
      </div>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

