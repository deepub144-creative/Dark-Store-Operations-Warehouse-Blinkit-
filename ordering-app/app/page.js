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
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'categories' | 'print' | 'profile'
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

    const timer = setTimeout(() => setLoading(false), 600);
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
    <div className="app-container">
      {toastMessage && <div style={S.toastBox}>{toastMessage}</div>}

      {/* ── DESKTOP HEADER (FULL SIZE LAPTOP/DESKTOP MODE) ── */}
      <header style={S.headerDesktop} className="desktop-only">
        <div style={S.headerInner}>
          <div
            style={S.logoWrap}
            onClick={() => { setActiveTab("home"); setSelectedCategory("All"); setSearchQuery(""); }}
          >
            <span style={{ color: "#f7d108", fontWeight: 900, fontSize: 32, letterSpacing: "-1.5px" }}>blink</span>
            <span style={{ color: "#0c831f", fontWeight: 900, fontSize: 32, letterSpacing: "-1.5px" }}>it</span>
          </div>

          <div style={S.deliveryWidget} onClick={() => triggerToast(`📍 Delivering to: ${locationLabel}`)}>
            <div style={S.slaTitle}>Delivery in 13 minutes</div>
            <div style={S.addressSub}>{locationLabel.slice(0, 34)}... ▾</div>
          </div>

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

      {/* ── MOBILE HEADER (ANDROID & IOS MODE) ── */}
      <header style={S.headerMobile} className="mobile-only">
        <div style={S.mobileHeaderTopRow}>
          <div
            style={S.mobileLogoWrap}
            onClick={() => { setActiveTab("home"); setSelectedCategory("All"); setSearchQuery(""); }}
          >
            <span style={{ color: "#f7d108", fontWeight: 900, fontSize: 24, letterSpacing: "-1px" }}>blink</span>
            <span style={{ color: "#0c831f", fontWeight: 900, fontSize: 24, letterSpacing: "-1px" }}>it</span>
            <span style={S.mobileSlaPill}>⚡ 13 MINS</span>
          </div>

          <div style={S.mobileAddrWidget} onClick={() => triggerToast(`📍 Delivering to: ${locationLabel}`)}>
            <div style={S.mobileAddrTitle}>HOME - Kamath Layout ▾</div>
            <div style={S.mobileAddrText}>{locationLabel.slice(0, 24)}...</div>
          </div>

          <button
            style={S.mobileUserBtn}
            onClick={() => setActiveTab(activeTab === "profile" ? "home" : "profile")}
          >
            👤
          </button>
        </div>

        {/* Mobile Sticky Search Bar */}
        <div style={S.mobileSearchContainer}>
          <span style={{ fontSize: 15, color: "#64748b" }}>🔍</span>
          <input
            style={S.mobileSearchInput}
            placeholder='Search "paneer", "milk", "chips"...'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearching(true);
              setTimeout(() => setIsSearching(false), 200);
            }}
          />
          {searchQuery ? (
            <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
          ) : (
            <span style={{ fontSize: 14, color: "#64748b" }}>🎙️</span>
          )}
        </div>
      </header>

      {/* ── SEARCH OVERLAY DRILL-DOWN ── */}
      {searchQuery.length > 0 && (
        <div className="search-overlay-wrap">
          <div style={S.searchQueryHeader}>
            Showing results for <strong>"{searchQuery}"</strong> ({filteredCatalog.length} items)
          </div>

          {isSearching ? (
            <div className="product-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={S.skeletonCard} />
              ))}
            </div>
          ) : (
            <div className="product-grid">
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

      {/* ── MAIN CONTENT PAGE (HOME TAB) ── */}
      {searchQuery.length === 0 && activeTab === "home" && (
        <main className="main-content-wrap">
          {/* 3 PROMO BANNERS (DESKTOP 3-COL / MOBILE HORIZONTAL SWIPE) */}
          <div className="promo-grid no-scrollbar">
            <div className="promo-card-item" style={{ ...S.promoCard, background: "linear-gradient(135deg, #0d9488, #0f766e)" }}>
              <div style={S.promoTitle}>Pharmacy at your doorstep! 💊</div>
              <div style={S.promoSub}>Cough syrups, pain relief sprays & essentials</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Pharmacy Dept")}>Order Now</button>
            </div>

            <div className="promo-card-item" style={{ ...S.promoCard, background: "linear-gradient(135deg, #eab308, #ca8a04)" }}>
              <div style={S.promoTitle}>Pet care supplies at your door 🐾</div>
              <div style={S.promoSub}>Food, treats, toys & dog chew sticks</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Pet Care Dept")}>Order Now</button>
            </div>

            <div className="promo-card-item" style={{ ...S.promoCard, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
              <div style={S.promoTitle}>No time for a diaper run? 👶</div>
              <div style={S.promoSub}>Get baby care wipes & diapers delivered fast</div>
              <button style={S.promoBtn} onClick={() => triggerToast("Opened Baby Care Dept")}>Order Now</button>
            </div>
          </div>

          {/* 20 CATEGORY DEPARTMENTS GRID */}
          <div className="category-grid">
            {[
              { id: "Paan Corner", title: "Paan Corner", icon: "🍃" },
              { id: "Dairy & Breakfast", title: "Dairy & Eggs", icon: "🥛" },
              { id: "Vegetables & Fruits", title: "Fruits & Veggies", icon: "🥦" },
              { id: "Snacks & Drinks", title: "Cold Drinks", icon: "🧃" },
              { id: "Snacks & Drinks", title: "Snacks", icon: "🍿" },
              { id: "Ice Creams & Frozen", title: "Sweet Tooth", icon: "🍫" },
              { id: "Dairy & Breakfast", title: "Bakery", icon: "🍞" },
              { id: "Dairy & Breakfast", title: "Tea & Coffee", icon: "☕" },
              { id: "Dairy & Breakfast", title: "Atta & Dal", icon: "🌾" },
              { id: "Festive & Gifts", title: "Gifts & Hampers", icon: "🎁" },
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
                  triggerToast(`Filtered: ${cat.title}`);
                }}
              >
                <div style={S.catTileIcon}>{cat.icon}</div>
                <div style={S.catTileTitle}>{cat.title}</div>
              </div>
            ))}
          </div>

          {/* CATEGORY PRODUCT CAROUSELS */}
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

                <div style={S.horizontalScrollRow} className="no-scrollbar">
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

      {/* ── CATEGORIES TAB (MOBILE/DESKTOP) ── */}
      {searchQuery.length === 0 && activeTab === "categories" && (
        <main className="main-content-wrap">
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>All Categories & Departments</div>
          <div className="product-grid">
            {CATALOG.map((item) => {
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
        </main>
      )}

      {/* ── PRINT STORE TAB ── */}
      {searchQuery.length === 0 && activeTab === "print" && (
        <main className="main-content-wrap" style={{ maxWidth: 640 }}>
          <div style={{ background: "#ffffff", padding: 24, borderRadius: 20, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🖨️</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Blinkit Print Store</div>
            <div style={{ fontSize: 13, color: "#64748b", margin: "8px 0 20px" }}>
              Get black & white or color document prints delivered to your door in 10 minutes!
            </div>
            <button
              style={{ ...S.checkoutBtn, width: "100%" }}
              onClick={() => triggerToast("Upload PDF function ready")}
            >
              Upload Document PDF →
            </button>
          </div>
        </main>
      )}

      {/* ── PROFILE ACCOUNT TAB ── */}
      {activeTab === "profile" && (
        <main className="main-content-wrap" style={{ maxWidth: 600 }}>
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

      {/* ── MOBILE FLOATING CART BAR (ANDROID & IOS MODE) ── */}
      {totalItems > 0 && !showCart && (
        <div className="mobile-cart-float-bar mobile-only" onClick={() => setShowCart(true)}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 900 }}>{totalItems} item(s) • ₹{totalPrice}</span>
            <span style={{ fontSize: 10, opacity: 0.85 }}>Extra ₹25 savings on cart</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", gap: 4 }}>
            View Cart 🛒 →
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAVIGATION BAR (ANDROID & IOS MODE) ── */}
      <nav className="mobile-bottom-nav mobile-only">
        <button
          className={`mobile-nav-item ${activeTab === "home" ? "active" : ""}`}
          onClick={() => { setActiveTab("home"); setSelectedCategory("All"); setSearchQuery(""); }}
        >
          <span style={{ fontSize: 20 }}>🏠</span>
          <span>Home</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => { setActiveTab("categories"); setSearchQuery(""); }}
        >
          <span style={{ fontSize: 20 }}>🗂️</span>
          <span>Categories</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === "print" ? "active" : ""}`}
          onClick={() => { setActiveTab("print"); setSearchQuery(""); }}
        >
          <span style={{ fontSize: 20 }}>🖨️</span>
          <span>Print Store</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => { setActiveTab("profile"); setSearchQuery(""); }}
        >
          <span style={{ fontSize: 20 }}>👤</span>
          <span>Account</span>
        </button>

        <button
          className="mobile-nav-item"
          onClick={() => setShowCart(true)}
        >
          <span style={{ fontSize: 20, position: "relative" }}>
            🛒
            {totalItems > 0 && (
              <span style={S.navCartBadge}>{totalItems}</span>
            )}
          </span>
          <span>Cart</span>
        </button>
      </nav>

      {/* ── PRODUCT DETAIL POPUP MODAL ── */}
      {selectedProduct && (
        <div style={S.drawerOverlay} onClick={() => setSelectedProduct(null)}>
          <div style={S.productModalCard} onClick={(e) => e.stopPropagation()}>
            <button style={S.modalCloseBtn} onClick={() => setSelectedProduct(null)}>✕</button>
            <div style={{ textAlign: "center" }}>
              <img src={selectedProduct.image} alt={selectedProduct.name} style={{ height: 160, objectFit: "contain", marginBottom: 12 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>⏱️ DELIVERED IN 13 MINS</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{selectedProduct.name}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>{selectedProduct.weight} • Aisle {selectedProduct.aisle}</div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>₹{selectedProduct.price}</span>
                {selectedProduct.mrp > selectedProduct.price && (
                  <span style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through", marginLeft: 6 }}>
                    ₹{selectedProduct.mrp}
                  </span>
                )}
              </div>

              {(cart[selectedProduct.sku] || 0) === 0 ? (
                <button
                  style={S.refAddBtn}
                  onClick={() => { updateQty(selectedProduct.sku, 1); setSelectedProduct(null); }}
                >
                  ADD TO CART
                </button>
              ) : (
                <div style={S.refCounter}>
                  <button style={S.refCounterBtn} onClick={() => updateQty(selectedProduct.sku, -1)}>−</button>
                  <span style={S.refCounterNum}>{cart[selectedProduct.sku]}</span>
                  <button style={S.refCounterBtn} onClick={() => updateQty(selectedProduct.sku, 1)}>+</button>
                </div>
              )}
            </div>
          </div>
        </div>
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
              {cartEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <div style={{ fontSize: 48 }}>🛍️</div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>Your cart is empty</div>
                  <div style={{ fontSize: 13 }}>Explore items and add them to your cart!</div>
                </div>
              ) : (
                <>
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
                </>
              )}
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

  toastBox: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 20px", borderRadius: 20, fontWeight: 800, fontSize: 13, zIndex: 100 },

  // Desktop Header
  headerDesktop: { background: "#ffffff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 40, padding: "12px 24px" },
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

  // Mobile Header
  headerMobile: { background: "#ffffff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 40, padding: "10px 14px", flexDirection: "column", gap: 8 },
  mobileHeaderTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  mobileLogoWrap: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  mobileSlaPill: { background: "#f0fdf4", color: "#0c831f", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6, border: "1px solid #bbf7d0" },
  mobileAddrWidget: { flex: 1, textAlign: "center", cursor: "pointer" },
  mobileAddrTitle: { fontSize: 12, fontWeight: 900, color: "#0f172a" },
  mobileAddrText: { fontSize: 10, color: "#64748b" },
  mobileUserBtn: { background: "#f1f5f9", border: "none", width: 34, height: 34, borderRadius: "50%", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },

  mobileSearchContainer: { background: "#f1f5f9", borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0" },
  mobileSearchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, fontWeight: 600, color: "#0f172a" },

  searchQueryHeader: { fontSize: 18, marginBottom: 16, color: "#0f172a" },
  skeletonCard: { height: 220, background: "#f1f5f9", borderRadius: 12 },

  promoCard: { padding: 20, borderRadius: 16, color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  promoTitle: { fontSize: 18, fontWeight: 900 },
  promoSub: { fontSize: 12, opacity: 0.9, marginTop: 4, height: 32 },
  promoBtn: { marginTop: 14, background: "#0f172a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", width: "fit-content" },

  catTileCard: { borderRadius: 12, border: "1px solid", padding: 10, textAlign: "center", cursor: "pointer", transition: "all 0.15s ease" },
  catTileIcon: { fontSize: 26, marginBottom: 4 },
  catTileTitle: { fontSize: 11, fontWeight: 800, color: "#1e293b", lineHeight: 1.2 },

  sectionBlock: { marginBottom: 32 },
  sectionHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionHeadTitle: { fontSize: 20, fontWeight: 900, color: "#0f172a" },
  seeAllBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 800, fontSize: 14, cursor: "pointer" },

  horizontalScrollRow: { display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 },

  refProductCard: { minWidth: 160, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" },
  refDiscountBadge: { position: "absolute", top: 8, left: 8, background: "#2563eb", color: "#ffffff", fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 4, zIndex: 5 },
  refImgWrap: { height: 100, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 6 },
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

  navCartBadge: { position: "absolute", top: -4, right: -6, background: "#0c831f", color: "#fff", fontSize: 9, fontWeight: 900, borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" },

  profileCard: { background: "#ffffff", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 16, marginBottom: 16 },
  profileAvatar: { fontSize: 32 },
  logoutBtn: { background: "#fee2e2", border: "none", color: "#dc2626", padding: "8px 16px", borderRadius: 8, fontWeight: 800, cursor: "pointer" },

  walletCard: { background: "linear-gradient(135deg, #0c831f, #15803d)", padding: 24, borderRadius: 16, color: "#fff" },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", justifyContent: "flex-end" },
  drawerCard: { width: "100%", maxWidth: 440, background: "#ffffff", height: "100vh", overflowY: "auto" },
  drawerHeader: { padding: 20, borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" },
  drawerCloseBtn: { border: "none", background: "#f1f5f9", width: 32, height: 32, borderRadius: "50%", fontWeight: 800, cursor: "pointer" },

  productModalCard: { width: "90%", maxWidth: 420, background: "#ffffff", borderRadius: 24, padding: 24, margin: "auto", position: "relative" },
  modalCloseBtn: { position: "absolute", top: 16, right: 16, background: "#f1f5f9", border: "none", width: 32, height: 32, borderRadius: "50%", fontWeight: 800, cursor: "pointer" },

  cartRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  cartItemImg: { width: 48, height: 48, borderRadius: 8, objectFit: "contain" },
  billSummary: { background: "#f8fafc", padding: 16, borderRadius: 12, margin: "20px 0" },
  checkoutBtn: { width: "100%", padding: 16, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer" },
};
