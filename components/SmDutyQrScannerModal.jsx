"use client";

import { useEffect, useRef, useState } from "react";
import { playScanSuccess, playScanFail } from "@/lib/soundSystem";

export default function SmDutyQrScannerModal({
  roleName = "OD Picker",
  staffName = "Thrupthi K S",
  onSuccess,
  onClose,
}) {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const isProcessingRef = useRef(false);

  const EXPECTED_PAYLOAD = "AUDITX-DUTY-TIPTUR-KA44-STATION";

  useEffect(() => {
    let stream = null;
    let animId = null;

    async function initCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }

        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
          const loop = async () => {
            if (videoRef.current && videoRef.current.readyState === 4 && !isProcessingRef.current) {
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes && codes.length > 0) {
                  const val = codes[0].rawValue;
                  if (val.includes(EXPECTED_PAYLOAD) || val.includes("AUDITX-DUTY") || val.includes("KA44")) {
                    handleScanSuccess(val);
                    return;
                  }
                }
              } catch (e) {}
            }
            animId = requestAnimationFrame(loop);
          };
          animId = requestAnimationFrame(loop);
        }
      } catch (err) {
        console.warn("Camera init error:", err);
        setCameraError("Camera unavailable or permission denied. Use the Instant Scan button below!");
      }
    }

    initCamera();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function handleScanSuccess(scannedCode) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    playScanSuccess();
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch (e) {}

    setTimeout(() => {
      onSuccess?.(scannedCode || EXPECTED_PAYLOAD);
    }, 350);
  }

  return (
    <div style={M.overlay}>
      <div style={M.modalBox}>
        {/* Header */}
        <div style={M.header}>
          <div>
            <div style={M.badge}>SM DUTY SHIFT VERIFICATION</div>
            <h3 style={M.title}>Scan SM Dashboard QR Code</h3>
            <p style={M.sub}>
              {staffName} ({roleName}) • Tiptur Hub KA44
            </p>
          </div>
          <button style={M.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Video / Camera View */}
        <div style={M.cameraContainer}>
          <video ref={videoRef} playsInline autoPlay muted style={M.video} />

          {/* Reticle HUD overlay */}
          <div style={M.reticleBox}>
            <div style={M.reticleFrame}>
              <div style={M.laserLine} />
              <div style={M.cornerTL} />
              <div style={M.cornerTR} />
              <div style={M.cornerBL} />
              <div style={M.cornerBR} />
            </div>
            <div style={M.targetHint}>
              Point at SM Dashboard Station QR Code
            </div>
          </div>
        </div>

        {cameraError && <div style={M.errorNotice}>{cameraError}</div>}

        {/* Station Info Payload */}
        <div style={M.stationInfoCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/duty-qr.png"
              alt="SM QR Code"
              style={{ width: 42, height: 42, borderRadius: 6, objectFit: "contain", background: "#ffffff", padding: 2 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b" }}>
                FIXED SHIFT DUTY STATION
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", fontFamily: "monospace" }}>
                {EXPECTED_PAYLOAD}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={M.actionsRow}>
          <button
            type="button"
            style={M.instantScanBtn}
            onClick={() => handleScanSuccess(EXPECTED_PAYLOAD)}
          >
            ⚡ Instant Scan SM Station QR Code
          </button>
        </div>
      </div>
    </div>
  );
}

const M = {
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(8, 12, 20, 0.92)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backdropFilter: "blur(6px)",
  },
  modalBox: {
    background: "#0f172a",
    border: "1.5px solid #334155",
    borderRadius: 18,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "16px 16px 12px",
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    borderBottom: "1px solid #334155",
  },
  badge: {
    fontSize: 9.5,
    fontWeight: 900,
    color: "#f59e0b",
    letterSpacing: "0.5px",
    marginBottom: 2,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: "#ffffff",
  },
  sub: {
    margin: "2px 0 0",
    fontSize: 11.5,
    color: "#94a3b8",
  },
  closeBtn: {
    background: "#1e293b",
    border: "1px solid #475569",
    color: "#ffffff",
    width: 28,
    height: 28,
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraContainer: {
    position: "relative",
    width: "100%",
    height: 240,
    background: "#000000",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  reticleBox: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  reticleFrame: {
    width: 170,
    height: 170,
    border: "2px dashed rgba(16, 185, 129, 0.7)",
    borderRadius: 12,
    position: "relative",
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
  },
  laserLine: {
    position: "absolute",
    left: 4,
    right: 4,
    top: "50%",
    height: 2,
    background: "#10b981",
    boxShadow: "0 0 10px #10b981",
  },
  cornerTL: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 16,
    height: 16,
    borderTop: "3px solid #10b981",
    borderLeft: "3px solid #10b981",
  },
  cornerTR: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderTop: "3px solid #10b981",
    borderRight: "3px solid #10b981",
  },
  cornerBL: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 16,
    height: 16,
    borderBottom: "3px solid #10b981",
    borderLeft: "3px solid #10b981",
  },
  cornerBR: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderBottom: "3px solid #10b981",
    borderRight: "3px solid #10b981",
  },
  targetHint: {
    marginTop: 10,
    fontSize: 11,
    color: "#ffffff",
    fontWeight: 700,
    background: "rgba(0,0,0,0.75)",
    padding: "3px 10px",
    borderRadius: 12,
    letterSpacing: "0.3px",
  },
  errorNotice: {
    background: "rgba(245, 158, 11, 0.15)",
    borderBottom: "1px solid #f59e0b",
    color: "#fde68a",
    fontSize: 11,
    padding: "6px 12px",
    textAlign: "center",
  },
  stationInfoCard: {
    padding: "10px 14px",
    background: "#1e293b",
    borderTop: "1px solid #334155",
    borderBottom: "1px solid #334155",
  },
  actionsRow: {
    padding: 14,
  },
  instantScanBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    border: "none",
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
  },
};

