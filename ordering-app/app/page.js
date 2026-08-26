"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CATALOG } from "@/lib/items";

const WALLET_LIMIT = 1000000;

export default function OrderPage() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // Modal state
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
            setLocationLabel("Muniswamappa Layout, Bengaluru");
          }
        },
        () => {
          setLocationLabel("Muniswamappa Layout, Bengaluru");
          setLocationRequested(true);
        },
        { timeout: 10000 }
      );
    }

    // Blinkit Bike Splash animation timer (2 seconds)
    const timer = setTimeout(() => setLoading(false), 2000);
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

  // Filter Catalog by Search & Category
  const filteredCatalog = CATALOG.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function placeOrder() {
    if (!customer) { router.push("/login"); return; }
    if (cartEntries.length === 0) { setError("Your cart is empty."); return; }
    if (totalPrice > walletBalance) {
      setError(`Insufficient Blinkit Wallet balance. Available: ₹${walletBalance.toLocaleString("en-IN")}`);
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

  // 🛵 BLINKIT ANIMATED BIKE SPLASH SCREEN
  if (!customer || loading) {
    return (
      <div style={S.splash}>
        <style>{`
          @keyframes bikeZoom {
            0% { transform: translateX(-120px) scale(0.9); }
            50% { transform: translateX(40px) scale(1.1); }
            100% { transform: translateX(180px) scale(0.95); }
          }
          @keyframes roadMove {
            0% { background-position: 0 0; }
            100% { background-position: -40px 0; }
          }
          @keyframes pulseText {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
        <div style={S.splashContent}>
          <div style={S.splashLogo}>blinkit</div>
          <div style={S.splashTag}>India's Last Minute App</div>

          {/* Bike Animation Track */}
          <div style={S.bikeTrack}>
            <div style={S.bikeWrapper}>
              <span style={S.bikeEmoji}>🛵💨</span>
            </div>
            <div style={S.roadLine} />
          </div>

          <div style={S.splashStatus}>Delivering in 14 minutes...</div>
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
            placeholder='Search "milk, bread, tomato, ice cream..."'
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveTab("home"); }}
          />
          {searchQuery && (
            <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        {/* Category Pills Bar */}
        <div style={S.pills}>
          {[
            { id: "All", label: "All 🏷️" },
            { id: "Vegetables & Fruits", label: "🥦 Veggies & Fruits" },
            { id: "Dairy & Breakfast", label: "🥛 Dairy & Eggs" },
            { id: "Ice Creams & Frozen", label: "🍦 Ice Creams & Frozen" },
            { id: "Snacks & Drinks", label: "🍿 Snacks & Drinks" },
            { id: "Festive & Gifts", label: "🎁 Festive & Gifts" },
          ].map((cat) => (
            <button
              key={cat.id}
              style={{
                ...S.pill,
                ...(selectedCategory === cat.id ? S.pillActive : {}),
              }}
              onClick={() => { setSelectedCategory(cat.id); setActiveTab("home"); }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main style={S.main}>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            {/* Real Image Hero Banner */}
            <div style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
              <Image
                src="/assets/blinkit-festive-hero.jpeg"
                alt="Raksha Bandhan & Festive Special"
                width={480}
                height={220}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
                priority
              />
            </div>

            {/* Bestseller Spotlight Banner */}
            <div style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <Image
                src="/assets/blinkit-bestsellers.jpeg"
                alt="Bestsellers - Nandini Curd, Coriander, Potato"
                width={480}
                height={220}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
              />
            </div>

            <div style={S.sectionTitle}>
              {selectedCategory === "All" ? "Fresh Store Essentials" : selectedCategory}
            </div>

            {/* Product Grid */}
            <div style={S.productGrid}>
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                return (
                  <div key={item.sku} style={S.productCard}>
                    {/* Clickable Image to view Product Details */}
                    <div style={S.imageWrap} onClick={() => setSelectedProduct(item)}>
                      <img
                        src={item.image}
                        alt={item.name}
                        style={S.productImage}
                      />
                      <span style={S.deliveryChip}>⚡ {item.delivery}</span>
                      {discount > 0 && <span style={S.discountChip}>{discount}% OFF</span>}
                    </div>

                    <div style={S.productInfo}>
                      <div style={S.productWeight}>{item.weight}</div>
                      <div style={S.productName} onClick={() => setSelectedProduct(item)}>
                        {item.name}
                      </div>
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
            {/* Print Store Special Section */}
            <div style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              <Image
                src="/assets/blinkit-print-store.jpeg"
                alt="Blinkit Print Store & Documents"
                width={480}
                height={220}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
              />
            </div>

            <div style={S.sectionTitle}>Order Again</div>
            <div style={S.productGrid}>
              {CATALOG.slice(0, 6).map((item) => {
                const qty = cart[item.sku] || 0;
                return (
                  <div key={item.sku} style={S.productCard}>
                    <div style={S.imageWrap} onClick={() => setSelectedProduct(item)}>
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
            {/* Real Categories Grid Image Banner */}
            <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden" }}>
              <Image
                src="/assets/blinkit-categories-grid.jpeg"
                alt="Blinkit All Categories Overview"
                width={480}
                height={240}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
              />
            </div>

            {[
              { group: "Vegetables & Fruits", items: ["🥦 Fresh Vegetables", "🍎 Fresh Fruits", "🌿 Coriander & Herbs"] },
              { group: "Dairy & Breakfast", items: ["🥛 Nandini Milk & Curd", "🍞 Brown Bread", "🥚 Eggs & Butter"] },
              { group: "Ice Creams & Frozen", items: ["🍦 Vanilla & Chocolate Tubs", "🟢 Frozen Sweet Peas"] },
              { group: "Snacks & Beverage", items: ["🍿 Potato Chips", "🥤 Cold Drinks", "🍫 Chocolates"] },
            ].map(({ group, items }) => (
              <div key={group}>
                <div style={S.catGroupTitle}>{group}</div>
                <div style={S.catGrid}>
                  {items.map((it) => (
                    <div
                      key={it}
                      style={S.catBox}
                      onClick={() => {
                        setSelectedCategory(group);
                        setActiveTab("home");
                      }}
                    >
                      {it}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={S.profileWrap}>
            {/* Real Profile Header Banner */}
            <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
              <Image
                src="/assets/blinkit-account.jpeg"
                alt="Account Overview"
                width={480}
                height={220}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
              />
            </div>

            <div style={S.profileCard}>
              <div style={S.profileAvatar}>👤</div>
              <div>
                <div style={S.profileName}>{customer.name || `Customer ${customer.phone}`}</div>
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
                    width: `${Math.max(1, (walletBalance / WALLET_LIMIT) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Detailed App Options Asset */}
            <div style={{ borderRadius: 16, overflow: "hidden", margin: "12px 0" }}>
              <Image
                src="/assets/blinkit-profile.jpeg"
                alt="Blinkit Rewards and Donation Settings"
                width={480}
                height={240}
                style={{ width: "100%", height: "auto", objectFit: "cover", display: "block" }}
              />
            </div>

            <div style={S.profileMenu}>
              {["📦 Your Orders", "📍 Saved Addresses", "💳 Payment Methods", "🎁 Gift Cards", "🎧 Support"].map((item) => (
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

      {/* ── PRODUCT MODAL POPUP ── */}
      {selectedProduct && (
        <div style={S.drawerOverlay} onClick={() => setSelectedProduct(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setSelectedProduct(null)}>✕</button>
            <img src={selectedProduct.image} alt={selectedProduct.name} style={S.modalImg} />
            <div style={S.modalBody}>
              <div style={S.modalDelivery}>⚡ Delivered in 14 minutes</div>
              <div style={S.modalTitle}>{selectedProduct.name}</div>
              <div style={S.modalWeight}>{selectedProduct.weight} • {selectedProduct.aisle}</div>
              <div style={S.modalPriceRow}>
                <div>
                  <span style={S.modalPrice}>₹{selectedProduct.price}</span>
                  <span style={S.modalMrp}>MRP ₹{selectedProduct.mrp}</span>
                </div>
                {cart[selectedProduct.sku] ? (
                  <div style={S.counter}>
                    <button style={S.counterBtn} onClick={() => updateQty(selectedProduct.sku, -1)}>−</button>
                    <span style={S.counterNum}>{cart[selectedProduct.sku]}</span>
                    <button style={S.counterBtn} onClick={() => updateQty(selectedProduct.sku, 1)}>+</button>
                  </div>
                ) : (
                  <button style={S.modalAddBtn} onClick={() => updateQty(selectedProduct.sku, 1)}>
                    ADD TO CART
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
  splashContent: { textAlign: "center", width: "100%", maxWidth: 360, padding: 20 },
  splashLogo: { fontSize: 52, fontWeight: 900, color: "#0c831f", letterSpacing: "-2px" },
  splashTag: { fontSize: 16, color: "#3f6212", fontWeight: 700, marginTop: 4 },

  bikeTrack: { position: "relative", height: 70, marginTop: 40, overflow: "hidden", display: "flex", alignItems: "center" },
  bikeWrapper: { animation: "bikeZoom 2s cubic-bezier(0.4, 0, 0.2, 1) infinite" },
  bikeEmoji: { fontSize: 44 },
  roadLine: { position: "absolute", bottom: 10, left: 0, right: 0, height: 4, background: "repeating-linear-gradient(90deg, #0c831f, #0c831f 15px, transparent 15px, transparent 25px)", animation: "roadMove 0.4s linear infinite" },
  splashStatus: { fontSize: 14, fontWeight: 800, color: "#15803d", marginTop: 24, animation: "pulseText 1.5s ease-in-out infinite" },

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
  pill: { padding: "6px 14px", borderRadius: 20, background: "#f1f5f9", border: "none", fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap", cursor: "pointer" },
  pillActive: { background: "#0c831f", color: "#fff", fontWeight: 700 },

  main: { padding: 16, maxWidth: 480, margin: "0 auto" },

  sectionTitle: { fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 12 },

  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  productCard: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" },
  imageWrap: { position: "relative", height: 115, background: "#f8fafc", cursor: "pointer" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  deliveryChip: { position: "absolute", bottom: 5, left: 5, background: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" },
  discountChip: { position: "absolute", top: 5, right: 5, background: "#10b981", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 6 },

  productInfo: { padding: 10 },
  productWeight: { fontSize: 11, color: "#94a3b8", marginBottom: 2 },
  productName: { fontSize: 13, fontWeight: 700, color: "#0f172a", height: 34, overflow: "hidden", cursor: "pointer" },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  salePrice: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  mrpPrice: { fontSize: 11, color: "#94a3b8", textDecoration: "line-through", marginLeft: 4 },

  addBtn: { background: "#fff", border: "1.5px solid #0c831f", color: "#0c831f", fontWeight: 800, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" },
  counter: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 8, padding: "2px" },
  counterBtn: { background: "transparent", border: "none", color: "#fff", fontWeight: 900, fontSize: 16, width: 26, height: 26, cursor: "pointer", lineHeight: 1 },
  counterNum: { color: "#fff", fontWeight: 800, fontSize: 13, padding: "0 4px", minWidth: 18, textAlign: "center" },

  modalCard: { background: "#fff", width: "100%", maxWidth: 400, borderRadius: 20, overflow: "hidden", position: "relative" },
  modalClose: { position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", zIndex: 10, fontSize: 16 },
  modalImg: { width: "100%", height: 220, objectFit: "cover" },
  modalBody: { padding: 20 },
  modalDelivery: { color: "#0c831f", fontSize: 12, fontWeight: 800, marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  modalWeight: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 16 },
  modalPriceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalPrice: { fontSize: 22, fontWeight: 900, color: "#0f172a" },
  modalMrp: { fontSize: 13, color: "#94a3b8", textDecoration: "line-through", marginLeft: 6 },
  modalAddBtn: { background: "#0c831f", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer" },

  categoriesWrap: { background: "#fff", borderRadius: 16, padding: 16 },
  catGroupTitle: { fontSize: 14, fontWeight: 800, color: "#0c831f", marginTop: 16, marginBottom: 8 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  catBox: { background: "#f8fafc", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid #e2e8f0", cursor: "pointer" },

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

  cartBar: { position: "fixed", bottom: 64, left: 16, right: 16, background: "#0c831f", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", boxShadow: "0 8px 24px rgba(12,131,31,0.35)", cursor: "pointer", zIndex: 40 },
  cartLeft: {},
  cartCount: { fontSize: 10, fontWeight: 800, opacity: 0.85 },
  cartPrice: { fontSize: 18, fontWeight: 900 },
  cartRight: { fontSize: 14, fontWeight: 800 },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" },
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
