"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";

const WALLET_LIMIT = 1000000;

export default function BlinkitReferenceApp() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("28, Siddi Vinayaka Rd, Kamath Layout");
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'account'
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("blinkit_customer");
    if (!raw) {
      const demoCust = { customerId: "cust_demo", name: "Deepu B", phone: "9876543210", walletBalance: 999920 };
      localStorage.setItem("blinkit_customer", JSON.stringify(demoCust));
      setCustomer(demoCust);
    } else {
      setCustomer(JSON.parse(raw));
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const geo = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const geoData = await geo.json();
            const addr = geoData.address || {};
            const label =
              addr.neighbourhood ||
              addr.suburb ||
              addr.road ||
              "28, Siddi Vinayaka Rd, Kamath Layout";
            setLocationLabel(label);
          } catch {
            setLocationLabel("28, Siddi Vinayaka Rd, Kamath Layout");
          }
        },
        () => setLocationLabel("28, Siddi Vinayaka Rd, Kamath Layout"),
        { timeout: 8000 }
      );
    }

    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [router]);

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2200);
  }

  function updateQty(sku, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[sku] || 0) + delta;
      if (qty <= 0) delete next[sku];
      else next[sku] = qty;
      return next;
    });

    const item = CATALOG.find((c) => c.sku === sku);
    if (delta > 0 && item) {
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

  const filteredCatalog = CATALOG.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aisle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group items by category for section carousels
  const categoriesList = [
    { name: "Dairy & Breakfast", title: "Dairy, Bread & Eggs", icon: "🥛" },
    { name: "Snacks & Drinks", title: "Snacks & Munchies", icon: "🍿" },
    { name: "Vegetables & Fruits", title: "Fruits & Vegetables", icon: "🥦" },
    { name: "Ice Creams & Frozen", title: "Sweet Tooth & Frozen", icon: "🍦" },
    { name: "Festive & Gifts", title: "Festive & Gift Hampers", icon: "🎁" },
  ];

  async function placeOrder() {
    if (!customer) { router.push("/login"); return; }
    if (cartEntries.length === 0) { setError("Your cart is empty."); return; }
    if (totalPrice > walletBalance) {
      setError(`Insufficient Wallet balance. Available: ₹${walletBalance.toLocaleString("en-IN")}`);
      return;
    }
    setError("");
    setPlacingOrder(true);
    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.customerId,
          customerName: customer.name || `Customer ${customer.phone}`,
          customerPhone: customer.phone,
          cart: cartEntries.map(([sku, qty]) => ({ sku, qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");

      const updated = { ...customer, walletBalance: walletBalance - totalPrice };
      localStorage.setItem("blinkit_customer", JSON.stringify(updated));

      setShowCart(false);
      router.push(`/track/${data.orderId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlacingOrder(false);
    }
  }

  function logout() {
    localStorage.removeItem("blinkit_customer");
    router.push("/login");
  }

  if (!customer || loading) {
    return (
      <div style={S.splash}>
        <div style={S.splashContent}>
          <div style={S.splashLogo}>
            <span style={{ color: "#f7d108" }}>blink</span>
            <span style={{ color: "#0c831f" }}>it</span>
          </div>
          <div style={S.splashStatus}>Loading Store...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {toastMessage && <div style={S.toastBox}>{toastMessage}</div>}

      {/* ── TOP HEADER MATCHING BLINKIT REFERENCE VIDEO ── */}
      <header style={S.header}>
        <div style={S.headerInner}>
          {/* Logo */}
          <div
            style={S.logoWrap}
            onClick={() => { setActiveTab("home"); setSelectedCategory("All"); setSearchQuery(""); }}
          >
            <span style={{ color: "#f7d108", fontWeight: 900, fontSize: 32, letterSpacing: "-1.5px" }}>blink</span>
            <span style={{ color: "#0c831f", fontWeight: 900, fontSize: 32, letterSpacing: "-1.5px" }}>it</span>
          </div>

          {/* Delivery SLA Widget */}
          <div style={S.deliveryWidget} onClick={() => triggerToast(`📍 Delivering to: ${locationLabel}`)}>
            <div style={S.slaTitle}>Delivery in 13 minutes</div>
            <div style={S.addressSub}>{locationLabel.slice(0, 32)}... ▾</div>
          </div>

          {/* Center Search Input Bar */}
          <div style={S.searchContainer}>
            <span style={S.searchIcon}>🔍</span>
            <input
              style={S.searchInput}
              placeholder='Search "paneer", "milk", "chocolates", "chips"...'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(true);
                setTimeout(() => setIsSearching(false), 200);
              }}
            />
            {searchQuery && (
              <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
            )}
          </div>

          {/* Right Action Buttons */}
          <div style={S.headerRight}>
            <button
              style={S.loginLinkBtn}
              onClick={() => setActiveTab(activeTab === "profile" ? "home" : "profile")}
            >
              {activeTab === "profile" ? "Home" : "Account"}
            </button>

            <button
              style={{
                ...S.myCartBtn,
                ...(totalItems > 0 ? S.myCartBtnActive : {}),
              }}
              onClick={() => setShowCart(true)}
            >
              <span style={{ fontSize: 16 }}>🛒</span>
              {totalItems > 0 ? (
                <span>{totalItems} item • ₹{totalPrice}</span>
              ) : (
                <span>My Cart</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── SEARCH OVERLAY DRILL-DOWN (AS SEEN IN REFERENCE VIDEO FRAME 3 & 4) ── */}
      {searchQuery.length > 0 && (
        <div style={S.searchOverlayWrap}>
          <div style={S.searchQueryHeader}>
            Showing results for <strong>"{searchQuery}"</strong> ({filteredCatalog.length} items)
          </div>

          {isSearching ? (
            <div style={S.skeletonGrid}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={S.skeletonCard} />
              ))}
            </div>
          ) : (
            <div style={S.referenceGrid}>
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                return (
                  <div key={item.sku} style={S.refProductCard}>
                    {discount > 0 && <div style={S.refDiscountBadge}>{discount}% OFF</div>}
                    <div style={S.refImgWrap} onClick={() => setSelectedProduct(item)}>
                      <img src={item.image} alt={item.name} style={S.refImg} />
                    </div>
                    <div style={S.refSlaTag}>⏱️ 13 MINS</div>
                    <div style={S.refTitle} onClick={() => setSelectedProduct(item)}>{item.name}</div>
                    <div style={S.refWeight}>{item.weight}</div>
                    <div style={S.refPriceRow}>
                      <div>
                        <span style={S.refPrice}>₹{item.price}</span>
                        {item.mrp > item.price && <span style={S.refMrp}>₹{item.mrp}</span>}
                      </div>

                      {qty === 0 ? (
                        <button style={S.refAddBtn} onClick={() => updateQty(item.sku, 1)}>ADD</button>
                      ) : (
                        <div style={S.refCounter}>
                          <button style={S.refCounterBtn} onClick={() => updateQty(item.sku, -1)}>−</button>
                          <span style={S.refCounterNum}>{qty}</span>
                          <button style={S.refCounterBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT PAGE (WHEN NOT SEARCHING) ── */}
      {searchQuery.length === 0 && activeTab === "home" && (
        <main style={S.mainContent}>

          {/* 3 PROMO CARDS (MATCHING REFERENCE VIDEO FRAME 1) */}
          <div style={S.promoGrid}>
            <div style={{ ...S.promoCard, background: "linear-gradient(135deg, #0d9488, #0f766e)" }}>
              <div style={S.promoTitle}>Pharmacy at your doorstep!</div>
              <div style={S.promoSub}>Cough syrups, pain relief sprays & more</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Pharmacy Dept")}>Order Now</button>
            </div>

            <div style={{ ...S.promoCard, background: "linear-gradient(135deg, #eab308, #ca8a04)" }}>
              <div style={S.promoTitle}>Pet care supplies at your door</div>
              <div style={S.promoSub}>Food, treats, toys & dog food</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Pet Care Dept")}>Order Now</button>
            </div>

            <div style={{ ...S.promoCard, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <div style={S.promoTitle}>No time for a diaper run?</div>
              <div style={S.promoSub}>Get baby care essentials delivered</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Baby Care Dept")}>Order Now</button>
            </div>
          </div>

          {/* CATEGORIES GRID (MATCHING REFERENCE VIDEO 20 DEPARTMENTS) */}
          <div style={S.categoryGridSection}>
            {[
              { id: "Paan Corner", title: "Paan Corner", icon: "🍃" },
              { id: "Dairy & Breakfast", title: "Dairy, Bread & Eggs", icon: "🥛" },
              { id: "Vegetables & Fruits", title: "Fruits & Vegetables", icon: "🥦" },
              { id: "Snacks & Drinks", title: "Cold Drinks & Juices", icon: "🧃" },
              { id: "Snacks & Drinks", title: "Snacks & Munchies", icon: "🍿" },
              { id: "Ice Creams & Frozen", title: "Sweet Tooth", icon: "🍫" },
              { id: "Dairy & Breakfast", title: "Bakery & Biscuits", icon: "🍞" },
              { id: "Dairy & Breakfast", title: "Tea & Coffee", icon: "☕" },
              { id: "Dairy & Breakfast", title: "Atta, Rice & Dal", icon: "🌾" },
              { id: "Festive & Gifts", title: "Festive & Gifts", icon: "🎁" },
            ].map((cat, idx) => (
              <div
                key={idx}
                style={{
                  ...S.catTileCard,
                  borderColor: selectedCategory === cat.id ? "#0c831f" : "#f1f5f9",
                  background: selectedCategory === cat.id ? "#f0fdf4" : "#ffffff",
                }}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  triggerToast(`Filtered category: ${cat.title}`);
                }}
              >
                <div style={S.catTileIcon}>{cat.icon}</div>
                <div style={S.catTileTitle}>{cat.title}</div>
              </div>
            ))}
          </div>

          {/* PRODUCT CAROUSEL SECTIONS BY CATEGORY (MATCHING REFERENCE VIDEO FRAME 1 & 2) */}
          {categoriesList.map((sec) => {
            const secItems = CATALOG.filter((c) => c.category === sec.name);
            if (secItems.length === 0) return null;
            return (
              <div key={sec.name} style={S.sectionBlock}>
                <div style={S.sectionHeadRow}>
                  <div style={S.sectionHeadTitle}>{sec.title}</div>
                  <button
                    style={S.seeAllBtn}
                    onClick={() => { setSelectedCategory(sec.name); triggerToast(`Browsing ${sec.title}`); }}
                  >
                    see all →
                  </button>
                </div>

                <div style={S.horizontalScrollRow}>
                  {secItems.map((item) => {
                    const qty = cart[item.sku] || 0;
                    const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                    return (
                      <div key={item.sku} style={S.refProductCard}>
                        {discount > 0 && <div style={S.refDiscountBadge}>{discount}% OFF</div>}
                        <div style={S.refImgWrap} onClick={() => setSelectedProduct(item)}>
                          <img src={item.image} alt={item.name} style={S.refImg} />
                        </div>
                        <div style={S.refSlaTag}>⏱️ 13 MINS</div>
                        <div style={S.refTitle} onClick={() => setSelectedProduct(item)}>{item.name}</div>
                        <div style={S.refWeight}>{item.weight}</div>
                        <div style={S.refPriceRow}>
                          <div>
                            <span style={S.refPrice}>₹{item.price}</span>
                            {item.mrp > item.price && <span style={S.refMrp}>₹{item.mrp}</span>}
                          </div>

                          {qty === 0 ? (
                            <button style={S.refAddBtn} onClick={() => updateQty(item.sku, 1)}>ADD</button>
                          ) : (
                            <div style={S.refCounter}>
                              <button style={S.refCounterBtn} onClick={() => updateQty(item.sku, -1)}>−</button>
                              <span style={S.refCounterNum}>{qty}</span>
                              <button style={S.refCounterBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* ── PROFILE ACCOUNT TAB ── */}
      {activeTab === "profile" && (
        <main style={{ ...S.mainContent, maxWidth: 600 }}>
          <div style={S.profileCard}>
            <div style={S.profileAvatar}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{customer.name || `Customer ${customer.phone}`}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>+91 {customer.phone}</div>
            </div>
            <button style={S.logoutBtn} onClick={logout}>Log Out</button>
          </div>

          <div style={S.walletCard}>
            <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>💚 Blinkit Wallet Balance</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>₹{walletBalance.toLocaleString("en-IN")}</div>
          </div>
        </main>
      )}

      {/* ── CART DRAWER MODAL ── */}
      {showCart && (
        <div style={S.drawerOverlay} onClick={() => setShowCart(false)}>
          <div style={S.drawerCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>My Cart ({totalItems} items)</div>
              <button style={S.drawerCloseBtn} onClick={() => setShowCart(false)}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku);
                if (!item) return null;
                return (
                  <div key={sku} style={S.cartRow}>
                    <img src={item.image} alt={item.name} style={S.cartItemImg} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "#0c831f", fontWeight: 700 }}>₹{item.price * qty}</div>
                    </div>
                    <div style={S.refCounter}>
                      <button style={S.refCounterBtn} onClick={() => updateQty(sku, -1)}>−</button>
                      <span style={S.refCounterNum}>{qty}</span>
                      <button style={S.refCounterBtn} onClick={() => updateQty(sku, 1)}>+</button>
                    </div>
                  </div>
                );
              })}

              <div style={S.billSummary}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                  <span>Total Bill</span>
                  <span>₹{totalPrice}</span>
                </div>
              </div>

              {error && <div style={{ color: "#dc2626", fontWeight: 700, margin: "10px 0" }}>{error}</div>}

              <button style={S.checkoutBtn} onClick={placeOrder} disabled={placingOrder}>
                {placingOrder ? "Placing Order..." : `Pay ₹${totalPrice} & Checkout →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  splash: { minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" },
  splashContent: { textAlign: "center" },
  splashLogo: { fontSize: 48, fontWeight: 900 },
  splashStatus: { color: "#0c831f", fontWeight: 800, marginTop: 12 },

  app: { minHeight: "100vh", background: "#ffffff", fontFamily: "system-ui, sans-serif" },
  toastBox: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 20px", borderRadius: 20, fontWeight: 800, fontSize: 13, zIndex: 100 },

  header: { background: "#ffffff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 40, padding: "12px 24px" },
  headerInner: { maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 24 },
  logoWrap: { cursor: "pointer", display: "flex", alignItems: "center" },

  deliveryWidget: { cursor: "pointer" },
  slaTitle: { fontSize: 15, fontWeight: 900, color: "#0f172a" },
  addressSub: { fontSize: 12, color: "#64748b", fontWeight: 600 },

  searchContainer: { flex: 1, background: "#f1f5f9", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #e2e8f0" },
  searchIcon: { color: "#64748b" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  clearSearch: { border: "none", background: "none", cursor: "pointer", color: "#64748b" },

  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  loginLinkBtn: { background: "none", border: "none", fontWeight: 800, fontSize: 15, color: "#0f172a", cursor: "pointer" },

  myCartBtn: { background: "#f1f5f9", border: "none", padding: "10px 18px", borderRadius: 12, fontWeight: 800, fontSize: 14, color: "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 },
  myCartBtnActive: { background: "#0c831f", color: "#ffffff" },

  searchOverlayWrap: { maxWidth: 1280, margin: "20px auto", padding: "0 24px" },
  searchQueryHeader: { fontSize: 18, marginBottom: 16, color: "#0f172a" },

  skeletonGrid: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 },
  skeletonCard: { height: 220, background: "#f1f5f9", borderRadius: 12 },

  referenceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 },

  mainContent: { maxWidth: 1280, margin: "24px auto", padding: "0 24px" },

  promoGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 },
  promoCard: { padding: 20, borderRadius: 16, color: "#ffffff" },
  promoTitle: { fontSize: 18, fontWeight: 900 },
  promoSub: { fontSize: 12, opacity: 0.9, marginTop: 4, height: 32 },
  promoBtn: { marginTop: 14, background: "#0f172a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },

  categoryGridSection: { display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10, marginBottom: 32 },
  catTileCard: { borderRadius: 12, border: "1px solid", padding: 10, textAlign: "center", cursor: "pointer", transition: "all 0.15s ease" },
  catTileIcon: { fontSize: 26, marginBottom: 4 },
  catTileTitle: { fontSize: 11, fontWeight: 800, color: "#1e293b", lineHeight: 1.2 },

  sectionBlock: { marginBottom: 32 },
  sectionHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionHeadTitle: { fontSize: 20, fontWeight: 900, color: "#0f172a" },
  seeAllBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 800, fontSize: 14, cursor: "pointer" },

  horizontalScrollRow: { display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 },

  refProductCard: { minWidth: 180, maxWidth: 180, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  refDiscountBadge: { position: "absolute", top: 8, left: 8, background: "#2563eb", color: "#ffffff", fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 4, zIndex: 5 },
  refImgWrap: { height: 110, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 6 },
  refImg: { maxHeight: "100%", maxWidth: "100%", objectFit: "contain" },
  refSlaTag: { fontSize: 10, fontWeight: 800, color: "#64748b", marginBottom: 4 },
  refTitle: { fontSize: 13, fontWeight: 800, color: "#0f172a", height: 34, overflow: "hidden", lineHeight: 1.3, cursor: "pointer" },
  refWeight: { fontSize: 11, color: "#94a3b8", margin: "4px 0 10px" },
  refPriceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  refPrice: { fontSize: 14, fontWeight: 900, color: "#0f172a" },
  refMrp: { fontSize: 11, color: "#94a3b8", textDecoration: "line-through", marginLeft: 4 },

  refAddBtn: { background: "#ffffff", border: "1px solid #0c831f", color: "#0c831f", fontWeight: 900, fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer" },
  refCounter: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 6, padding: "2px" },
  refCounterBtn: { background: "none", border: "none", color: "#fff", fontWeight: 900, fontSize: 15, width: 22, height: 22, cursor: "pointer" },
  refCounterNum: { color: "#fff", fontWeight: 900, fontSize: 12, padding: "0 4px" },

  profileCard: { background: "#f8fafc", padding: 20, borderRadius: 16, display: "flex", alignItems: "center", gap: 16, marginBottom: 16 },
  profileAvatar: { fontSize: 32 },
  logoutBtn: { background: "#fee2e2", border: "none", color: "#dc2626", padding: "8px 16px", borderRadius: 8, fontWeight: 800, cursor: "pointer" },

  walletCard: { background: "linear-gradient(135deg, #0c831f, #15803d)", padding: 24, borderRadius: 16, color: "#fff" },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", justifyContent: "flex-end" },
  drawerCard: { width: "100%", maxWidth: 440, background: "#ffffff", height: "100vh", overflowY: "auto" },
  drawerHeader: { padding: 20, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" },
  drawerCloseBtn: { border: "none", background: "#f1f5f9", width: 32, height: 32, borderRadius: "50%", fontWeight: 800, cursor: "pointer" },

  cartRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  cartItemImg: { width: 48, height: 48, borderRadius: 8, objectFit: "contain" },
  billSummary: { background: "#f8fafc", padding: 16, borderRadius: 12, margin: "20px 0" },
  checkoutBtn: { width: "100%", padding: 16, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer" },
};
