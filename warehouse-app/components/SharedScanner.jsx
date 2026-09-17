"use client";

import { useEffect, useRef, useState } from "react";
import { playScanSuccess, playScanFail } from "@/lib/soundSystem";

export default function SharedScanner({
  onScanSuccess,
  expectedCode = null,
  title = "Camera Scanner",
  subtitle = "Align QR/Barcode inside the green frame",
  demoItems = [],
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [flashState, setFlashState] = useState(null); // 'success' | 'fail' | null
  const [manualCodeInput, setManualCodeInput] = useState("");
  const isProcessingRef = useRef(false);

  // Initialize Camera
  useEffect(() => {
    let stream = null;
    let animFrameId = null;

    async function startCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
          startScanLoop();
        }
      } catch (err) {
        console.warn("Camera access failed:", err);
        setCameraError("Camera unavailable or permission denied. Use Quick Demo Scan below!");
        setCameraActive(false);
      }
    }

    function startScanLoop() {
      // Check if native BarcodeDetector API is supported
      if ("BarcodeDetector" in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "code_39", "upc_a"],
        });

        const scanFrame = async () => {
          if (videoRef.current && videoRef.current.readyState === 4 && !isProcessingRef.current) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                handleCodeDetected(detectedVal);
              }
            } catch (e) {
              // Ignore scan frame error
            }
          }
          animFrameId = requestAnimationFrame(scanFrame);
        };
        scanFrame();
      } else {
        // Fallback: simple canvas scan loop
        const scanCanvas = () => {
          // Keep loop alive for manual fallback or barcode detection
          animFrameId = requestAnimationFrame(scanCanvas);
        };
        scanCanvas();
      }
    }

    startCamera();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Handle Detected Code
  function handleCodeDetected(code) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Check against expectedCode if specified
    if (expectedCode && !code.toLowerCase().includes(expectedCode.toLowerCase())) {
      playScanFail();
      setFlashState("fail");
      setTimeout(() => {
        setFlashState(null);
        isProcessingRef.current = false;
      }, 1200);
      return;
    }

    // Success!
    playScanSuccess();
    setFlashState("success");
    setTimeout(() => {
      setFlashState(null);
      isProcessingRef.current = false;
      if (onScanSuccess) onScanSuccess(code);
    }, 600);
  }

  // Handle Manual Demo Scan Tap
  function handleDemoSelect(itemCode) {
    handleCodeDetected(itemCode);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCodeInput.trim()) {
      handleCodeDetected(manualCodeInput.trim());
      setManualCodeInput("");
    }
  }

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titleRow}>
          <span style={S.camIcon}>📷</span>
          <span style={S.title}>{title}</span>
          <span style={{ ...S.statusBadge, background: cameraActive ? "#10b981" : "#f59e0b" }}>
            {cameraActive ? "LIVE CAMERA" : "DEMO SCAN MODE"}
          </span>
        </div>
        <div style={S.subtitle}>{subtitle}</div>
      </div>

      {/* Viewfinder Area */}
      <div style={S.viewfinderWrap}>
        <video ref={videoRef} playsInline muted style={S.video} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Overlay Graphic */}
        <div style={S.overlayFrame}>
          <div style={S.cornerTL} />
          <div style={S.cornerTR} />
          <div style={S.cornerBL} />
          <div style={S.cornerBR} />
          <div style={S.scanLine} />
        </div>

        {/* Camera Fallback Banner */}
        {cameraError && (
          <div style={S.errorBanner}>
            <div>⚠️ {cameraError}</div>
          </div>
        )}

        {/* Flash Overlay */}
        {flashState === "success" && (
          <div style={S.successFlash}>
            <div style={S.flashIcon}>✅</div>
            <div style={S.flashText}>SCAN SUCCESS!</div>
          </div>
        )}
        {flashState === "fail" && (
          <div style={S.failFlash}>
            <div style={S.flashIcon}>❌</div>
            <div style={S.flashText}>MISMATCH / FAIL - RETRY!</div>
          </div>
        )}
      </div>

      {/* Quick Demo Scan Barcode Selector */}
      <div style={S.demoScanSection}>
        <div style={S.demoHeader}>⚡ Quick Demo Codes (Click to Scan Instantly):</div>
        {demoItems && demoItems.length > 0 ? (
          <div style={S.demoGrid}>
            {demoItems.map((item, idx) => (
              <button
                key={idx}
                style={S.demoBtn}
                onClick={() => handleDemoSelect(item.code || item.qrCode || item.barcode || item.id)}
              >
                <span style={S.demoBtnName}>{item.name || item.title || item.id}</span>
                <span style={S.demoBtnCode}>[{item.code || item.qrCode || item.barcode || item.id}]</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} style={S.manualForm}>
            <input
              type="text"
              style={S.manualInput}
              placeholder="Enter or paste SKU / Order barcode..."
              value={manualCodeInput}
              onChange={(e) => setManualCodeInput(e.target.value)}
            />
            <button type="submit" style={S.manualBtn}>
              Scan Code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const S = {
  container: { background: "#0c0c0c", borderRadius: 16, padding: 16, color: "#fff", border: "2px solid #f8cb46" },
  header: { marginBottom: 12 },
  titleRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  camIcon: { fontSize: 20 },
  title: { fontSize: 16, fontWeight: 900, color: "#f8cb46" },
  statusBadge: { fontSize: 10, fontWeight: 800, color: "#000", padding: "2px 8px", borderRadius: 10 },
  subtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  viewfinderWrap: { position: "relative", width: "100%", height: 240, background: "#18181b", borderRadius: 12, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" },
  video: { width: "100%", height: "100%", objectFit: "cover" },

  overlayFrame: { position: "absolute", top: "15%", left: "15%", right: "15%", bottom: "15%", border: "2px dashed #f8cb46", borderRadius: 12, pointerEvents: "none" },
  cornerTL: { position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTop: "4px solid #10b981", borderLeft: "4px solid #10b981" },
  cornerTR: { position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTop: "4px solid #10b981", borderRight: "4px solid #10b981" },
  cornerBL: { position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottom: "4px solid #10b981", borderLeft: "4px solid #10b981" },
  cornerBR: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottom: "4px solid #10b981", borderRight: "4px solid #10b981" },
  scanLine: { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#10b981", boxShadow: "0 0 12px #10b981", animation: "scanAnim 2s infinite linear" },

  errorBanner: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20, textAlign: "center", color: "#f87171", fontWeight: 700, fontSize: 13 },
  successFlash: { position: "absolute", inset: 0, background: "rgba(16, 185, 129, 0.92)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#fff" },
  failFlash: { position: "absolute", inset: 0, background: "rgba(239, 68, 68, 0.92)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#fff" },
  flashIcon: { fontSize: 44 },
  flashText: { fontSize: 18, fontWeight: 900, marginTop: 8 },

  demoScanSection: { marginTop: 14, background: "#18181b", padding: 12, borderRadius: 10 },
  demoHeader: { fontSize: 12, fontWeight: 800, color: "#f8cb46", marginBottom: 8 },
  demoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 },
  demoBtn: { background: "#27272a", border: "1px solid #3f3f46", color: "#fff", borderRadius: 8, padding: "8px 10px", fontSize: 11, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start" },
  demoBtnName: { fontWeight: 800, color: "#f8fafc" },
  demoBtnCode: { fontSize: 9, color: "#a1a1aa", marginTop: 2 },

  manualForm: { display: "flex", gap: 8 },
  manualInput: { flex: 1, background: "#27272a", border: "1px solid #3f3f46", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12 },
  manualBtn: { background: "#f8cb46", color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer" },
};
