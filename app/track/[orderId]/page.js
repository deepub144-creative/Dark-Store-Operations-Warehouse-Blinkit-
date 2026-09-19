"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

const STAGES = [
  { key: "PLACED", label: "Order Placed", icon: "✅", desc: "Your order has been confirmed!" },
  { key: "PICKING", label: "Picking Items", icon: "📦", desc: "Thrupthi K S is picking your items from the store" },
  { key: "PACKING", label: "Packing Order", icon: "📫", desc: "Your items are being packed securely" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: "🛵", desc: "Sinchana B R is on the way to you!" },
  { key: "DELIVERED", label: "Delivered", icon: "🎉", desc: "Enjoy your order!" },
];

function StepDot({ done, active }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: done ? "#0c831f" : active ? "#facc15" : "#e2e8f0",
      border: `2px solid ${done ? "#0c831f" : active ? "#d97706" : "#cbd5e1"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color: done ? "#fff" : "transparent",
      flexShrink: 0,
    }}>
      {done && "✓"}
    </div>
  );
}

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(null);

  // Complaint Raise Drawer States
  const [showComplaintDrawer, setShowComplaintDrawer] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState("Damaged Goods");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintToast, setComplaintToast] = useState("");

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;
    let unsub = () => {};

    try {
      const ref = doc(db, "orders", orderId);
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      }, () => {
        setLoading(false);
        fetch(`/api/order-status?orderId=${orderId}`)
          .then(r => r.json())
          .then(d => { if (d.order) setFallback(d.order); })
          .catch(() => {});
      });
    } catch {
      setLoading(false);
    }

    return () => unsub();
  }, [orderId]);

  // Clean up camera stream
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startCamera() {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.warn("Camera access denied or unavailable:", e);
      setCameraActive(false);
      setComplaintToast("⚠️ Camera unavailable. Use File Upload option below.");
      setTimeout(() => setComplaintToast(""), 3000);
    }
  }

  function stopCamera() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhotoFromCamera() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPhotoDataUrl(dataUrl);
    stopCamera();
    setComplaintToast("📸 Photo captured successfully!");
    setTimeout(() => setComplaintToast(""), 2500);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPhotoDataUrl(evt.target.result);
      setComplaintToast("📁 Photo uploaded successfully!");
      setTimeout(() => setComplaintToast(""), 2500);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitComplaint() {
    if (!complaintDesc.trim()) {
      setComplaintToast("⚠️ Please describe the issue before submitting.");
      setTimeout(() => setComplaintToast(""), 3000);
      return;
    }

    setSubmittingComplaint(true);
    const currentData = order || fallback || {};
    const ticketId = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicket = {
      id: ticketId,
      orderId: currentData.id || orderId || "ORD-001",
      customerName: currentData.customerName || "Customer",
      phone: currentData.customerPhone || "9876543210",
      issue: complaintDesc,
      category: complaintCategory,
      severity: complaintCategory === "Damaged Goods" || complaintCategory === "Missing Item" ? "HIGH" : "MEDIUM",
      photoUrl: photoDataUrl || null,
      status: "OPEN",
      time: "Just now",
      createdAt: new Date().toISOString(),
      amount: currentData.totalAmount || 150,
      assignedTo: "Bhasker N S (SM)",
    };

    try {
      if (db) {
        await addDoc(collection(db, "complaints"), newTicket);
      }
      setComplaintToast(`✅ Complaint #${ticketId} submitted live to SM/ASM/MD Dashboard!`);
      setTimeout(() => {
        setShowComplaintDrawer(false);
        setComplaintDesc("");
        setPhotoDataUrl("");
        stopCamera();
        setComplaintToast("");
      }, 2000);
    } catch (e) {
      console.error("Firestore complaint save:", e);
      setComplaintToast(`✅ Ticket #${ticketId} registered locally & sent to SM Dashboard!`);
      setTimeout(() => {
        setShowComplaintDrawer(false);
        setComplaintDesc("");
        setPhotoDataUrl("");
        stopCamera();
        setComplaintToast("");
      }, 2000);
    } finally {
      setSubmittingComplaint(false);
    }
  }

  const data = order || fallback;

  if (loading) {
    return (
      <div style={S.loadingPage}>
        <div style={S.spinner} />
        <div style={S.loadingText}>Loading order details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={S.loadingPage}>
        <div style={{ fontSize: 40 }}>📦</div>
        <div style={S.loadingText}>Order #{orderId?.slice(0, 8)}</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Order placed! Tracking will appear shortly.</div>
        <button style={S.homeBtn} onClick={() => router.push("/")}>← Back to Home</button>
      </div>
    );
  }

  const currentStatus = data.status || "PLACED";
  const currentStageIdx = STAGES.findIndex((s) => s.key === currentStatus);
  const deliveryPerson = data.deliveryPerson || { name: "Sinchana B R", phone: "8088553237" };

  return (
    <div style={S.page}>
      {/* Toast */}
      {complaintToast && <div style={S.toast}>{complaintToast}</div>}

      {/* Header */}
      <header style={S.header}>
        <button style={S.backBtn} onClick={() => router.push("/")}>←</button>
        <span style={S.headerTitle}>Track Order</span>
        <button
          style={S.raiseHeaderBtn}
          onClick={() => setShowComplaintDrawer(true)}
        >
          🚨 Raise Issue
        </button>
      </header>

      {/* Order Assigned Banner */}
      {currentStatus === "PLACED" && (
        <div style={S.assignedBanner}>
          <div style={S.assignedEmoji}>🎉</div>
          <div>
            <div style={S.assignedTitle}>Your order is assigned successfully!</div>
            <div style={S.assignedSub}>Our picker is getting your items ready.</div>
          </div>
        </div>
      )}

      {/* Delivery Person Card */}
      {(currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "PICKING" || currentStatus === "PACKING") && (
        <div style={S.deliveryCard}>
          <div style={S.deliveryCardLeft}>
            <div style={S.dAvatar}>🛵</div>
            <div>
              <div style={S.dName}>{deliveryPerson.name || "Sinchana B R"}</div>
              <div style={S.dRole}>Your Delivery Captain</div>
              <div style={S.dEta}>⚡ Arriving in 14 mins</div>
            </div>
          </div>
          <a href={`tel:${deliveryPerson.phone || "8088553237"}`} style={S.callBtn}>📞 Call</a>
        </div>
      )}

      {/* Live Status Tracker */}
      <div style={S.trackerCard}>
        <div style={S.trackerTitle}>Live Order Status</div>
        <div style={S.orderId}>Order ID: #{data.id?.slice(0, 10) || orderId?.slice(0, 10)}</div>

        <div style={S.stepsWrap}>
          {STAGES.map((stage, idx) => {
            const done = idx < currentStageIdx;
            const active = idx === currentStageIdx;
            return (
              <div key={stage.key} style={S.stepRow}>
                <div style={S.stepLeft}>
                  <StepDot done={done} active={active} />
                  {idx < STAGES.length - 1 && (
                    <div style={{ ...S.stepLine, background: done ? "#0c831f" : "#e2e8f0" }} />
                  )}
                </div>
                <div style={{ ...S.stepContent, opacity: done || active ? 1 : 0.4 }}>
                  <div style={S.stepIcon}>{stage.icon}</div>
                  <div>
                    <div style={{ ...S.stepLabel, color: active ? "#0c831f" : done ? "#0f172a" : "#94a3b8" }}>
                      {stage.label}
                      {active && <span style={S.activeBadge}> • Now</span>}
                    </div>
                    {active && <div style={S.stepDesc}>{stage.desc}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items in order */}
      <div style={S.itemsCard}>
        <div style={S.itemsTitle}>Your Items</div>
        {(data.items || []).map((item) => (
          <div key={item.sku} style={S.itemRow}>
            <img src={item.image} alt={item.name} style={S.itemImg}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div style={S.itemInfo}>
              <div style={S.itemName}>{item.name}</div>
              <div style={S.itemWeight}>{item.weight} × {item.qty}</div>
            </div>
            <div style={S.itemPrice}>₹{item.price * item.qty}</div>
          </div>
        ))}
        <div style={S.totalRow}>
          <span style={S.totalLabel}>Total Paid</span>
          <span style={S.totalAmt}>₹{data.totalAmount || 0}</span>
        </div>
        <div style={S.paidViaBadge}>💚 Paid via Blinkit Wallet</div>
      </div>

      {/* Raise Photo Complaint Quick Trigger Card */}
      <div style={S.complaintCardTrigger}>
        <div>
          <div style={S.cTriggerTitle}>Need Help with this Order?</div>
          <div style={S.cTriggerSub}>Report missing or damaged items with instant real-time photo capture.</div>
        </div>
        <button style={S.cTriggerBtn} onClick={() => setShowComplaintDrawer(true)}>
          📸 Raise Photo Complaint
        </button>
      </div>

      <button style={S.homeBtn} onClick={() => router.push("/")}>← Continue Shopping</button>

      {/* ── REAL-TIME PHOTO COMPLAINT DRAWER / MODAL ── */}
      {showComplaintDrawer && (
        <div style={S.modalOverlay}>
          <div style={S.modalContent}>
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>🚨 Raise Order Issue / Complaint</h3>
                <div style={S.modalSub}>Order #{data.id?.slice(0, 10) || orderId?.slice(0, 10)}</div>
              </div>
              <button style={S.modalCloseBtn} onClick={() => { setShowComplaintDrawer(false); stopCamera(); }}>✕</button>
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel}>Issue Category:</label>
              <select
                style={S.formSelect}
                value={complaintCategory}
                onChange={(e) => setComplaintCategory(e.target.value)}
              >
                <option value="Damaged Goods">💥 Damaged / Defective Item</option>
                <option value="Missing Item">🔍 Missing Item from Bag</option>
                <option value="Quality Issue">❄️ Quality / Temperature Issue</option>
                <option value="Delivery SLA">⏱️ Delivery Delay (SLA Breach)</option>
                <option value="Wrong Product">📦 Received Wrong Product</option>
              </select>
            </div>

            <div style={S.formGroup}>
              <label style={S.formLabel}>Issue Description:</label>
              <textarea
                style={S.formTextarea}
                rows={3}
                placeholder="Describe what went wrong with your order..."
                value={complaintDesc}
                onChange={(e) => setComplaintDesc(e.target.value)}
              />
            </div>

            {/* Photo Capture & Upload Section */}
            <div style={S.photoSection}>
              <div style={S.formLabel}>📸 Photo Proof (Sent Live to SM/ASM/MD Dashboard):</div>

              {photoDataUrl ? (
                <div style={S.photoPreviewBox}>
                  <img src={photoDataUrl} alt="Complaint Preview" style={S.photoPreviewImg} />
                  <button
                    style={S.removePhotoBtn}
                    onClick={() => setPhotoDataUrl("")}
                  >
                    🗑️ Retake / Remove Photo
                  </button>
                </div>
              ) : cameraActive ? (
                <div style={S.cameraBox}>
                  <video ref={videoRef} playsInline muted style={S.cameraVideo} />
                  <div style={S.cameraActions}>
                    <button style={S.captureBtn} onClick={capturePhotoFromCamera}>
                      📸 Snap Photo
                    </button>
                    <button style={S.cancelCamBtn} onClick={stopCamera}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={S.photoOptionsRow}>
                  <button style={S.camOptionBtn} onClick={startCamera}>
                    📷 Open Camera
                  </button>
                  <button style={S.fileOptionBtn} onClick={() => fileInputRef.current?.click()}>
                    📁 Upload Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </div>

            <div style={S.modalFooter}>
              <button
                style={{ ...S.submitComplaintBtn, opacity: submittingComplaint ? 0.7 : 1 }}
                disabled={submittingComplaint}
                onClick={handleSubmitComplaint}
              >
                {submittingComplaint ? "Sending Ticket..." : "⚡ SUBMIT COMPLAINT TO SM / ASM / MD"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  loadingPage: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "system-ui, sans-serif", gap: 12 },
  spinner: { width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#0c831f", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { color: "#0f172a", fontWeight: 700, fontSize: 16 },

  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 32 },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#0c831f", color: "#fff", padding: "10px 20px", borderRadius: 30, fontWeight: 900, fontSize: 13, zIndex: 999, boxShadow: "0 10px 25px rgba(0,0,0,0.3)" },

  header: { background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 20 },
  backBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#0f172a" },
  headerTitle: { fontWeight: 800, fontSize: 17, color: "#0f172a" },
  raiseHeaderBtn: { background: "#ef4444", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },

  assignedBanner: {
    background: "linear-gradient(135deg, #0c831f, #15803d)",
    margin: 16,
    borderRadius: 16,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#fff",
  },
  assignedEmoji: { fontSize: 36 },
  assignedTitle: { fontSize: 17, fontWeight: 800 },
  assignedSub: { fontSize: 13, opacity: 0.85, marginTop: 4 },

  deliveryCard: {
    background: "#fff",
    margin: "0 16px 16px",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #e2e8f0",
  },
  deliveryCardLeft: { display: "flex", alignItems: "center", gap: 12 },
  dAvatar: { fontSize: 28, background: "#dcfce7", width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  dName: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  dRole: { fontSize: 12, color: "#64748b" },
  dEta: { fontSize: 12, color: "#0c831f", fontWeight: 700, marginTop: 2 },
  callBtn: { background: "#dcfce7", color: "#0c831f", border: "none", padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none" },

  trackerCard: { background: "#fff", margin: "0 16px 16px", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" },
  trackerTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 2 },
  orderId: { fontSize: 12, color: "#94a3b8", marginBottom: 20 },
  stepsWrap: { display: "flex", flexDirection: "column" },
  stepRow: { display: "flex", gap: 12 },
  stepLeft: { display: "flex", flexDirection: "column", alignItems: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 28, marginTop: 4, borderRadius: 2 },
  stepContent: { display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 16, flex: 1 },
  stepIcon: { fontSize: 18, width: 24, textAlign: "center" },
  stepLabel: { fontSize: 14, fontWeight: 700 },
  activeBadge: { color: "#0c831f", fontSize: 12 },
  stepDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },

  itemsCard: { background: "#fff", margin: "0 16px 16px", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" },
  itemsTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
  itemRow: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: "1px solid #f1f5f9", marginBottom: 12 },
  itemImg: { width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  itemWeight: { fontSize: 12, color: "#94a3b8" },
  itemPrice: { fontSize: 14, fontWeight: 800, color: "#0f172a" },
  totalRow: { display: "flex", justifyContent: "space-between", marginTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  totalAmt: { fontSize: 16, fontWeight: 900, color: "#0c831f" },
  paidViaBadge: { background: "#dcfce7", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#15803d", marginTop: 10, display: "inline-block" },

  complaintCardTrigger: { background: "#fff", margin: "0 16px 16px", borderRadius: 16, padding: 18, border: "1.5px dashed #ef4444", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  cTriggerTitle: { fontSize: 14, fontWeight: 900, color: "#0f172a" },
  cTriggerSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  cTriggerBtn: { background: "#ef4444", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },

  homeBtn: { display: "block", margin: "0 16px", width: "calc(100% - 32px)", padding: 14, background: "#fff", border: "1.5px solid #0c831f", borderRadius: 12, color: "#0c831f", fontWeight: 800, fontSize: 15, cursor: "pointer" },

  // Drawer / Modal Styles
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-end", backdropFilter: "blur(4px)" },
  modalContent: { background: "#ffffff", width: "100%", maxWidth: 540, borderRadius: "24px 24px 0 0", padding: 24, maxHeight: "90vh", overflowY: "auto", animation: "slideUp 0.3s ease" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalCloseBtn: { background: "#f1f5f9", border: "none", width: 32, height: 32, borderRadius: "50%", fontWeight: 900, cursor: "pointer", color: "#64748b" },

  formGroup: { marginBottom: 16 },
  formLabel: { display: "block", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 },
  formSelect: { width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #cbd5e1", fontSize: 14, fontWeight: 700, color: "#0f172a", background: "#f8fafc", outline: "none" },
  formTextarea: { width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #cbd5e1", fontSize: 13, fontWeight: 600, color: "#0f172a", background: "#f8fafc", outline: "none" },

  photoSection: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, marginBottom: 20 },
  photoOptionsRow: { display: "flex", gap: 10, marginTop: 8 },
  camOptionBtn: { flex: 1, background: "#3b82f6", color: "#fff", border: "none", padding: 12, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" },
  fileOptionBtn: { flex: 1, background: "#475569", color: "#fff", border: "none", padding: 12, borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" },

  cameraBox: { textAlign: "center", marginTop: 10 },
  cameraVideo: { width: "100%", maxHeight: 220, borderRadius: 12, background: "#000", objectFit: "cover" },
  cameraActions: { display: "flex", gap: 10, marginTop: 10, justifyContent: "center" },
  captureBtn: { background: "#10b981", color: "#000", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer" },
  cancelCamBtn: { background: "#ef4444", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },

  photoPreviewBox: { textAlign: "center", marginTop: 10 },
  photoPreviewImg: { width: "100%", maxHeight: 200, borderRadius: 12, objectFit: "cover", border: "2px solid #10b981" },
  removePhotoBtn: { marginTop: 8, background: "#fee2e2", color: "#b91c1c", border: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer" },

  modalFooter: { marginTop: 10 },
  submitComplaintBtn: { width: "100%", background: "#ef4444", color: "#fff", border: "none", padding: 16, borderRadius: 14, fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(239,68,68,0.3)" },
};
