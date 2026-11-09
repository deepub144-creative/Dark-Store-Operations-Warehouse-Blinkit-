"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      // If already signed in, immediately return to main ordering catalog
      try {
        const raw = localStorage.getItem("auditx_customer");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name && parsed?.email) {
            router.replace("/ordering");
            return;
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, [router]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 3D Bronze Metallic AUDIT'X Banner */}
        <div style={styles.heroBannerWrap}>
          <img
            src="/login-assets/Gemini_Generated_Image_62g03s62g03s62g0.png"
            alt="AUDIT'X - Precision Beyond Limits"
            style={styles.heroBannerImg}
          />
        </div>

        {/* Brand & Hub Info */}
        <div style={styles.headerBlock}>
          <div style={styles.hubBadge}>
            <span style={{ fontSize: 13 }}>📍</span>
            <span>TIPTUR HUB KA-44 • DARK STORE</span>
          </div>
        </div>

        <div style={styles.authContainer}>
          {/* OFFICIAL GOOGLE SIGN IN BUTTON */}
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <GoogleAuthButton
              clientId={GOOGLE_CLIENT_ID}
              context="ordering"
              roleCode="CUSTOMER"
              variant="small-bar"
              size="medium"
              label="Sign in with Google"
              theme="light"
              onSuccess={() => {
                router.replace("/ordering");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #090e17 0%, #111827 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#ffffff",
    borderRadius: 22,
    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
    padding: "20px 20px 22px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fafc",
    marginBottom: 14,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  heroBannerImg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  headerBlock: {
    textAlign: "center",
    marginBottom: 10,
  },
  hubBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 20,
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    fontSize: 10.5,
    fontWeight: 800,
    color: "#334155",
    letterSpacing: "0.05em",
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
  },
};
