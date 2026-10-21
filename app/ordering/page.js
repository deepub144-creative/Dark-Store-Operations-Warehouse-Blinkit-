"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";
import { broadcastEvent, subscribeToEvents } from "@/lib/realtimeSync";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";

const WALLET_LIMIT = 1000000;

export default function OrderingAppPage() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Namma Tiptur KA 44 (Tumkur Dist, KA - 572201)");
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'cart' | 'categories' | 'profile'
  const [oosList, setOosList] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 1. Load customer profile
    const raw = localStorage.getItem("auditx_customer") || localStorage.getItem("blinkit_customer");
    if (!raw) {
      const demoCust = {
        customerId: "cust_tiptur_demo",
        name: "Ramesh Gowda",
        phone: "9845112233",
        location: "Near Kalpataru College, Namma Tiptur - 572201",
        walletBalance: 999850,
      };
      localStorage.setItem("auditx_customer", JSON.stringify(demoCust));
      localStorage.setItem("blinkit_customer", JSON.stringify(demoCust));
      setCustomer(demoCust);
    } else {
      setCustomer(JSON.parse(raw));
    }

    // 2. Load out-of-stock items marked by ASM Deepu B
    const rawOos = localStorage.getItem("auditx_oos_items");
    if (rawOos) {
      try {
        setOosList(JSON.parse(rawOos));
      } catch (e) {
        console.warn(e);
      }
    }

    // 3. Subscribe to real-time events (e.g. ASM marks item OOS)
    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "ITEM_STOCK_TOGGLED" && data.payload) {
        if (!data.payload.inStock) {
          setOosList((prev) => [...new Set([...prev, data.payload.sku])]);
          triggerToast(`⚠️ ASM Deepu B updated: "${data.payload.name}" is now Out of Stock.`);
        } else {
          setOosList((prev) => prev.filter((s) => s !== data.payload.sku));
          triggerToast(`🟢 "${data.payload.name}" is back in stock at Tiptur HUB!`);
        }
      }
    });

    const timer = setTimeout(() => setLoading(false), 300);
    return () => {
      clearTimeout(timer);
      unsubBus();
    };
  }, []);

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  function updateQty(sku, delta) {
    if (oosList.includes(sku) && delta > 0) {
      triggerToast("⚠️ This item was marked Out of Stock by ASM Deepu B!");
      return;
    }

    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[sku] || 0) + delta;
      if (qty <= 0) delete next[sku];
      else next[sku] = qty;
      return next;
    });

    const item = CATALOG.find((c) => c.sku === sku);
    if (delta > 0 && item) {
      playSuccessChime();
      triggerToast(`Added 1x ${item.name} to cart 🛍️`);
    }
  }

  const cartEntries = Object.entries(cart);
  const totalItems = cartEntries.reduce((s, [, q]) => s + q, 0);
  const totalPrice = cartEntries.reduce((s, [sku, q]) => {
    const item = CATALOG.find((c) => c.sku === sku);
    return s + (item?.price || 0) * q;
  }, 0);
  const walletBalance = customer?.walletBalance || WALLET_LIMIT;

  const categories = ["All", ...new Set(CATALOG.map((c) => c.category))];

  const filteredCatalog = CATALOG.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aisle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function placeOrder() {
    if (cartEntries.length === 0) {
      setError("Your cart is empty. Add items from the catalog.");
      return;
    }

    setError("");
    setPlacingOrder(true);

    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.customerId || "cust_tiptur_demo",
          customerName: customer?.name || "Ramesh Gowda",
          customerPhone: customer?.phone || "9845112233",
          cart: cartEntries.map(([sku, qty]) => ({ sku, qty })),
          location: { address: locationLabel },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order placement failed");

      // Update wallet balance locally
      const updated = { ...customer, walletBalance: walletBalance - totalPrice };
      localStorage.setItem("auditx_customer", JSON.stringify(updated));
      localStorage.setItem("blinkit_customer", JSON.stringify(updated));

      const createdOrder = data.order || {
        id: data.orderId,
        orderId: data.orderId,
        orderNumber: data.orderId,
        customerName: customer?.name || "Ramesh Gowda",
        customerPhone: customer?.phone || "9845112233",
        customerAddress: locationLabel,
        totalAmount: totalPrice,
        status: "pending",
        stage: "Awaiting OD Picker",
        assignedRack: "D5",
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        items: cartEntries.map(([sku, qty]) => {
          const cat = CATALOG.find((c) => c.sku === sku);
          return {
            skuId: sku,
            name: cat?.name || sku,
            qty,
            binLocation: cat?.aisle || "F0 - A1 - 001",
            price: cat?.price || 50,
          };
        }),
        createdAt: new Date().toISOString(),
      };

      // Broadcast order across all open browser tabs (OD Picker & Captain terminals)
      broadcastEvent("ORDER_CREATED", createdOrder);
      playNotificationChime();

      triggerToast("🎉 Order placed! Dispatched to OD Picker Thrupthi K S at Tiptur HUB KA44!");
      setTimeout(() => {
        router.push(`/track/${data.orderId}`);
      }, 1000);
    } catch (e) {
      setError(e.message || "Failed to place order.");
      setPlacingOrder(false);
    }
  }

  return (
    <div style={S.container}>
      {toastMessage && <div style={S.toast}>{toastMessage}</div>}

      {/* App Header with Location Fixed to Namma Tiptur KA 44 */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <div style={S.brandTag}>
            <span style={S.brandName}>AUDIT'X</span>
            <span style={S.storePill}>Tiptur HUB - KA44</span>
          </div>

          <div style={S.headerActions}>
            <button style={S.roleSwitcherBtn} onClick={() => router.push("/login")}>
              Switch Role / Staff Portal ↗
            </button>
          </div>
        </div>

        {/* Live Location Pill (Fixed Namma Tiptur KA 44) */}
        <div style={S.locationBar} onClick={() => setShowLocationModal(true)}>
          <div style={S.locationLeft}>
            <span style={S.gpsIcon}>📍</span>
            <div>
              <div style={S.deliveryTimeText}>
                ⚡ <b>10 MINS</b> Express Delivery Guaranteed
              </div>
              <div style={S.locationAddress}>{locationLabel}</div>
            </div>
          </div>
          <span style={S.locationChangeTag}>Live GPS Verified ✓</span>
        </div>
      </header>

      {/* Search Bar */}
      <div style={S.searchWrap}>
        <input
          type="text"
          placeholder="Search Tiptur Copra, Nandini Milk, Mysore Sandal, snacks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={S.searchInput}
        />
      </div>

      {/* Category Pills */}
      <div style={S.categoryScroller}>
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              style={{ ...S.categoryPill, ...(active ? S.categoryPillActive : {}) }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Main Catalog Grid */}
      <main style={S.main}>
        <div style={S.sectionHeader}>
          <h2 style={S.sectionTitle}>
            {selectedCategory === "All" ? "Fresh from Namma Tiptur Hub" : selectedCategory}
          </h2>
          <span style={S.itemCount}>{filteredCatalog.length} products</span>
        </div>

        <div style={S.catalogGrid}>
          {filteredCatalog.map((item) => {
            const qty = cart[item.sku] || 0;
            const isOos = oosList.includes(item.sku);

            return (
              <div
                key={item.sku}
                style={{
                  ...S.productCard,
                  opacity: isOos ? 0.65 : 1,
                  filter: isOos ? "grayscale(40%)" : "none",
                }}
              >
                {/* Product Image */}
                <div style={S.imageBox}>
                  <img src={item.image} alt={item.name} style={S.productImg} />
                  <span style={S.timeTag}>⏱️ 10 mins</span>
                  {isOos && <span style={S.oosBadge}>OUT OF STOCK (ASM MARKED)</span>}
                </div>

                {/* Product Details */}
                <div style={S.productInfo}>
                  <div style={S.aisleLocation}>
                    📍 Aisle: <b>{item.aisle}</b>
                  </div>
                  <h3 style={S.productTitle}>{item.name}</h3>
                  <div style={S.weightText}>{item.weight}</div>

                  <div style={S.priceRow}>
                    <div>
                      <span style={S.price}>₹{item.price}</span>
                      {item.mrp > item.price && (
                        <span style={S.mrp}>₹{item.mrp}</span>
                      )}
                    </div>

                    {/* Add / Qty Controls */}
                    {isOos ? (
                      <button style={S.disabledBtn} disabled>
                        Unavailable
                      </button>
                    ) : qty === 0 ? (
                      <button style={S.addBtn} onClick={() => updateQty(item.sku, 1)}>
                        ADD
                      </button>
                    ) : (
                      <div style={S.qtyStepper}>
                        <button style={S.stepBtn} onClick={() => updateQty(item.sku, -1)}>−</button>
                        <span style={S.qtyText}>{qty}</span>
                        <button style={S.stepBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <div style={S.floatingCartBar}>
          <div style={S.cartLeft}>
            <span style={S.cartCount}>{totalItems} Items</span>
            <span style={S.cartPrice}>₹{totalPrice}</span>
          </div>

          <button style={S.checkoutBtn} onClick={placeOrder} disabled={placingOrder}>
            {placingOrder ? "Placing Order..." : "Proceed to 10-Min Delivery →"}
          </button>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div style={S.modalOverlay} onClick={() => setShowLocationModal(false)}>
          <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>📍 Fixed Delivery Hub: Namma Tiptur KA 44</h3>
            <p style={S.modalSub}>
              This academic operations platform is permanently synchronized with <b>Tiptur HUB - KA44</b> (Tumkur District, Karnataka - 572201).
            </p>
            <div style={S.tipturLandmarks}>
              <div style={S.landmarkRow}>🏢 Base: APMC Tiptur Coconut Market Hub</div>
              <div style={S.landmarkRow}>🎓 Radius: Kalpataru College of Science & Arts</div>
              <div style={S.landmarkRow}>🚉 Transit: Tiptur Railway Station & B.H. Road</div>
            </div>
            <button style={S.closeModalBtn} onClick={() => setShowLocationModal(false)}>
              Got it, Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    background: "#080c14",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 90,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#10b981",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    fontSize: 14,
  },
  header: {
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    padding: "14px 20px",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  brandTag: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 900,
    color: "#10b981",
    letterSpacing: 1.5,
  },
  storePill: {
    fontSize: 11,
    fontWeight: 800,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #f59e0b",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  roleSwitcherBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#38bdf8",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  locationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1e293b",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    border: "1px solid #334155",
  },
  locationLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  gpsIcon: {
    fontSize: 20,
    color: "#10b981",
  },
  deliveryTimeText: {
    fontSize: 12,
    color: "#10b981",
  },
  locationAddress: {
    fontSize: 12,
    color: "#e2e8f0",
    fontWeight: 600,
  },
  locationChangeTag: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: 700,
  },
  searchWrap: {
    padding: "12px 20px",
    background: "#080c14",
  },
  searchInput: {
    width: "100%",
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 14,
    boxSizing: "border-box",
  },
  categoryScroller: {
    display: "flex",
    gap: 8,
    padding: "4px 20px 12px",
    overflowX: "auto",
  },
  categoryPill: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "#94a3b8",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  categoryPillActive: {
    background: "#10b981",
    color: "#ffffff",
    border: "1px solid #10b981",
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "10px 20px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    margin: 0,
  },
  itemCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  catalogGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 16,
  },
  productCard: {
    background: "#0f172a",
    borderRadius: 12,
    border: "1px solid #1e293b",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  imageBox: {
    position: "relative",
    width: "100%",
    height: 150,
    background: "#1e293b",
  },
  productImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  timeTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    background: "rgba(15, 23, 42, 0.85)",
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 4,
  },
  oosBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    background: "rgba(239, 68, 68, 0.9)",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 800,
    padding: "4px",
    borderRadius: 4,
    textAlign: "center",
  },
  productInfo: {
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    justifyContent: "space-between",
  },
  aisleLocation: {
    fontSize: 11,
    color: "#f59e0b",
    fontWeight: 700,
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 4px",
    lineHeight: 1.3,
  },
  weightText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 10,
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
  },
  price: {
    fontSize: 15,
    fontWeight: 800,
    color: "#10b981",
  },
  mrp: {
    fontSize: 12,
    color: "#64748b",
    textDecoration: "line-through",
    marginLeft: 6,
  },
  addBtn: {
    background: "#0c831f",
    border: "none",
    color: "#ffffff",
    padding: "6px 18px",
    borderRadius: 6,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  disabledBtn: {
    background: "#334155",
    border: "none",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 11,
    cursor: "not-allowed",
  },
  qtyStepper: {
    display: "flex",
    alignItems: "center",
    background: "#0c831f",
    borderRadius: 6,
    overflow: "hidden",
  },
  stepBtn: {
    background: "transparent",
    border: "none",
    color: "#fff",
    padding: "4px 8px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  qtyText: {
    padding: "0 6px",
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
  },
  floatingCartBar: {
    position: "fixed",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 32px)",
    maxWidth: 500,
    background: "#0c831f",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(12, 131, 31, 0.4)",
    zIndex: 90,
  },
  cartLeft: {
    display: "flex",
    flexDirection: "column",
  },
  cartCount: {
    fontSize: 12,
    color: "#dcfce7",
    fontWeight: 600,
  },
  cartPrice: {
    fontSize: 18,
    fontWeight: 900,
    color: "#ffffff",
  },
  checkoutBtn: {
    background: "#ffffff",
    border: "none",
    color: "#0c831f",
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 100,
  },
  modalBox: {
    background: "#0f172a",
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: "100%",
    border: "1px solid #1e293b",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 1.5,
    marginBottom: 16,
  },
  tipturLandmarks: {
    background: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 12,
    color: "#cbd5e1",
  },
  landmarkRow: {},
  closeModalBtn: {
    width: "100%",
    background: "#10b981",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
};
