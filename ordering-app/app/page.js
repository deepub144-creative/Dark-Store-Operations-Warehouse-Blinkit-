"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";

export default function OrderPage() {
  const [name, setName] = useState("Muniswamappa Customer");
  const [cart, setCart] = useState({}); // sku -> qty
  const [activeTab, setActiveTab] = useState("home"); // home | orderAgain | categories | print | district | profile
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Splash screen animation delay matching official video
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  function updateQty(sku, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[sku] || 0) + delta;
      if (qty <= 0) delete next[sku];
      else next[sku] = qty;
      return next;
    });
  }

  const cartEntries = Object.entries(cart);
  const totalItemCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const totalPrice = cartEntries.reduce((sum, [sku, qty]) => {
    const item = CATALOG.find((c) => c.sku === sku);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const filteredCatalog = CATALOG.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handlePlaceOrder() {
    if (!name.trim()) {
      setError("Please enter your name for delivery.");
      return;
    }
    if (cartEntries.length === 0) {
      setError("Your cart is empty. Add at least one item.");
      return;
    }

    setError("");
    setPlacingOrder(true);
    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          cart: cartEntries.map(([sku, qty]) => ({ sku, qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");

      // Redirect to real-time order tracking page
      router.push(`/track/${data.orderId}`);
    } catch (e) {
      setError(e.message);
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.splashWrap}>
        <div style={styles.splashCard}>
          <div style={styles.splashBlinkit}>blinkit</div>
          <div style={styles.splashGiftBox}>🎁</div>
          <div style={styles.splashTagline}>Reminder: Gift your brother a PS5</div>
          <div style={styles.splashSubTag}>Be the &apos;best sibling&apos;, get the perfect gift!</div>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top Header - Exact match to Blinkit App Video */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <div style={styles.blinkitTitleRow}>
              <span style={styles.blinkitBrand}>Blinkit in</span>
              <span style={styles.deliveryBadge}>14 MINUTES</span>
            </div>
            <div style={styles.locationSelector}>
              <b>HOME - Muniswamappa</b> ▾ <span style={styles.distanceBadge}>850 m away</span>
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.walletPill}>👛 ₹0</div>
            <button style={styles.profileAvatarBtn} onClick={() => setActiveTab("profile")}>
              👤
            </button>
          </div>
        </div>

        {/* Search Bar with Voice Mic */}
        <div style={styles.searchBarRow}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder='Search "atta, dal, coke and milk..."'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span style={styles.micIcon}>🎙️</span>
        </div>

        {/* Category Pills */}
        <div style={styles.categoryPillsScroll}>
          {["All", "Janmashtami 🌟", "Onam", "Electronics", "Fresh Vegetables", "Dairy & Milk"].map((cat, idx) => (
            <div
              key={cat}
              style={{
                ...styles.categoryPill,
                background: idx === 0 ? "#0c831f" : "#f1f5f9",
                color: idx === 0 ? "#ffffff" : "#334155",
              }}
            >
              {cat}
            </div>
          ))}
        </div>
      </header>

      {/* Main Tab Content */}
      <main style={styles.main}>
        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            {/* Hero Raksha Bandhan Banner */}
            <div style={styles.heroBanner}>
              <div style={styles.heroBadge}>CELEBRATE RAKSHA BANDHAN</div>
              <div style={styles.heroSubText}>28TH AUGUST, FRIDAY</div>
              <div style={styles.heroFeatureCard}>
                <div>
                  <div style={styles.heroItemTitle}>Rudraksh & Om Premium Rakhi</div>
                  <div style={styles.heroPriceRow}>
                    <span style={styles.heroStrike}>₹375</span>
                    <span style={styles.heroPrice}>₹199</span>
                  </div>
                </div>
                <div style={styles.heroEmoji}>🪔</div>
              </div>

              {/* Festive Category Grid */}
              <div style={styles.festiveGrid}>
                <div style={styles.festiveTile}>🎁 Gifts for Sister</div>
                <div style={styles.festiveTile}>👔 Gifts for Brother</div>
                <div style={styles.festiveTile}>🍫 Chocolates & Cakes</div>
                <div style={styles.festiveTile}>🥜 Dry Fruits & Sweets</div>
              </div>
            </div>

            {/* Quick Price Filters */}
            <div style={styles.filterPillsRow}>
              {["Under ₹49", "Under ₹99", "Under ₹199", "Kids Rakhi", "Premium Rakhi"].map((flt) => (
                <span key={flt} style={styles.filterPillTag}>
                  {flt}
                </span>
              ))}
            </div>

            <div style={styles.sectionHeader}>Instant Delivery Essentials</div>

            {/* Product Card Grid */}
            <div style={styles.productGrid}>
              {filteredCatalog.map((item) => {
                const qtyInCart = cart[item.sku] || 0;
                return (
                  <div key={item.sku} style={styles.productCard}>
                    <div style={styles.productImageWrapper}>
                      <span style={styles.productEmoji}>{item.image}</span>
                      <span style={styles.deliveryTimeTag}>⚡ {item.delivery}</span>
                    </div>

                    <div style={styles.productWeight}>{item.weight}</div>
                    <div style={styles.productName}>{item.name}</div>

                    <div style={styles.productBottomRow}>
                      <div>
                        <span style={styles.productPrice}>₹{item.price}</span>
                        {item.mrp && <span style={styles.productMrp}>₹{item.mrp}</span>}
                      </div>

                      {qtyInCart === 0 ? (
                        <button style={styles.addBtn} onClick={() => updateQty(item.sku, 1)}>
                          ADD
                        </button>
                      ) : (
                        <div style={styles.counterGroup}>
                          <button style={styles.counterBtn} onClick={() => updateQty(item.sku, -1)}>
                            -
                          </button>
                          <span style={styles.counterVal}>{qtyInCart}</span>
                          <button style={styles.counterBtn} onClick={() => updateQty(item.sku, 1)}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ORDER AGAIN TAB */}
        {activeTab === "orderAgain" && (
          <div>
            <div style={styles.sectionHeader}>Bestsellers & Previous Orders</div>
            <div style={styles.productGrid}>
              {CATALOG.slice(0, 4).map((item) => {
                const qtyInCart = cart[item.sku] || 0;
                return (
                  <div key={item.sku} style={styles.productCard}>
                    <div style={styles.productImageWrapper}>
                      <span style={styles.productEmoji}>{item.image}</span>
                      <span style={styles.deliveryTimeTag}>⚡ {item.delivery}</span>
                    </div>
                    <div style={styles.productWeight}>{item.weight}</div>
                    <div style={styles.productName}>{item.name}</div>
                    <div style={styles.productBottomRow}>
                      <span style={styles.productPrice}>₹{item.price}</span>
                      {qtyInCart === 0 ? (
                        <button style={styles.addBtn} onClick={() => updateQty(item.sku, 1)}>
                          ADD
                        </button>
                      ) : (
                        <div style={styles.counterGroup}>
                          <button style={styles.counterBtn} onClick={() => updateQty(item.sku, -1)}>
                            -
                          </button>
                          <span style={styles.counterVal}>{qtyInCart}</span>
                          <button style={styles.counterBtn} onClick={() => updateQty(item.sku, 1)}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CATEGORIES TAB - Dark Theme Matching Video */}
        {activeTab === "categories" && (
          <div style={styles.darkCategoriesWrap}>
            <div style={styles.catGroupHeader}>Grocery & Kitchen</div>
            <div style={styles.catGrid}>
              {["🥦 Vegetables & Fruits", "🌾 Atta, Rice & Dal", "🧈 Oil, Ghee & Masala", "🥛 Dairy, Bread & Eggs", "🍪 Bakery & Biscuits", "🥜 Dry Fruits & Cereals", "🍗 Meat & Fish", "🍳 Kitchenware"].map((c) => (
                <div key={c} style={styles.catCardDark}>
                  {c}
                </div>
              ))}
            </div>

            <div style={styles.catGroupHeader}>Snacks & Drinks</div>
            <div style={styles.catGrid}>
              {["🍿 Chips & Namkeen", "🍫 Sweets & Chocolates", "🥤 Drinks & Juices", "☕ Tea, Coffee & Milk", "🍜 Instant Food", "🍨 Ice Creams"].map((c) => (
                <div key={c} style={styles.catCardDark}>
                  {c}
                </div>
              ))}
            </div>

            <div style={styles.categoriesFooter}>
              India&apos;s last minute app ❤️ <b>blinkit</b>
            </div>
          </div>
        )}

        {/* PRINT TAB */}
        {activeTab === "print" && (
          <div>
            <div style={styles.sectionHeader}>Print Store (15 minutes)</div>
            <div style={styles.printCard}>
              <div style={styles.printTitle}>📄 Documents & Certificates</div>
              <div style={styles.printSub}>Price starting at ₹3/page · 70 GSM Single/Double Sided</div>
              <button style={styles.uploadBtn} onClick={() => alert("Upload PDF coming soon!")}>
                Upload Files & Print
              </button>
            </div>
          </div>
        )}

        {/* PROFILE TAB - Exact Match to Video */}
        {activeTab === "profile" && (
          <div style={styles.darkProfileWrap}>
            <div style={styles.profileHeaderCard}>
              <div style={styles.profileAvatarBig}>👤</div>
              <div>
                <div style={styles.profileAccountTitle}>Your account</div>
                <div style={styles.profilePhoneNum}>6364150847</div>
              </div>
            </div>

            {/* Quick 3 Pill Buttons */}
            <div style={styles.quickPillsRow}>
              <div style={styles.quickProfileTile}>🛍️ Your orders</div>
              <div style={styles.quickProfileTile}>💳 Blinkit Money</div>
              <div style={styles.quickProfileTile}>💬 Need help?</div>
            </div>

            <div style={styles.profileMenuGroup}>
              {["Address book", "Bookmarked recipes", "Your wishlist", "GST details", "E-gift cards", "Your prescriptions", "Payment settings", "Feeding India impact", "Log out"].map((menu) => (
                <div key={menu} style={styles.profileMenuItem} onClick={() => alert(`${menu} clicked`)}>
                  <span>{menu}</span>
                  <span style={styles.menuArrow}>&rsaquo;</span>
                </div>
              ))}
            </div>

            <div style={styles.profileVersionFooter}>blinkit v18.19.0</div>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartEntries.length > 0 && (
        <div style={styles.floatingCartBar}>
          <div style={styles.cartInfoText}>
            <span style={styles.cartCountBadge}>{totalItemCount} ITEMS</span>
            <span style={styles.cartPriceText}>₹{totalPrice}</span>
          </div>

          <button style={styles.checkoutProceedBtn} onClick={() => setShowCheckoutModal(true)}>
            View Cart & Checkout &rarr;
          </button>
        </div>
      )}

      {/* Customer Checkout Modal */}
      {showCheckoutModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeaderTitle}>Confirm Delivery Order</div>

            <label style={styles.modalLabel}>Customer Delivery Name</label>
            <input
              style={styles.modalInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
            />

            <div style={styles.modalItemsSummary}>
              <div style={styles.modalSubHeader}>Order Summary ({totalItemCount} items):</div>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku);
                return (
                  <div key={sku} style={styles.modalItemRow}>
                    <span>{item?.image} {item?.name} x {qty}</span>
                    <span>₹{(item?.price || 0) * qty}</span>
                  </div>
                );
              })}
              <div style={styles.modalTotalRow}>
                <span>Total Amount Payable:</span>
                <span>₹{totalPrice}</span>
              </div>
            </div>

            {error && <div style={styles.errorText}>{error}</div>}

            <button style={styles.modalPlaceOrderBtn} onClick={handlePlaceOrder} disabled={placingOrder}>
              {placingOrder ? "Placing Order..." : "🚀 Confirm & Place Order"}
            </button>

            <button style={styles.modalCancelBtn} onClick={() => setShowCheckoutModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom 5-Tab Navigation Bar */}
      <nav style={styles.bottomNav}>
        {[
          { id: "home", label: "Home", icon: "🏠" },
          { id: "orderAgain", label: "Order Again", icon: "🛍️" },
          { id: "categories", label: "Categories", icon: "🔲" },
          { id: "print", label: "Print", icon: "🖨️" },
          { id: "profile", label: "Account", icon: "👤" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...styles.navTab,
                color: isActive ? "#0c831f" : "#64748b",
                fontWeight: isActive ? 700 : 500,
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={styles.navIcon}>{tab.icon}</span>
              <span style={styles.navLabel}>{tab.label}</span>
              {isActive && <div style={styles.activeTabIndicator} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  splashWrap: {
    minHeight: "100vh",
    background: "#facc15",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  splashCard: { textAlign: "center" },
  splashBlinkit: { fontSize: 44, fontWeight: 900, color: "#0c831f", letterSpacing: "-1.5px" },
  splashGiftBox: { fontSize: 50, marginTop: 12 },
  splashTagline: { fontSize: 16, fontWeight: 800, color: "#111827", marginTop: 8 },
  splashSubTag: { fontSize: 13, color: "#4b5563", marginTop: 4 },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #ffffff",
    borderTopColor: "#0c831f",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "24px auto 0",
  },

  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
    paddingBottom: 90,
  },
  header: {
    background: "#ffffff",
    padding: "14px 16px",
    position: "sticky",
    top: 0,
    zIndex: 20,
    borderBottom: "1px solid #e2e8f0",
  },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  blinkitTitleRow: { display: "flex", alignItems: "center", gap: 6 },
  blinkitBrand: { fontSize: 16, fontWeight: 900, color: "#0c831f" },
  deliveryBadge: { background: "#0c831f", color: "#fff", fontWeight: 800, fontSize: 11, padding: "2px 6px", borderRadius: 4 },
  locationSelector: { fontSize: 13, color: "#0f172a", marginTop: 2 },
  distanceBadge: { color: "#64748b", fontSize: 11 },

  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  walletPill: { background: "#f1f5f9", padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 700 },
  profileAvatarBtn: { background: "#f1f5f9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16 },

  searchBarRow: {
    marginTop: 10,
    background: "#f1f5f9",
    borderRadius: 10,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  searchIcon: { fontSize: 14, color: "#64748b" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 500 },
  micIcon: { fontSize: 14 },

  categoryPillsScroll: { display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 4 },
  categoryPill: { padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" },

  main: { padding: 16, maxWidth: 500, margin: "0 auto" },

  heroBanner: {
    background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
    borderRadius: 16,
    padding: 16,
    color: "#ffffff",
    marginBottom: 16,
  },
  heroBadge: { fontSize: 12, fontWeight: 900, letterSpacing: "0.5px", opacity: 0.9 },
  heroSubText: { fontSize: 10, opacity: 0.8, marginTop: 2 },
  heroFeatureCard: {
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroItemTitle: { fontWeight: 800, fontSize: 14 },
  heroPriceRow: { display: "flex", gap: 8, marginTop: 4, alignItems: "center" },
  heroStrike: { textDecoration: "line-through", opacity: 0.7, fontSize: 12 },
  heroPrice: { fontWeight: 900, fontSize: 16, color: "#facc15" },
  heroEmoji: { fontSize: 28 },

  festiveGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 },
  festiveTile: { background: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center" },

  filterPillsRow: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 16 },
  filterPillTag: { background: "#ffffff", border: "1px solid #cbd5e1", padding: "6px 10px", borderRadius: 16, fontSize: 12, fontWeight: 700, color: "#334155" },

  sectionHeader: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 },

  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  productCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 12,
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  productImageWrapper: {
    height: 90,
    background: "#f8fafc",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  productEmoji: { fontSize: 44 },
  deliveryTimeTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    background: "#ffffff",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 4,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  productWeight: { fontSize: 11, color: "#64748b", marginTop: 8 },
  productName: { fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 2, height: 36, overflow: "hidden" },
  productBottomRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  productPrice: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  productMrp: { fontSize: 11, color: "#94a3b8", textDecoration: "line-through", marginLeft: 4 },

  addBtn: {
    background: "#ffffff",
    border: "1.5px solid #0c831f",
    color: "#0c831f",
    fontWeight: 800,
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
  counterGroup: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 8, padding: "2px 4px" },
  counterBtn: { background: "transparent", border: "none", color: "#fff", fontWeight: 800, fontSize: 14, width: 24, height: 24, cursor: "pointer" },
  counterVal: { color: "#fff", fontWeight: 800, fontSize: 13, padding: "0 6px" },

  darkCategoriesWrap: { background: "#0f172a", padding: 16, borderRadius: 16, color: "#fff" },
  catGroupHeader: { fontSize: 15, fontWeight: 800, color: "#38bdf8", marginTop: 12, marginBottom: 8 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  catCardDark: { background: "#1e293b", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600 },
  categoriesFooter: { textAlign: "center", marginTop: 24, color: "#94a3b8", fontSize: 12 },

  printCard: { background: "#ffffff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" },
  printTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a" },
  printSub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  uploadBtn: { marginTop: 12, width: "100%", padding: 12, borderRadius: 8, background: "#0c831f", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" },

  darkProfileWrap: { background: "#0f172a", padding: 16, borderRadius: 16, color: "#fff" },
  profileHeaderCard: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  profileAvatarBig: { fontSize: 32, background: "#1e293b", padding: 8, borderRadius: "50%" },
  profileAccountTitle: { fontSize: 18, fontWeight: 800 },
  profilePhoneNum: { fontSize: 13, color: "#94a3b8" },

  quickPillsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 },
  quickProfileTile: { background: "#1e293b", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textAlign: "center" },
  profileMenuGroup: { background: "#1e293b", borderRadius: 12, overflow: "hidden" },
  profileMenuItem: { display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #334155", fontSize: 14, fontWeight: 600 },
  menuArrow: { color: "#64748b" },
  profileVersionFooter: { textAlign: "center", marginTop: 20, color: "#64748b", fontSize: 12 },

  floatingCartBar: {
    position: "fixed",
    bottom: 64,
    left: 16,
    right: 16,
    background: "#0c831f",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#ffffff",
    boxShadow: "0 10px 25px rgba(12, 131, 31, 0.4)",
    zIndex: 40,
  },
  cartInfoText: { display: "flex", flexDirection: "column" },
  cartCountBadge: { fontSize: 10, fontWeight: 900, opacity: 0.9 },
  cartPriceText: { fontSize: 17, fontWeight: 900 },
  checkoutProceedBtn: { background: "#ffffff", color: "#0c831f", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer" },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modalCard: { background: "#ffffff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 360 },
  modalHeaderTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
  modalLabel: { fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 },
  modalInput: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" },
  modalItemsSummary: { marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 10, fontSize: 13 },
  modalSubHeader: { fontWeight: 700, color: "#0f172a", marginBottom: 6 },
  modalItemRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #e2e8f0" },
  modalTotalRow: { display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800, fontSize: 14, color: "#0c831f" },
  errorText: { color: "#dc2626", fontSize: 12, fontWeight: 600, marginTop: 8 },
  modalPlaceOrderBtn: { width: "100%", marginTop: 14, padding: 12, borderRadius: 8, background: "#0c831f", color: "#fff", border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer" },
  modalCancelBtn: { width: "100%", marginTop: 8, padding: 8, borderRadius: 8, background: "transparent", color: "#64748b", border: "none", fontSize: 13, cursor: "pointer" },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "#ffffff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 50,
  },
  navTab: {
    flex: 1,
    height: "100%",
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 10, marginTop: 2 },
  activeTabIndicator: {
    position: "absolute",
    top: 0,
    width: 20,
    height: 3,
    background: "#0c831f",
    borderRadius: 2,
  },
};
