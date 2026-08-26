"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";
import Image from "next/image";

const WALLET_LIMIT = 1000000;

export default function OrderPage() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationLabel, setLocationLabel] = useState("Detecting location...");
  const [locationRequested, setLocationRequested] = useState(false);
  const router = useRouter();

  // Auth check & location request on mount
  useEffect(() => {
    const raw = localStorage.getItem("blinkit_customer");
    if (!raw) {
      router.push("/login");
      return;
    }
    setCustomer(JSON.parse(raw));

    // Request GPS location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocation({ lat: latitude, lng: longitude });
          setLocationRequested(true);
          // Reverse geocode for human-readable address
          try {
            const geo = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const geoData = await geo.json();
            const addr = geoData.address;
            const label =
              addr.neighbourhood ||
              addr.suburb ||
              addr.village ||
              addr.county ||
              `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            setLocationLabel(label);
          } catch {
            setLocationLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        },
        () => {
          setLocationLabel("Muniswamappa Layout, Bengaluru");
          setLocationRequested(true);
        },
        { timeout: 10000 }
      );
    }

    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [router]);

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
  const totalItems = cartEntries.reduce((s, [, q]) => s + q, 0);
  const totalPrice = cartEntries.reduce((s, [sku, q]) => {
    const item = CATALOG.find((c) => c.sku === sku);
    return s + (item?.price || 0) * q;
  }, 0);
  const walletBalance = customer?.walletBalance || WALLET_LIMIT;

  const filteredCatalog =
    searchQuery.trim()
      ? CATALOG.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : CATALOG;

  async function placeOrder() {
    if (!customer) { router.push("/login"); return; }
    if (cartEntries.length === 0) { setError("Your cart is empty."); return; }
    if (totalPrice > walletBalance) {
      setError(`Insufficient Blinkit Wallet balance. Available: ₹${walletBalance.toLocaleString()}`);
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
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");

      // Update local wallet balance
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
          <div style={S.splashLogo}>blinkit</div>
          <div style={S.splashEmoji}>🛒</div>
          <div style={S.splashTag}>Grocery in minutes</div>
          <div style={S.spinnerWrap}><div style={S.spinner} /></div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {/* ── HEADER ── */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.deliveryRow}>
              <span style={S.blinkitBrand}>blinkit</span>
              <span style={S.inMinBadge}>in 14 MINS</span>
            </div>
            <div style={S.locationRow}>
              <span style={S.locationPin}>📍</span>
              <span style={S.locationText}>
                {locationRequested ? locationLabel : "Detecting location..."}
              </span>
              <span style={S.locationChevron}>▾</span>
            </div>
          </div>

          <div style={S.headerActions}>
            <div style={S.walletBadge}>
              <span style={S.walletIcon}>💚</span>
              <span style={S.walletAmt}>₹{walletBalance.toLocaleString("en-IN")}</span>
            </div>
            <button style={S.avatarBtn} onClick={() => setActiveTab("profile")}>👤</button>
          </div>
        </div>

        {/* Search bar */}
        <div style={S.searchRow}>
          <span style={S.searchIcon}>🔍</span>
          <input
            style={S.searchInput}
            placeholder='Search "milk, bread, onion..."'
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveTab("home"); }}
          />
          {searchQuery && (
            <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        {/* Category pills */}
        <div style={S.pills}>
          {["All 🏷️", "🌿 Fresh", "🥛 Dairy", "🍪 Snacks", "🥶 Frozen", "🎁 Gifts"].map((c, i) => (
            <span key={c} style={{ ...S.pill, ...(i === 0 ? S.pillActive : {}) }}>{c}</span>
          ))}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={S.main}>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            {/* Hero Banner */}
            <div style={S.heroBanner}>
              <div style={S.heroLabel}>🎉 RAKSHA BANDHAN SPECIAL</div>
              <div style={S.heroTitle}>Celebrate with loved ones</div>
              <div style={S.heroSub}>Premium Rakhis, Gifts, Sweets — delivered in 14 mins!</div>
              <div style={S.heroCats}>
                {["🎁 Gifts", "🍫 Sweets", "🌸 Flowers", "🪔 Decor"].map((c) => (
                  <span key={c} style={S.heroCatPill}>{c}</span>
                ))}
              </div>
            </div>

            {/* Filter chips */}
            <div style={S.filterRow}>
              {["Under ₹49", "Under ₹99", "Under ₹199", "Bestsellers"].map((f) => (
                <span key={f} style={S.filterChip}>{f}</span>
              ))}
            </div>

            <div style={S.sectionTitle}>Essentials — delivered instantly</div>

            {/* Product grid */}
            <div style={S.productGrid}>
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                return (
                  <div key={item.sku} style={S.productCard}>
                    <div style={S.imageWrap}>
                      <img
                        src={item.image}
                        alt={item.name}
                        style={S.productImage}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <span style={S.deliveryChip}>⚡ {item.delivery}</span>
                      {discount > 0 && <span style={S.discountChip}>{discount}% OFF</span>}
                    </div>

                    <div style={S.productInfo}>
                      <div style={S.productWeight}>{item.weight}</div>
                      <div style={S.productName}>{item.name}</div>
                      <div style={S.priceRow}>
                        <div>
                          <span style={S.salePrice}>₹{item.price}</span>
                          {item.mrp > item.price && (
                            <span style={S.mrpPrice}>₹{item.mrp}</span>
                          )}
                        </div>

                        {qty === 0 ? (
                          <button style={S.addBtn} onClick={() => updateQty(item.sku, 1)}>
                            ADD
                          </button>
                        ) : (
                          <div style={S.counter}>
                            <button style={S.counterBtn} onClick={() => updateQty(item.sku, -1)}>−</button>
                            <span style={S.counterNum}>{qty}</span>
                            <button style={S.counterBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
                          </div>
                        )}
                      </div>
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
            <div style={S.sectionTitle}>Order Again</div>
            <div style={S.productGrid}>
              {CATALOG.slice(0, 6).map((item) => {
                const qty = cart[item.sku] || 0;
                return (
                  <div key={item.sku} style={S.productCard}>
                    <div style={S.imageWrap}>
                      <img src={item.image} alt={item.name} style={S.productImage} />
                      <span style={S.deliveryChip}>⚡ {item.delivery}</span>
                    </div>
                    <div style={S.productInfo}>
                      <div style={S.productWeight}>{item.weight}</div>
                      <div style={S.productName}>{item.name}</div>
                      <div style={S.priceRow}>
                        <span style={S.salePrice}>₹{item.price}</span>
                        {qty === 0 ? (
                          <button style={S.addBtn} onClick={() => updateQty(item.sku, 1)}>ADD</button>
                        ) : (
                          <div style={S.counter}>
                            <button style={S.counterBtn} onClick={() => updateQty(item.sku, -1)}>−</button>
                            <span style={S.counterNum}>{qty}</span>
                            <button style={S.counterBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div style={S.categoriesWrap}>
            {[
              { group: "Grocery & Kitchen", items: ["🥦 Vegetables & Fruits", "🌾 Atta, Rice & Dal", "🧈 Oil, Ghee & Masala", "🥛 Dairy, Bread & Eggs", "🍪 Bakery & Biscuits", "🥜 Dry Fruits"] },
              { group: "Snacks & Beverages", items: ["🍿 Chips & Namkeen", "🍫 Chocolates", "🥤 Cold Drinks", "☕ Tea & Coffee", "🍜 Instant Noodles", "🍨 Ice Creams"] },
              { group: "Beauty & Personal Care", items: ["🧴 Skincare", "💆 Hair Care", "🪥 Oral Care", "🧼 Soaps & Body Wash"] },
            ].map(({ group, items }) => (
              <div key={group}>
                <div style={S.catGroupTitle}>{group}</div>
                <div style={S.catGrid}>
                  {items.map((it) => (
                    <div key={it} style={S.catBox}>{it}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={S.profileWrap}>
            <div style={S.profileCard}>
              <div style={S.profileAvatar}>👤</div>
              <div>
                <div style={S.profileName}>{customer.name || "Your Account"}</div>
                <div style={S.profilePhone}>+91 {customer.phone}</div>
              </div>
            </div>

            {/* Wallet Card */}
            <div style={S.walletCard}>
              <div style={S.walletCardTitle}>💚 Blinkit Wallet</div>
              <div style={S.walletCardBalance}>₹{walletBalance.toLocaleString("en-IN")}</div>
              <div style={S.walletCardSub}>Available Balance • Limit: ₹10,00,000</div>
              <div style={S.walletProgressBar}>
                <div
                  style={{
                    ...S.walletProgress,
                    width: `${Math.max(1, 100 - (totalPrice / WALLET_LIMIT) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div style={S.profileMenu}>
              {["📦 Your Orders", "📍 Address Book", "💳 Payment Settings", "🎁 Gift Cards", "🤝 Refer & Earn", "🎧 Help & Support", "📋 Terms & Privacy"].map((item) => (
                <div key={item} style={S.profileMenuRow}>
                  <span>{item}</span><span style={S.menuArrow}>›</span>
                </div>
              ))}
            </div>

            <button style={S.logoutBtn} onClick={logout}>Log Out</button>
            <div style={S.versionTag}>blinkit v18.19.0</div>
          </div>
        )}
      </main>

      {/* ── CART BOTTOM BAR ── */}
      {totalItems > 0 && !showCart && (
        <div style={S.cartBar} onClick={() => setShowCart(true)}>
          <div style={S.cartLeft}>
            <div style={S.cartCount}>{totalItems} ITEM{totalItems > 1 ? "S" : ""}</div>
            <div style={S.cartPrice}>₹{totalPrice}</div>
          </div>
          <div style={S.cartRight}>
            View Cart →
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div style={S.drawerOverlay} onClick={() => setShowCart(false)}>
          <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div style={S.drawerTitle}>Your Cart</div>
              <button style={S.drawerClose} onClick={() => setShowCart(false)}>✕</button>
            </div>

            <div style={S.drawerDelivery}>
              <span style={S.deliveryGreen}>⚡ Delivery in 14 minutes</span>
              <span style={S.deliveryAddress}>to {locationLabel}</span>
            </div>

            <div style={S.drawerItems}>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku);
                if (!item) return null;
                return (
                  <div key={sku} style={S.drawerItem}>
                    <img src={item.image} alt={item.name} style={S.drawerItemImg} />
                    <div style={S.drawerItemInfo}>
                      <div style={S.drawerItemName}>{item.name}</div>
                      <div style={S.drawerItemWeight}>{item.weight}</div>
                      <div style={S.drawerItemPrice}>₹{item.price} × {qty} = ₹{item.price * qty}</div>
                    </div>
                    <div style={S.counter}>
                      <button style={S.counterBtn} onClick={() => updateQty(sku, -1)}>−</button>
                      <span style={S.counterNum}>{qty}</span>
                      <button style={S.counterBtn} onClick={() => updateQty(sku, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bill Summary */}
            <div style={S.billCard}>
              <div style={S.billTitle}>Bill Summary</div>
              <div style={S.billRow}><span>Item total</span><span>₹{totalPrice}</span></div>
              <div style={S.billRow}><span>Delivery fee</span><span style={{ color: "#0c831f" }}>FREE</span></div>
              <div style={S.billRow}><span>Platform fee</span><span>₹0</span></div>
              <div style={S.billDivider} />
              <div style={{ ...S.billRow, fontWeight: 800 }}><span>To Pay</span><span>₹{totalPrice}</span></div>
              <div style={S.paymentMethod}>
                <span>💚 Blinkit Wallet</span>
                <span>₹{walletBalance.toLocaleString("en-IN")} available</span>
              </div>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button style={S.placeOrderBtn} onClick={placeOrder} disabled={placingOrder}>
              {placingOrder ? "Placing Order..." : `Confirm & Pay ₹${totalPrice} →`}
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav style={S.bottomNav}>
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "orderAgain", icon: "🛍️", label: "Order Again" },
          { id: "categories", icon: "🔲", label: "Categories" },
          { id: "profile", icon: "👤", label: "Account" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{ ...S.navTab, color: active ? "#0c831f" : "#94a3b8" }}
              onClick={() => setActiveTab(tab.id)}
            >
              {active && <div style={S.navActiveBar} />}
              <span style={S.navIcon}>{tab.icon}</span>
              <span style={{ ...S.navLabel, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const S = {
  splash: { minHeight: "100vh", background: "#facc15", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" },
  splashContent: { textAlign: "center" },
  splashLogo: { fontSize: 48, fontWeight: 900, color: "#0c831f", letterSpacing: "-2px" },
  splashEmoji: { fontSize: 60, marginTop: 16 },
  splashTag: { fontSize: 16, color: "#3f6212", fontWeight: 600, marginTop: 8 },
  spinnerWrap: { marginTop: 24, display: "flex", justifyContent: "center" },
  spinner: { width: 32, height: 32, border: "3px solid #fff", borderTopColor: "#0c831f", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  app: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 },

  header: { background: "#fff", padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  deliveryRow: { display: "flex", alignItems: "center", gap: 6 },
  blinkitBrand: { fontSize: 20, fontWeight: 900, color: "#0c831f", letterSpacing: "-0.5px" },
  inMinBadge: { background: "#0c831f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 },
  locationRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 2 },
  locationPin: { fontSize: 13 },
  locationText: { fontSize: 13, fontWeight: 700, color: "#0f172a", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  locationChevron: { color: "#0c831f", fontSize: 11, fontWeight: 700 },

  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  walletBadge: { background: "#dcfce7", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 },
  walletIcon: { fontSize: 14 },
  walletAmt: { fontSize: 13, fontWeight: 800, color: "#15803d" },
  avatarBtn: { width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 16 },

  searchRow: { background: "#f1f5f9", borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  searchIcon: { fontSize: 14, color: "#94a3b8" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 500 },
  clearSearch: { border: "none", background: "none", cursor: "pointer", color: "#94a3b8", fontSize: 14 },

  pills: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 },
  pill: { padding: "5px 12px", borderRadius: 20, background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap", cursor: "pointer" },
  pillActive: { background: "#0c831f", color: "#fff" },

  main: { padding: 16, maxWidth: 480, margin: "0 auto" },

  heroBanner: {
    background: "linear-gradient(135deg, #0c831f, #15803d)",
    borderRadius: 16,
    padding: 18,
    color: "#fff",
    marginBottom: 16,
  },
  heroLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.5px", opacity: 0.85 },
  heroTitle: { fontSize: 22, fontWeight: 900, marginTop: 4 },
  heroSub: { fontSize: 13, opacity: 0.8, marginTop: 4 },
  heroCats: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  heroCatPill: { background: "rgba(255,255,255,0.2)", padding: "5px 10px", borderRadius: 16, fontSize: 12, fontWeight: 700 },

  filterRow: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 },
  filterChip: { padding: "6px 12px", borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" },

  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 12 },

  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  productCard: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" },
  imageWrap: { position: "relative", height: 110, background: "#f8fafc" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  deliveryChip: { position: "absolute", bottom: 5, left: 5, background: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" },
  discountChip: { position: "absolute", top: 5, right: 5, background: "#10b981", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 },

  productInfo: { padding: 10 },
  productWeight: { fontSize: 11, color: "#94a3b8", marginBottom: 2 },
  productName: { fontSize: 13, fontWeight: 700, color: "#0f172a", height: 34, overflow: "hidden" },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  salePrice: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  mrpPrice: { fontSize: 11, color: "#94a3b8", textDecoration: "line-through", marginLeft: 4 },

  addBtn: { background: "#fff", border: "1.5px solid #0c831f", color: "#0c831f", fontWeight: 800, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" },
  counter: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 8, padding: "2px" },
  counterBtn: { background: "transparent", border: "none", color: "#fff", fontWeight: 900, fontSize: 16, width: 26, height: 26, cursor: "pointer", lineHeight: 1 },
  counterNum: { color: "#fff", fontWeight: 800, fontSize: 13, padding: "0 4px", minWidth: 18, textAlign: "center" },

  categoriesWrap: { background: "#fff", borderRadius: 16, padding: 16 },
  catGroupTitle: { fontSize: 14, fontWeight: 800, color: "#0c831f", marginTop: 16, marginBottom: 8 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  catBox: { background: "#f8fafc", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid #e2e8f0" },

  profileWrap: { display: "flex", flexDirection: "column", gap: 12 },
  profileCard: { background: "#fff", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 14, border: "1px solid #e2e8f0" },
  profileAvatar: { fontSize: 36, background: "#f1f5f9", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  profilePhone: { fontSize: 13, color: "#64748b", marginTop: 2 },

  walletCard: { background: "linear-gradient(135deg, #0c831f, #15803d)", borderRadius: 16, padding: 18, color: "#fff" },
  walletCardTitle: { fontSize: 14, fontWeight: 700, opacity: 0.85 },
  walletCardBalance: { fontSize: 32, fontWeight: 900, marginTop: 4 },
  walletCardSub: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  walletProgressBar: { background: "rgba(255,255,255,0.25)", borderRadius: 999, height: 6, marginTop: 12 },
  walletProgress: { background: "#facc15", height: 6, borderRadius: 999, transition: "width 0.6s ease" },

  profileMenu: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" },
  profileMenuRow: { display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 600 },
  menuArrow: { color: "#94a3b8" },
  logoutBtn: { padding: 14, background: "#fff", border: "1.5px solid #0c831f", borderRadius: 12, color: "#0c831f", fontWeight: 800, fontSize: 15, cursor: "pointer" },
  versionTag: { textAlign: "center", fontSize: 12, color: "#94a3b8", paddingTop: 4 },

  cartBar: {
    position: "fixed",
    bottom: 64,
    left: 16,
    right: 16,
    background: "#0c831f",
    borderRadius: 14,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
    boxShadow: "0 8px 24px rgba(12,131,31,0.35)",
    cursor: "pointer",
    zIndex: 40,
    animation: "slideUp 0.3s ease",
  },
  cartLeft: {},
  cartCount: { fontSize: 10, fontWeight: 800, opacity: 0.85 },
  cartPrice: { fontSize: 18, fontWeight: 900 },
  cartRight: { fontSize: 14, fontWeight: 800 },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" },
  drawer: { background: "#fff", width: "100%", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto", padding: 20, paddingBottom: 32 },
  drawerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  drawerTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  drawerClose: { fontSize: 18, background: "#f1f5f9", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer" },
  drawerDelivery: { background: "#f0fdf4", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 2 },
  deliveryGreen: { fontSize: 13, fontWeight: 700, color: "#0c831f" },
  deliveryAddress: { fontSize: 12, color: "#64748b" },

  drawerItems: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  drawerItem: { display: "flex", alignItems: "center", gap: 12 },
  drawerItemImg: { width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid #e2e8f0" },
  drawerItemInfo: { flex: 1 },
  drawerItemName: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  drawerItemWeight: { fontSize: 11, color: "#94a3b8" },
  drawerItemPrice: { fontSize: 12, fontWeight: 600, color: "#0c831f", marginTop: 2 },

  billCard: { background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 16 },
  billTitle: { fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 },
  billRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", padding: "4px 0" },
  billDivider: { border: "none", borderTop: "1px dashed #d1d5db", margin: "8px 0" },
  paymentMethod: { display: "flex", justifyContent: "space-between", marginTop: 10, background: "#dcfce7", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 700, color: "#15803d" },

  errorBox: { background: "#fef2f2", borderRadius: 8, padding: "10px 12px", color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 12 },
  placeOrderBtn: { width: "100%", padding: 16, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer" },

  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: 60, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", zIndex: 30 },
  navTab: { flex: 1, height: "100%", border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" },
  navActiveBar: { position: "absolute", top: 0, width: 24, height: 3, background: "#0c831f", borderRadius: 2 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, marginTop: 2 },
};
