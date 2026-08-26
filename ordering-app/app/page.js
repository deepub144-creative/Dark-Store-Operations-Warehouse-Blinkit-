"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";

const WALLET_LIMIT = 1000000;

export default function BlinkitFigmaApp() {
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Sujal Dave, Ratanada, Jodhpur (Raj)");
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'cart' | 'categories' | 'print' | 'profile'
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

    const timer = setTimeout(() => setLoading(false), 500);
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

  if (!customer || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#e23744", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 900 }}>blinkit</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>16 minutes delivery</div>
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

      {/* ── FIGMA HEADER (MATCHING DOWNLOADED COMMUNITY UI) ── */}
      <header className={headerClass}>
        <div className="header-content-inner">
          <div className="header-top-row">
            <div className="header-title-block" onClick={() => { setActiveTab("home"); setSearchQuery(""); }}>
              <span className="header-sub-text">Blinkit in</span>
              <span className="header-sla-title">16 minutes</span>
              <div className="header-location-row">
                <span>HOME - {locationLabel}</span>
                <span>▼</span>
              </div>
            </div>

            <div className="user-profile-circle" onClick={() => setActiveTab(activeTab === "profile" ? "home" : "profile")}>
              👤
            </div>
          </div>

          <div className="header-search-bar">
            <span style={{ fontSize: 16, color: "#64748b" }}>🔍</span>
            <input
              className="search-input-field"
              placeholder='Search "ice-cream", "paneer", "milk", "chocolates"...'
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
                  <div className="product-sla-tag">⏱️ 16 MINS</div>
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

      {/* ── HOME TAB SCREEN (MATCHING BLINKIT HOME SCREEN FIGMA DESIGN) ── */}
      {searchQuery.length === 0 && activeTab === "home" && (
        <main>
          {/* Mega Diwali Sale Hero Section */}
          <section className="hero-diwali-banner">
            <div className="hero-diwali-inner">
              <div className="hero-diwali-title">
                <span>✨ Mega Diwali Sale ✨</span>
              </div>

              <div className="hero-cards-row no-scrollbar">
                <div className="hero-card-item" style={{ background: "#fce4ec" }} onClick={() => triggerToast("Exploring Lights & Diyas")}>
                  <div className="hero-card-text">Lights, Diyas & Candles</div>
                  <img src="/assets/figma-assets/hero_lights.png" alt="Diyas" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#f3e5f5" }} onClick={() => triggerToast("Exploring Diwali Gifts")}>
                  <div className="hero-card-text">Diwali Gifts</div>
                  <img src="/assets/figma-assets/hero_gifts.png" alt="Gifts" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#eceff1" }} onClick={() => triggerToast("Exploring Appliances")}>
                  <div className="hero-card-text">Appliances & Gadgets</div>
                  <img src="/assets/figma-assets/hero_appliances.png" alt="Appliances" className="hero-card-img" />
                </div>

                <div className="hero-card-item" style={{ background: "#fffde7" }} onClick={() => triggerToast("Exploring Home & Living")}>
                  <div className="hero-card-text">Home & Living</div>
                  <img src="/assets/figma-assets/hero_living.png" alt="Home" className="hero-card-img" />
                </div>
              </div>
            </div>
          </section>

          {/* Bestsellers Section */}
          <section className="section-wrapper">
            <div className="product-cards-grid">
              <div className="figma-product-card">
                <div className="product-img-wrap">
                  <img src="/assets/figma-assets/prod_candle.png" alt="Golden Glass Wooden Lid Candle" className="product-img-file" />
                </div>
                <div className="product-name-title">Golden Glass Wooden Lid Candle (Oudh)</div>
                <div className="product-sla-tag">⏱️ 16 MINS</div>
                <div className="product-price-row">
                  <span className="product-price-bold">₹ 79</span>
                  <button className="product-add-badge" onClick={() => updateQty("candle_oudh", 1)}>ADD</button>
                </div>
              </div>

              <div className="figma-product-card">
                <div className="product-img-wrap">
                  <img src="/assets/figma-assets/prod_sweets.png" alt="Royal Gulab Jamun By Bikano" className="product-img-file" />
                </div>
                <div className="product-name-title">Royal Gulab Jamun By Bikano</div>
                <div className="product-sla-tag">⏱️ 16 MINS</div>
                <div className="product-price-row">
                  <span className="product-price-bold">₹ 79</span>
                  <button className="product-add-badge" onClick={() => updateQty("gulab_jamun", 1)}>ADD</button>
                </div>
              </div>

              <div className="figma-product-card">
                <div className="product-img-wrap">
                  <img src="/assets/figma-assets/cat_biscuits.png" alt="Bikaji Bhujia" className="product-img-file" />
                </div>
                <div className="product-name-title">Bikaji Bhujia</div>
                <div className="product-sla-tag">⏱️ 16 MINS</div>
                <div className="product-price-row">
                  <span className="product-price-bold">₹ 79</span>
                  <button className="product-add-badge" onClick={() => updateQty("bikaji_bhujia", 1)}>ADD</button>
                </div>
              </div>
            </div>
          </section>

          {/* Grocery & Kitchen Section */}
          <section className="section-wrapper">
            <div className="section-title">Grocery & Kitchen</div>
            <div className="category-cards-grid">
              <div className="mint-category-card" onClick={() => setActiveTab("categories")}>
                <img src="/assets/figma-assets/cat_veggies.png" alt="Vegetables & Fruits" className="mint-card-img" />
                <div className="mint-card-title">Vegetables & Fruits</div>
              </div>

              <div className="mint-category-card" onClick={() => setActiveTab("categories")}>
                <img src="/assets/figma-assets/cat_atta.png" alt="Atta, Dal & Rice" className="mint-card-img" />
                <div className="mint-card-title">Atta, Dal & Rice</div>
              </div>

              <div className="mint-category-card" onClick={() => setActiveTab("categories")}>
                <img src="/assets/figma-assets/cat_oil.png" alt="Oil, Ghee & Masala" className="mint-card-img" />
                <div className="mint-card-title">Oil, Ghee & Masala</div>
              </div>

              <div className="mint-category-card" onClick={() => setActiveTab("categories")}>
                <img src="/assets/figma-assets/cat_dairy.png" alt="Dairy, Bread & Milk" className="mint-card-img" />
                <div className="mint-card-title">Dairy, Bread & Milk</div>
              </div>

              <div className="mint-category-card" onClick={() => setActiveTab("categories")}>
                <img src="/assets/figma-assets/cat_biscuits.png" alt="Biscuits & Bakery" className="mint-card-img" />
                <div className="mint-card-title">Biscuits & Bakery</div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ── CATEGORIES TAB SCREEN (MATCHING BLINKIT CATEGORY SCREEN FIGMA DESIGN) ── */}
      {searchQuery.length === 0 && activeTab === "categories" && (
        <main className="section-wrapper" style={{ marginTop: 24 }}>
          {/* Grocery & Kitchen */}
          <section style={{ marginBottom: 28 }}>
            <div className="section-title">Grocery & Kitchen</div>
            <div className="category-cards-grid">
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_veggies.png" alt="Vegetables & Fruits" className="mint-card-img" />
                <div className="mint-card-title">Vegetables & Fruits</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_atta.png" alt="Atta, Dal & Rice" className="mint-card-img" />
                <div className="mint-card-title">Atta, Dal & Rice</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_oil.png" alt="Oil, Ghee & Masala" className="mint-card-img" />
                <div className="mint-card-title">Oil, Ghee & Masala</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_dairy.png" alt="Dairy, Bread & Milk" className="mint-card-img" />
                <div className="mint-card-title">Dairy, Bread & Milk</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_biscuits.png" alt="Biscuits & Bakery" className="mint-card-img" />
                <div className="mint-card-title">Biscuits & Bakery</div>
              </div>
            </div>
          </section>

          {/* Snacks & Drinks */}
          <section style={{ marginBottom: 28 }}>
            <div className="section-title">Snacks & Drinks</div>
            <div className="category-cards-grid">
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_biscuits.png" alt="Chips & Namkeens" className="mint-card-img" />
                <div className="mint-card-title">Chips & Namkeens</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/prod_sweets.png" alt="Sweets & Chocolates" className="mint-card-img" />
                <div className="mint-card-title">Sweets & Chocolates</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_dairy.png" alt="Drinks & Juices" className="mint-card-img" />
                <div className="mint-card-title">Drinks & Juices</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/cat_oil.png" alt="Sauces & Spreads" className="mint-card-img" />
                <div className="mint-card-title">Sauces & Spreads</div>
              </div>
              <div className="mint-category-card">
                <img src="/assets/figma-assets/hero_gifts.png" alt="Beauty & Cosmetics" className="mint-card-img" />
                <div className="mint-card-title">Beauty & Cosmetics</div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ── CART / REORDER TAB SCREEN (MATCHING BLINKIT CART SCREEN FIGMA DESIGN) ── */}
      {searchQuery.length === 0 && activeTab === "cart" && (
        <main className="section-wrapper" style={{ marginTop: 24 }}>
          {cartEntries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0 40px" }}>
              <img src="/assets/figma-assets/cart_empty_illustration.png" alt="Cart Illustration" style={{ maxHeight: 180, objectFit: "contain" }} />
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 16 }}>Reordering will be easy</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Items you order will show up here so you can buy them again easily.
              </div>

              {/* Bestsellers Recommendations */}
              <div style={{ textAlign: "left", marginTop: 36 }}>
                <div className="section-title">Bestsellers</div>
                <div className="product-cards-grid">
                  <div className="figma-product-card">
                    <div className="product-img-wrap">
                      <img src="/assets/figma-assets/cat_dairy.png" alt="Amul Taaza Toned Fresh Milk" className="product-img-file" />
                    </div>
                    <div className="product-name-title">Amul Taaza Toned Fresh Milk</div>
                    <div className="product-sla-tag">⏱️ 16 MINS</div>
                    <div className="product-price-row">
                      <span className="product-price-bold">₹ 27</span>
                      <button className="product-add-badge" onClick={() => updateQty("amul_milk", 1)}>ADD</button>
                    </div>
                  </div>

                  <div className="figma-product-card">
                    <div className="product-img-wrap">
                      <img src="/assets/figma-assets/cat_veggies.png" alt="Potato (Aloo)" className="product-img-file" />
                    </div>
                    <div className="product-name-title">Potato (Aloo)</div>
                    <div className="product-sla-tag">⏱️ 16 MINS</div>
                    <div className="product-price-row">
                      <span className="product-price-bold">₹ 37</span>
                      <button className="product-add-badge" onClick={() => updateQty("potato_aloo", 1)}>ADD</button>
                    </div>
                  </div>

                  <div className="figma-product-card">
                    <div className="product-img-wrap">
                      <img src="/assets/figma-assets/cat_veggies.png" alt="Hybrid Tomato" className="product-img-file" />
                    </div>
                    <div className="product-name-title">Hybrid Tomato</div>
                    <div className="product-sla-tag">⏱️ 16 MINS</div>
                    <div className="product-price-row">
                      <span className="product-price-bold">₹ 37</span>
                      <button className="product-add-badge" onClick={() => updateQty("tomato_hybrid", 1)}>ADD</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 600, margin: "0 auto", background: "#ffffff", padding: 24, borderRadius: 20, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>My Cart ({totalItems} items)</div>
              {cartEntries.map(([sku, qty]) => {
                const item = CATALOG.find((c) => c.sku === sku) || { name: sku, price: 79 };
                return (
                  <div key={sku} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{item.name}</div>
                      <div style={{ fontSize: 13, color: "#0c831f", fontWeight: 700 }}>₹{item.price * qty}</div>
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
                  <span>₹{totalPrice}</span>
                </div>
              </div>

              {error && <div style={{ color: "#dc2626", fontWeight: 700, margin: "10px 0" }}>{error}</div>}

              <button
                style={{ width: "100%", padding: 16, background: "#0c831f", color: "#fff", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: "pointer" }}
                onClick={placeOrder}
                disabled={placingOrder}
              >
                {placingOrder ? "Placing Order..." : `Pay ₹${totalPrice} & Place Order →`}
              </button>
            </div>
          )}
        </main>
      )}

      {/* ── PRINT STORE TAB SCREEN ── */}
      {searchQuery.length === 0 && activeTab === "print" && (
        <main className="section-wrapper" style={{ marginTop: 24, maxWidth: 600 }}>
          <div style={{ background: "#ffffff", padding: 28, borderRadius: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🖨️</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Blinkit Print Store</div>
            <div style={{ fontSize: 13, color: "#64748b", margin: "8px 0 20px" }}>
              Get black & white or color document prints delivered to your doorstep in 16 minutes!
            </div>
            <button
              style={{ width: "100%", padding: 14, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer" }}
              onClick={() => triggerToast("Upload PDF function ready")}
            >
              Upload Document PDF →
            </button>
          </div>
        </main>
      )}

      {/* ── PROFILE ACCOUNT TAB ── */}
      {activeTab === "profile" && (
        <main className="section-wrapper" style={{ marginTop: 24, maxWidth: 600 }}>
          <div style={{ background: "#ffffff", padding: 20, borderRadius: 18, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 36 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{customer.name || `Customer ${customer.phone}`}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>+91 {customer.phone}</div>
            </div>
            <button style={{ background: "#fee2e2", border: "none", color: "#dc2626", padding: "8px 16px", borderRadius: 8, fontWeight: 800, cursor: "pointer" }} onClick={logout}>Log Out</button>
          </div>

          <div style={{ background: "linear-gradient(135deg, #0c831f, #15803d)", padding: 24, borderRadius: 18, color: "#fff" }}>
            <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>💚 Blinkit Wallet Balance</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>₹{walletBalance.toLocaleString("en-IN")}</div>
          </div>
        </main>
      )}

      {/* ── FIGMA BOTTOM NAVIGATION BAR (HOMEPAGE, CART, CATEGORIES, PRINT STORE) ── */}
      <nav className="figma-bottom-nav">
        <button
          className={`figma-nav-btn ${activeTab === "home" ? "active" : ""}`}
          onClick={() => { setActiveTab("home"); setSearchQuery(""); }}
        >
          <span className="figma-nav-icon">🏠</span>
          <span className="figma-nav-label">Home</span>
          {activeTab === "home" && <div className="figma-active-indicator" />}
        </button>

        <button
          className={`figma-nav-btn ${activeTab === "cart" ? "active" : ""}`}
          onClick={() => { setActiveTab("cart"); setSearchQuery(""); }}
        >
          <span className="figma-nav-icon">🛍️</span>
          <span className="figma-nav-label">Cart</span>
          {totalItems > 0 && <span className="cart-nav-badge">{totalItems}</span>}
          {activeTab === "cart" && <div className="figma-active-indicator" />}
        </button>

        <button
          className={`figma-nav-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => { setActiveTab("categories"); setSearchQuery(""); }}
        >
          <span className="figma-nav-icon">🔲</span>
          <span className="figma-nav-label">Categories</span>
          {activeTab === "categories" && <div className="figma-active-indicator" />}
        </button>

        <button
          className={`figma-nav-btn ${activeTab === "print" ? "active" : ""}`}
          onClick={() => { setActiveTab("print"); setSearchQuery(""); }}
        >
          <span className="figma-nav-icon">🖨️</span>
          <span className="figma-nav-label">Print Store</span>
          {activeTab === "print" && <div className="figma-active-indicator" />}
        </button>
      </nav>
    </div>
  );
}
