"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Returning users/friends remain signed in across days without needing to log in again
      try {
        const raw = localStorage.getItem("auditx_customer");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name && (parsed?.customerId || parsed?.email || parsed?.phone)) {
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
            alt="AUDIT'X"
            style={styles.heroBannerImg}
          />
        </div>

        {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

        <div style={styles.authContainer}>
          <GoogleAuthButton
            clientId={GOOGLE_CLIENT_ID}
            context="ordering"
            roleCode="CUSTOMER"
            variant="small-bar"
            size="medium"
            label="Sign in with Google"
            theme="light"
            onError={(msg) => setErrorMsg(msg)}
            onSuccess={() => {
              router.replace("/ordering");
            }}
          />
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
    padding: "20px 20px 24px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fafc",
    marginBottom: 18,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  heroBannerImg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
};
