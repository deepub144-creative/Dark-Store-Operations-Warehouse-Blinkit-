"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CATALOG } from "@/lib/items";

const WALLET_LIMIT = 1000000;

export default function BlinkitApp() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Muniswamappa Layout, Bengaluru");
  const [activeAccountSection, setActiveAccountSection] = useState(null); // 'orders' | 'addresses' | 'payments' | 'support' | 'coupons'
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
              addr.village ||
              addr.road ||
              "Muniswamappa Layout, Bengaluru";
            setLocationLabel(label);
          } catch {
            setLocationLabel("Muniswamappa Layout, Bengaluru");
          }
        },
        () => setLocationLabel("Muniswamappa Layout, Bengaluru"),
        { timeout: 8000 }
      );
    }

    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [router]);

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
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
          <div style={S.splashTag}>India's Last Minute App</div>
          <div style={S.splashStatus}>Delivering in 8-14 minutes...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {toastMessage && <div style={S.toastBox}>{toastMessage}</div>}

      {/* ── OFFICIAL BLINKIT HEADER ── */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={S.brandLogo}>
              <span style={{ color: "#f7d108" }}>blink</span>
              <span style={{ color: "#0c831f" }}>it</span>
            </div>
            <div style={S.locationPill} onClick={() => triggerToast(`📍 Location: ${locationLabel}`)}>
              <div style={S.slaTime}>Delivery in 8 MINS</div>
              <div style={S.addressText}>{locationLabel} ▾</div>
            </div>
          </div>

          <div style={S.headerActions}>
            <div style={S.walletBadge} onClick={() => setActiveTab("profile")}>
              <span style={S.walletIcon}>💚</span>
              <span style={S.walletAmt}>₹{walletBalance.toLocaleString("en-IN")}</span>
            </div>
            <button
              style={S.accountBtn}
              onClick={() => setActiveTab("profile")}
            >
              Account
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={S.searchRow}>
          <span style={S.searchIcon}>🔍</span>
          <input
            style={S.searchInput}
            placeholder='Search "milk, bread, rakhi, snacks, curd..."'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeTab !== "home") setActiveTab("home");
            }}
          />
          {searchQuery && (
            <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        {/* Category Pills */}
        <div style={S.pills}>
          {[
            { id: "All", label: "All 🏷️" },
            { id: "Vegetables & Fruits", label: "🥦 Veggies & Fruits" },
            { id: "Dairy & Breakfast", label: "🥛 Dairy & Eggs" },
            { id: "Ice Creams & Frozen", label: "🍦 Ice Creams & Frozen" },
            { id: "Snacks & Drinks", label: "🍿 Snacks & Drinks" },
            { id: "Festive & Gifts", label: "🎁 Festive & Gifts" },
          ].map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                style={{ ...S.pill, ...(isActive ? S.pillActive : {}) }}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (activeTab !== "home") setActiveTab("home");
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN CONTAINER ── */}
      <main style={S.main}>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            <div
              style={S.bannerCard}
              onClick={() => { setSelectedCategory("Festive & Gifts"); triggerToast("🎁 Festive Collection!"); }}
            >
              <Image
                src="/assets/blinkit-festive-hero.jpeg"
                alt="Festive Special Banner"
                width={480}
                height={160}
                style={{ width: "100%", height: "160px", objectFit: "cover", borderRadius: 16 }}
              />
            </div>

            <div style={S.sectionHeaderRow}>
              <div style={S.sectionTitle}>{selectedCategory === "All" ? "Fresh Store Essentials" : selectedCategory}</div>
              <div style={S.resultCountBadge}>{filteredCatalog.length} Items</div>
            </div>

            <div style={S.productGrid}>
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                return (
                  <div key={item.sku} style={S.productCard}>
                    <div style={S.imageWrap} onClick={() => setSelectedProduct(item)}>
                      <img src={item.image} alt={item.name} style={S.productImage} />
                      <span style={S.deliveryChip}>⏱️ {item.delivery}</span>
                      {discount > 0 && <span style={S.discountChip}>{discount}% OFF</span>}
                    </div>

                    <div style={S.productInfo}>
                      <div style={S.productWeight}>{item.weight} • {item.aisle}</div>
                      <div style={S.productName} onClick={() => setSelectedProduct(item)}>{item.name}</div>

                      <div style={S.priceRow}>
                        <div>
                          <span style={S.salePrice}>₹{item.price}</span>
                          {item.mrp > item.price && <span style={S.mrpPrice}>₹{item.mrp}</span>}
                        </div>

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
            <div style={S.sectionTitle}>All Store Departments</div>
            <div style={S.catDepartmentGrid}>
              {[
                { cat: "Vegetables & Fruits", icon: "🥦", bg: "#f0fdf4", color: "#166534" },
                { cat: "Dairy & Breakfast", icon: "🥛", bg: "#eff6ff", color: "#1e40af" },
                { cat: "Ice Creams & Frozen", icon: "🍦", bg: "#fefce8", color: "#854d0e" },
                { cat: "Snacks & Drinks", icon: "🍿", bg: "#faf5ff", color: "#6b21a8" },
                { cat: "Festive & Gifts", icon: "🎁", bg: "#fdf2f8", color: "#9d174d" },
              ].map(({ cat, icon, bg, color }) => (
                <div
                  key={cat}
                  style={{ ...S.catDepartmentCard, background: bg }}
                  onClick={() => { setSelectedCategory(cat); setActiveTab("home"); }}
                >
                  <div style={S.catCardIcon}>{icon}</div>
                  <div style={{ flex: 1, fontWeight: 800, color }}>{cat}</div>
                  <div style={{ color }}>→</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OFFICIAL BLINKIT ACCOUNT / PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={S.profilePageWrap}>
            {/* Header User Card */}
            <div style={S.accountProfileCard}>
              <div style={S.userAvatar}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={S.userName}>{customer.name || `Customer ${customer.phone}`}</div>
                <div style={S.userPhone}>+91 {customer.phone}</div>
              </div>
              <button style={S.editProfileBtn} onClick={() => triggerToast("Editing account profile...")}>
                ✏️ Edit
              </button>
            </div>

            {/* Blink Cash / Wallet Card */}
            <div style={S.blinkWalletCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={S.bwLabel}>Blinkit Money & Wallet</div>
                  <div style={S.bwBalance}>₹{walletBalance.toLocaleString("en-IN")}</div>
                </div>
                <button style={S.topUpBtn} onClick={() => triggerToast("Wallet auto-recharged!")}>
                  + Add Money
                </button>
              </div>
            </div>

            {/* Grouped Account Options */}
            <div style={S.accountGroupCard}>
              <div style={S.accountGroupHeading}>YOUR INFORMATION</div>

              {[
                { id: "orders", icon: "📦", title: "Your Orders", desc: "View order history & track deliveries" },
                { id: "addresses", icon: "📍", title: "Saved Addresses", desc: locationLabel },
                { id: "payments", icon: "💳", title: "Payment Settings", desc: "Blinkit Wallet & Saved Cards" },
              ].map((row) => (
                <div
                  key={row.id}
                  style={S.accountRow}
                  onClick={() => setActiveAccountSection(row.id)}
                >
                  <span style={S.rowIcon}>{row.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowTitle}>{row.title}</div>
                    <div style={S.rowDesc}>{row.desc}</div>
                  </div>
                  <span style={S.rowChevron}>›</span>
                </div>
              ))}
            </div>

            <div style={S.accountGroupCard}>
              <div style={S.accountGroupHeading}>OFFERS & SUPPORT</div>

              {[
                { id: "coupons", icon: "🎁", title: "Offers & Coupons", desc: "1 Active ₹100 Discount Voucher" },
                { id: "support", icon: "🎧", title: "Customer Support & Help", desc: "24/7 SLA Resolution Assistance" },
              ].map((row) => (
                <div
                  key={row.id}
                  style={S.accountRow}
                  onClick={() => setActiveAccountSection(row.id)}
                >
                  <span style={S.rowIcon}>{row.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowTitle}>{row.title}</div>
                    <div style={S.rowDesc}>{row.desc}</div>
                  </div>
                  <span style={S.rowChevron}>›</span>
                </div>
              ))}
            </div>

            <button style={S.logoutAccountBtn} onClick={logout}>Log Out Account</button>
          </div>
        )}
      </main>

      {/* ── ACCOUNT SECTION MODAL DRAWER ── */}
      {activeAccountSection && (
        <div style={S.drawerOverlay} onClick={() => setActiveAccountSection(null)}>
          <div style={S.drawerCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div style={S.drawerTitle}>
                {activeAccountSection === "orders" && "📦 Your Orders History"}
                {activeAccountSection === "addresses" && "📍 Saved Delivery Addresses"}
                {activeAccountSection === "payments" && "💳 Payment Methods"}
                {activeAccountSection === "coupons" && "🎁 Offers & Coupons"}
                {activeAccountSection === "support" && "🎧 Customer Support & SLA Help"}
              </div>
              <button style={S.drawerCloseBtn} onClick={() => setActiveAccountSection(null)}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {activeAccountSection === "orders" && (
                <div>
                  <div style={S.orderHistoryItem}>
                    <div style={{ fontWeight: 800, color: "#0c831f" }}>Order #ORD-9821 • Delivered in 11 Mins</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>1x Nandini Milk (500ml), 1x Brown Bread</div>
                    <div style={{ fontWeight: 900, marginTop: 6 }}>Total: ₹72 • Paid via Blinkit Wallet</div>
                  </div>
                </div>
              )}

              {activeAccountSection === "addresses" && (
                <div>
                  <div style={S.addressItem}>
                    <div style={{ fontWeight: 800 }}>🏠 Home</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{locationLabel}</div>
                    <span style={S.defaultTag}>DEFAULT ADDRESS</span>
                  </div>
                </div>
              )}

              {activeAccountSection === "payments" && (
                <div>
                  <div style={S.paymentRow}>
                    <span>💚 Blinkit Wallet (Instant)</span>
                    <span style={{ fontWeight: 800, color: "#0c831f" }}>₹{walletBalance.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}

              {activeAccountSection === "coupons" && (
                <div>
                  <div style={S.couponCard}>
                    <div style={{ fontWeight: 900, color: "#0c831f" }}>CODE: BLINKIT100</div>
                    <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Flat ₹100 OFF on orders above ₹299</div>
                  </div>
                </div>
              )}

              {activeAccountSection === "support" && (
                <div>
                  <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
                    Need help with an order or quality refund? Our Dark Store Customer Support team is online 24/7!
                  </div>
                  <button
                    style={{ ...S.placeOrderBtn, marginTop: 16 }}
                    onClick={() => { triggerToast("Connecting to support chat..."); setActiveAccountSection(null); }}
                  >
                    💬 Start Instant Live Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div style={S.drawerOverlay} onClick={() => setShowCart(false)}>
          <div style={S.drawerCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div style={S.drawerTitle}>Your Cart ({totalItems} items)</div>
              <button style={S.drawerCloseBtn} onClick={() => setShowCart(false)}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku);
                if (!item) return null;
                return (
                  <div key={sku} style={S.cartItemRow}>
                    <img src={item.image} alt={item.name} style={S.cartItemImg} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{item.name}</div>
                      <div style={{ color: "#0c831f", fontWeight: 700, fontSize: 12 }}>₹{item.price * qty}</div>
                    </div>
                    <div style={S.counter}>
                      <button style={S.counterBtn} onClick={() => updateQty(sku, -1)}>−</button>
                      <span style={S.counterNum}>{qty}</span>
                      <button style={S.counterBtn} onClick={() => updateQty(sku, 1)}>+</button>
                    </div>
                  </div>
                );
              })}

              <div style={S.billCard}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                  <span>To Pay</span>
                  <span>₹{totalPrice}</span>
                </div>
              </div>

              {error && <div style={S.errorBox}>{error}</div>}

              <button style={S.placeOrderBtn} onClick={placeOrder} disabled={placingOrder}>
                {placingOrder ? "Processing..." : `Pay ₹${totalPrice} & Confirm →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CART BAR ── */}
      {totalItems > 0 && !showCart && (
        <div style={S.cartBar} onClick={() => setShowCart(true)}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{totalItems} ITEMS</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>₹{totalPrice}</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>View Cart →</div>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION ── */}
      <nav style={S.bottomNav}>
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "categories", icon: "🔲", label: "Categories" },
          { id: "profile", icon: "👤", label: "Account" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{ ...S.navTab, color: active ? "#0c831f" : "#64748b" }}
              onClick={() => setActiveTab(tab.id)}
            >
              {active && <div style={S.navActiveBar} />}
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 11, marginTop: 2, fontWeight: active ? 800 : 600 }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const S = {
  splash: { minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" },
  splashContent: { textAlign: "center" },
  splashLogo: { fontSize: 56, fontWeight: 900, letterSpacing: "-2px" },
  splashTag: { fontSize: 16, color: "#1c1c1c", fontWeight: 700, marginTop: 4 },
  splashStatus: { fontSize: 14, color: "#0c831f", fontWeight: 800, marginTop: 20 },

  app: { minHeight: "100vh", background: "#f4f6f8", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 },

  toastBox: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1c1c1c", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 100 },

  header: { background: "#fff", padding: "12px 16px 8px", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  brandLogo: { fontSize: 24, fontWeight: 900, letterSpacing: "-1px" },
  locationPill: { cursor: "pointer" },
  slaTime: { fontSize: 12, fontWeight: 900, color: "#1c1c1c" },
  addressText: { fontSize: 12, color: "#64748b", fontWeight: 600 },

  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  walletBadge: { background: "#e8f5e9", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" },
  walletIcon: { fontSize: 13 },
  walletAmt: { fontSize: 13, fontWeight: 800, color: "#0c831f" },
  accountBtn: { background: "none", border: "none", fontWeight: 800, fontSize: 14, color: "#1c1c1c", cursor: "pointer" },

  searchRow: { background: "#f2f2f2", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  searchIcon: { fontSize: 14, color: "#757575" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 600, color: "#1c1c1c" },
  clearSearch: { border: "none", background: "none", cursor: "pointer", color: "#757575", fontSize: 14 },

  pills: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 },
  pill: { padding: "6px 14px", borderRadius: 20, background: "#f2f2f2", border: "none", fontSize: 12, fontWeight: 700, color: "#757575", whiteSpace: "nowrap", cursor: "pointer" },
  pillActive: { background: "#0c831f", color: "#fff", fontWeight: 800 },

  main: { padding: 16, maxWidth: 500, margin: "0 auto" },

  bannerCard: { borderRadius: 16, overflow: "hidden", cursor: "pointer", marginBottom: 16 },

  sectionHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 900, color: "#1c1c1c" },
  resultCountBadge: { fontSize: 12, fontWeight: 700, color: "#0c831f", background: "#e8f5e9", padding: "2px 8px", borderRadius: 10 },

  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  productCard: { background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #eef2f5" },
  imageWrap: { position: "relative", height: 120, background: "#f8fafc", cursor: "pointer" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  deliveryChip: { position: "absolute", bottom: 6, left: 6, background: "#fff", fontSize: 10, fontWeight: 800, color: "#1c1c1c", padding: "2px 6px", borderRadius: 4 },
  discountChip: { position: "absolute", top: 6, right: 6, background: "#0c831f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 },

  productInfo: { padding: 10 },
  productWeight: { fontSize: 11, color: "#757575", fontWeight: 600 },
  productName: { fontSize: 13, fontWeight: 800, color: "#1c1c1c", height: 34, overflow: "hidden", cursor: "pointer", marginTop: 2 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  salePrice: { fontSize: 15, fontWeight: 900, color: "#1c1c1c" },
  mrpPrice: { fontSize: 11, color: "#757575", textDecoration: "line-through", marginLeft: 4 },

  addBtn: { background: "#fff", border: "1px solid #0c831f", color: "#0c831f", fontWeight: 900, fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer" },
  counter: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 6, padding: "2px" },
  counterBtn: { background: "transparent", border: "none", color: "#fff", fontWeight: 900, fontSize: 15, width: 22, height: 22, cursor: "pointer" },
  counterNum: { color: "#fff", fontWeight: 900, fontSize: 12, padding: "0 4px" },

  categoriesWrap: { background: "#fff", borderRadius: 16, padding: 16 },
  catDepartmentGrid: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  catDepartmentCard: { display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, cursor: "pointer" },
  catCardIcon: { fontSize: 24 },

  profilePageWrap: { display: "flex", flexDirection: "column", gap: 14 },
  accountProfileCard: { background: "#fff", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12, border: "1px solid #eef2f5" },
  userAvatar: { fontSize: 28, background: "#f2f2f2", width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 17, fontWeight: 900, color: "#1c1c1c" },
  userPhone: { fontSize: 13, color: "#757575", marginTop: 2 },
  editProfileBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 800, fontSize: 13, cursor: "pointer" },

  blinkWalletCard: { background: "linear-gradient(135deg, #0c831f, #15803d)", borderRadius: 16, padding: 18, color: "#fff" },
  bwLabel: { fontSize: 13, opacity: 0.9, fontWeight: 700 },
  bwBalance: { fontSize: 28, fontWeight: 900, marginTop: 2 },
  topUpBtn: { background: "#fff", color: "#0c831f", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 900, fontSize: 12, cursor: "pointer" },

  accountGroupCard: { background: "#fff", borderRadius: 16, padding: "12px 16px", border: "1px solid #eef2f5" },
  accountGroupHeading: { fontSize: 11, fontWeight: 900, color: "#757575", letterSpacing: "0.5px", marginBottom: 8 },
  accountRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f8f8f8", cursor: "pointer" },
  rowIcon: { fontSize: 20 },
  rowTitle: { fontSize: 14, fontWeight: 800, color: "#1c1c1c" },
  rowDesc: { fontSize: 12, color: "#757575", marginTop: 2 },
  rowChevron: { color: "#757575", fontSize: 16, fontWeight: 800 },

  logoutAccountBtn: { width: "100%", padding: 14, background: "#fff", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer" },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  drawerCard: { background: "#fff", width: "100%", maxWidth: 500, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" },
  drawerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f2f2f2" },
  drawerTitle: { fontSize: 17, fontWeight: 900, color: "#1c1c1c" },
  drawerCloseBtn: { background: "#f2f2f2", border: "none", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontWeight: 800 },

  orderHistoryItem: { background: "#f8f8f8", padding: 14, borderRadius: 12 },
  addressItem: { background: "#f8f8f8", padding: 14, borderRadius: 12, position: "relative" },
  defaultTag: { background: "#0c831f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, marginTop: 6, display: "inline-block" },
  paymentRow: { display: "flex", justifyContent: "space-between", background: "#f8f8f8", padding: 14, borderRadius: 12 },
  couponCard: { background: "#e8f5e9", border: "1px dashed #0c831f", padding: 14, borderRadius: 12 },

  cartItemRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  cartItemImg: { width: 44, height: 44, borderRadius: 8, objectFit: "cover" },
  billCard: { background: "#f8f8f8", padding: 14, borderRadius: 12, margin: "16px 0" },
  errorBox: { color: "#dc2626", fontSize: 13, fontWeight: 700, marginBottom: 10 },
  placeOrderBtn: { width: "100%", padding: 15, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer" },

  cartBar: { position: "fixed", bottom: 64, left: 16, right: 16, background: "#0c831f", borderRadius: 14, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", cursor: "pointer", zIndex: 40 },

  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: 60, background: "#fff", borderTop: "1px solid #f2f2f2", display: "flex", zIndex: 30 },
  navTab: { flex: 1, height: "100%", border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" },
  navActiveBar: { position: "absolute", top: 0, width: 24, height: 3, background: "#0c831f", borderRadius: 2 },
};
