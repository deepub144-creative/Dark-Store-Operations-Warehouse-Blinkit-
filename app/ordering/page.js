"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";

const WALLET_LIMIT = 1000000;

export default function OrderingAppPage() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Muniswamappa Layout, Bengaluru (KA)");
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'cart' | 'categories' | 'print' | 'profile'
  const [showAppsModal, setShowAppsModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("blinkit_customer");
    if (!raw) {
      const demoCust = { customerId: "cust_demo", name: "Deepu B", phone: "8050475078", walletBalance: 999920 };
      localStorage.setItem("blinkit_customer", JSON.stringify(demoCust));
      setCustomer(demoCust);
    } else {
      setCustomer(JSON.parse(raw));
    }

    const timer = setTimeout(() => setLoading(false), 400);
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

  const categories = ["All", ...new Set(CATALOG.map((c) => c.category))];

  const filteredCatalog = CATALOG.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.aisle && item.aisle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  async function placeOrder() {
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
          customerId: customer?.customerId || "cust_demo",
          customerName: customer?.name || "Deepu B",
          customerPhone: customer?.phone || "8050475078",
          cart: cartEntries.map(([sku, qty]) => ({ sku, qty })),
          location: { address: locationLabel }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order placement failed");

      const updated = { ...customer, walletBalance: walletBalance - totalPrice };
      localStorage.setItem("blinkit_customer", JSON.stringify(updated));

      // Store in local storage fallback for live reference
      const localOrders = JSON.parse(localStorage.getItem("auditx_orders") || "[]");
      localOrders.unshift(data.order || { orderId: data.orderId, totalAmount: totalPrice, status: "PLACED" });
      localStorage.setItem("auditx_orders", JSON.stringify(localOrders));

      setCart({});
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#e23744", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-1px" }}>blinkit</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>14 minutes instant dark store delivery</div>
          <div style={{ width: 28, height: 28, border: "3px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "20px auto 0" }} />
        </div>
      </div>
    );
  }

  const isHome = activeTab === "home";
  const headerClass = isHome ? "figma-header header-red" : "figma-header header-yellow";

  return (
    <div className="app-container">
      {toastMessage && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 20px", borderRadius: 20, fontWeight: 800, fontSize: 13, zIndex: 200 }}>
          {toastMessage}
        </div>
      )}

      {/* ── HEADER ── */}
      <header className={headerClass}>
        <div className="header-content-inner">
          <div className="header-top-row">
            <div className="header-title-block" onClick={() => { setActiveTab("home"); setSearchQuery(""); }}>
              <span className="header-sub-text">Blinkit Dark Store in</span>
              <span className="header-sla-title">14 minutes</span>
              <div className="header-location-row">
                <span>📍 HOME - {locationLabel}</span>
                <span>▼</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={{
                  background: "#1e293b",
                  color: "#f8cb46",
                  border: "1px solid #f8cb46",
                  borderRadius: 20,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => router.push("/")}
              >
                <span>🏬 Multi-App Portal</span>
              </button>

              <div className="user-profile-circle" onClick={() => setActiveTab(activeTab === "profile" ? "home" : "profile")}>
                👤
              </div>
            </div>
          </div>

          <div className="header-search-bar">
            <span style={{ fontSize: 16, color: "#64748b" }}>🔍</span>
            <input
              className="search-input-field"
              placeholder='Search "tomatoes", "milk", "ice cream", "chips", "rakhi"...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button style={{ border: "none", background: "none", cursor: "pointer", fontWeight: 800 }} onClick={() => setSearchQuery("")}>✕</button>
            ) : (
              <div className="search-mic-divider">
                <span>|</span>
                <span>🎙️</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── SEARCH OVERLAY DRILL-DOWN ── */}
      {searchQuery.length > 0 && (
        <main className="section-wrapper" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>
            Showing results for "{searchQuery}" ({filteredCatalog.length} items)
          </div>
          <div className="product-cards-grid">
            {filteredCatalog.map((item) => {
              const qty = cart[item.sku] || 0;
              return (
                <div key={item.sku} className="figma-product-card">
                  <div className="product-img-wrap" onClick={() => setSelectedProduct(item)}>
                    <img src={item.image} alt={item.name} className="product-img-file" />
                  </div>
                  <div className="product-sla-tag">⚡ 14 MINS</div>
                  <div className="product-name-title" onClick={() => setSelectedProduct(item)}>{item.name}</div>
                  <div className="product-price-row">
                    <span className="product-price-bold">₹ {item.price}</span>
                    {qty === 0 ? (
                      <button className="product-add-badge" onClick={() => updateQty(item.sku, 1)}>ADD</button>
                    ) : (
                      <button className="product-add-badge" style={{ background: "#0c831f", color: "#fff" }} onClick={() => updateQty(item.sku, 1)}>{qty} in Cart</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ── HOME TAB SCREEN ── */}
      {searchQuery.length === 0 && activeTab === "home" && (
        <main>
          {/* Hero Banner */}
          <section className="hero-diwali-banner">
            <div className="hero-diwali-inner">
              <div className="hero-diwali-title">
                <span>✨ Dark Store Flash Sale ✨</span>
              </div>

              <div className="hero-cards-row no-scrollbar">
                <div className="hero-card-item" style={{ background: "#fce4ec" }} onClick={() => setSelectedCategory("Vegetables & Fruits")}>
                  <div className="hero-card-text">Fresh Veggies & Fruits</div>
                  <img src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=300&q=80" alt="Veggies" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#f3e5f5" }} onClick={() => setSelectedCategory("Dairy & Breakfast")}>
                  <div className="hero-card-text">Dairy, Bread & Eggs</div>
                  <img src="https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=300&q=80" alt="Dairy" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#eceff1" }} onClick={() => setSelectedCategory("Ice Creams & Frozen")}>
                  <div className="hero-card-text">Ice Creams & Frozen</div>
                  <img src="https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=300&q=80" alt="Ice Cream" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#fffde7" }} onClick={() => setSelectedCategory("Festive & Gifts")}>
                  <div className="hero-card-text">Festive Sweets & Gifts</div>
                  <img src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=300&q=80" alt="Gifts" className="hero-card-img" />
                </div>
              </div>
            </div>
          </section>

          {/* Quick Category Filter Pills */}
          <section className="section-wrapper" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }} className="no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  style={{
                    background: selectedCategory === cat ? "#0c831f" : "#f1f5f9",
                    color: selectedCategory === cat ? "#fff" : "#0f172a",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 20,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Catalog Grid */}
          <section className="section-wrapper">
            <div className="section-title">Trending Items in Dark Store</div>
            <div className="product-cards-grid">
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                return (
                  <div key={item.sku} className="figma-product-card">
                    <div className="product-img-wrap" onClick={() => setSelectedProduct(item)}>
                      <img src={item.image} alt={item.name} className="product-img-file" />
                    </div>
                    <div className="product-sla-tag">⚡ 14 MINS</div>
                    <div className="product-name-title" onClick={() => setSelectedProduct(item)}>{item.name}</div>
                    <div className="product-price-row">
                      <div>
                        <span className="product-price-bold">₹{item.price}</span>
                        {item.mrp > item.price && (
                          <span style={{ fontSize: 11, textDecoration: "line-through", color: "#94a3b8", marginLeft: 4 }}>₹{item.mrp}</span>
                        )}
                      </div>
                      {qty === 0 ? (
                        <button className="product-add-badge" onClick={() => updateQty(item.sku, 1)}>ADD</button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", background: "#0c831f", color: "#fff", borderRadius: 8, padding: "2px 6px", fontWeight: 900, fontSize: 12 }}>
                          <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }} onClick={() => updateQty(item.sku, -1)}>−</button>
                          <span style={{ margin: "0 6px" }}>{qty}</span>
                          <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }} onClick={() => updateQty(item.sku, 1)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      )}

      {/* ── CATEGORIES TAB SCREEN ── */}
      {searchQuery.length === 0 && activeTab === "categories" && (
        <main className="section-wrapper" style={{ marginTop: 24 }}>
          {categories.filter((c) => c !== "All").map((cat) => (
            <section key={cat} style={{ marginBottom: 28 }}>
              <div className="section-title">{cat}</div>
              <div className="product-cards-grid">
                {CATALOG.filter((item) => item.category === cat).map((item) => {
                  const qty = cart[item.sku] || 0;
                  return (
                    <div key={item.sku} className="figma-product-card">
                      <div className="product-img-wrap" onClick={() => setSelectedProduct(item)}>
                        <img src={item.image} alt={item.name} className="product-img-file" />
                      </div>
                      <div className="product-name-title">{item.name}</div>
                      <div className="product-price-row">
                        <span className="product-price-bold">₹{item.price}</span>
                        <button className="product-add-badge" onClick={() => updateQty(item.sku, 1)}>
                          {qty > 0 ? `${qty} in Cart` : "ADD"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      )}

      {/* ── CART TAB SCREEN ── */}
      {searchQuery.length === 0 && activeTab === "cart" && (
        <main className="section-wrapper" style={{ marginTop: 24 }}>
          {cartEntries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 50, marginBottom: 10 }}>🛍️</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Your Cart is Empty</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Add fresh groceries and items from dark store to place an instant order!
              </div>
              <button
                style={{ marginTop: 20, background: "#0c831f", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
                onClick={() => setActiveTab("home")}
              >
                Browse Dark Store Items
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 600, margin: "0 auto", background: "#ffffff", padding: 24, borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>My Cart ({totalItems} items)</div>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku) || { name: sku, price: 50 };
                return (
                  <div key={sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {item.image && <img src={item.image} alt={item.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{item.name}</div>
                        <div style={{ fontSize: 13, color: "#0c831f", fontWeight: 700 }}>₹{item.price * qty}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 8, padding: "2px 8px", color: "#fff", fontWeight: 900 }}>
                      <button style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }} onClick={() => updateQty(sku, -1)}>−</button>
                      <span style={{ margin: "0 8px" }}>{qty}</span>
                      <button style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }} onClick={() => updateQty(sku, 1)}>+</button>
                    </div>
                  </div>
                );
              })}

              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, margin: "20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 16 }}>
                  <span>Total Bill</span>
                  <span style={{ color: "#0c831f" }}>₹{totalPrice}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>⚡ Free 14-min Dark Store Express Delivery</div>
              </div>

              {error && <div style={{ color: "#dc2626", fontWeight: 700, margin: "10px 0" }}>{error}</div>}

              <button
                style={{ width: "100%", padding: 16, background: "#0c831f", color: "#fff", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: "pointer" }}
                onClick={placeOrder}
                disabled={placingOrder}
              >
                {placingOrder ? "Placing Order..." : `Pay ₹${totalPrice} & Track Order Live →`}
              </button>
            </div>
          )}
        </main>
      )}

      {/* ── PROFILE ACCOUNT TAB ── */}
      {activeTab === "profile" && (
        <main className="section-wrapper" style={{ marginTop: 24, maxWidth: 600 }}>
          <div style={{ background: "#ffffff", padding: 20, borderRadius: 18, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 36 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{customer?.name || "Deepu B"}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>+91 {customer?.phone || "8050475078"}</div>
            </div>
            <button style={{ background: "#fee2e2", border: "none", color: "#dc2626", padding: "8px 16px", borderRadius: 8, fontWeight: 800, cursor: "pointer" }} onClick={logout}>Log Out</button>
          </div>

          <div style={{ background: "linear-gradient(135deg, #0c831f, #15803d)", padding: 24, borderRadius: 18, color: "#fff" }}>
            <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>💚 Blinkit Wallet Balance</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>₹{walletBalance.toLocaleString("en-IN")}</div>
          </div>
        </main>
      )}

      {/* ── BOTTOM NAVIGATION ── */}
      <nav className="figma-bottom-nav">
        <button className={`figma-nav-btn ${activeTab === "home" ? "active" : ""}`} onClick={() => { setActiveTab("home"); setSearchQuery(""); }}>
          <span className="figma-nav-icon">🏠</span>
          <span className="figma-nav-label">Home</span>
          {activeTab === "home" && <div className="figma-active-indicator" />}
        </button>

        <button className={`figma-nav-btn ${activeTab === "cart" ? "active" : ""}`} onClick={() => { setActiveTab("cart"); setSearchQuery(""); }}>
          <span className="figma-nav-icon">🛍️</span>
          <span className="figma-nav-label">Cart</span>
          {totalItems > 0 && <span className="cart-nav-badge">{totalItems}</span>}
          {activeTab === "cart" && <div className="figma-active-indicator" />}
        </button>

        <button className={`figma-nav-btn ${activeTab === "categories" ? "active" : ""}`} onClick={() => { setActiveTab("categories"); setSearchQuery(""); }}>
          <span className="figma-nav-icon">🔲</span>
          <span className="figma-nav-label">Categories</span>
          {activeTab === "categories" && <div className="figma-active-indicator" />}
        </button>
      </nav>
    </div>
  );
}
