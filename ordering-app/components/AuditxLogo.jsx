"use client";

import Link from "next/link";

export default function AuditxLogo({ height = 32, href = null, style = {}, className = "" }) {
  const imgElement = (
    <img
      src="/auditx-logo.png"
      alt="AUDIT'X Dark Store Operations"
      height={height}
      className={className}
      style={{
        height: `${height}px`,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        filter: "drop-shadow(0 2px 8px rgba(217, 119, 6, 0.35))",
        transition: "transform 0.2s ease, filter 0.2s ease",
        ...style,
      }}
    />
  );

  if (href) {
    return (
      <Link href={href} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
        {imgElement}
      </Link>
    );
  }

  return imgElement;
}
