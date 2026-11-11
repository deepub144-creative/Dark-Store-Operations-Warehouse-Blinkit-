"use client";

import React from "react";
import { reportCrash } from "@/lib/safeData";

export function RouteErrorFallback({
  title = "Something hit a snag",
  subtitle = "We protected your session and saved your progress. Tap below to try again.",
  onRetry = null,
  compact = false,
}) {
  return (
    <div
      role="alert"
      style={{
        minHeight: compact ? "auto" : "100dvh",
        width: "100%",
        display: "grid",
        placeItems: "center",
        padding: compact ? "14px" : "24px",
        background: compact ? "transparent" : "var(--ios-bg, #F2F2F7)",
        color: "var(--ios-label, #111827)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        className="ios-card"
        style={{
          width: "100%",
          maxWidth: compact ? "100%" : 360,
          background: "var(--ios-card, #FFFFFF)",
          border: "1px solid var(--ios-sep, #E5E7EB)",
          borderRadius: compact ? 16 : 22,
          padding: compact ? "16px" : "24px 20px",
          textAlign: "center",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div style={{ fontSize: compact ? 24 : 34, marginBottom: 8 }} aria-hidden="true">
          ⚡
        </div>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: compact ? 15 : 18,
            fontWeight: 800,
            color: "var(--ios-label, #111827)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: compact ? 12.5 : 13.5,
            lineHeight: 1.45,
            color: "var(--ios-label-2, #6B7280)",
          }}
        >
          {subtitle}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {typeof onRetry === "function" && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                flex: 1,
                minHeight: compact ? 40 : 46,
                borderRadius: 999,
                border: "none",
                background: "#0C831F",
                color: "#FFFFFF",
                fontSize: compact ? 13 : 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              flex: 1,
              minHeight: compact ? 40 : 46,
              borderRadius: 999,
              border: "1.5px solid var(--ios-sep, #D1D5DB)",
              background: "var(--ios-card, #FFFFFF)",
              color: "var(--ios-label, #111827)",
              fontSize: compact ? 13 : 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportCrash(error, {
      source: this.props.label || "ErrorBoundary",
      componentStack: info?.componentStack ? info.componentStack.slice(0, 240) : "",
    });
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, info);
      } catch {}
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
    if (typeof this.props.onRetry === "function") {
      try {
        this.props.onRetry();
      } catch {}
    }
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({ retry: this.handleRetry });
      }
      return (
        <RouteErrorFallback
          title={
            this.props.title ||
            (this.props.label ? `${this.props.label} paused briefly` : "Something interrupted this view")
          }
          subtitle={
            this.props.subtitle ||
            "Your cart, tasks, and order data are safe. Tap below to restore this section."
          }
          onRetry={this.handleRetry}
          compact={Boolean(this.props.compact)}
        />
      );
    }

    return (
      <React.Fragment key={this.state.retryCount}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export function lazyWithRetry(importer, retries = 2) {
  return React.lazy(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}
