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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("Muniswamappa Layout, Bengaluru");
  const [locationRequested, setLocationRequested] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("blinkit_customer");
    if (!raw) {
      // Default demo customer for smooth user experience if direct visiting
      const demoCust = { customerId: "cust_demo", name: "Guest User", phone: "9876543210", walletBalance: 999920 };
      localStorage.setItem("blinkit_customer", JSON.stringify(demoCust));
      setCustomer(demoCust);
    } else {
      setCustomer(JSON.parse(raw));
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationRequested(true);
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
        () => {
          setLocationLabel("Muniswamappa Layout, Bengaluru");
          setLocationRequested(true);
        },
        { timeout: 8000 }
      );
    }

    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [router]);

  // Toast feedback trigger on action
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

  // Real-time Search & Category Filtering
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

  // Animated Splash Screen
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
          <div style={S.bikeTrack}>
            <div style={S.bikeWrapper}>
              <span style={S.bikeEmoji}>🛵💨</span>
            </div>
            <div style={S.roadLine} />
          </div>
          <div style={S.splashStatus}>Delivering in 8-14 minutes...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {/* ── TOAST NOTIFICATION POPUP ── */}
      {toastMessage && (
        <div style={S.toastBox}>
          {toastMessage}
        </div>
      )}

      {/* ── STICKY HIGH-FIDELITY INTERACTIVE HEADER ── */}
      <header style={S.header}>
        <div style={S.headerTop}>
          <div style={{ flex: 1 }}>
            <div style={S.deliveryRow}>
              <span style={S.blinkitBrand}>blinkit</span>
              <span style={S.inMinBadge}>IN 8 MINS</span>
            </div>
            <div
              style={S.locationRow}
              onClick={() => triggerToast(`📍 Delivering to: ${locationLabel}`)}
              title="Click to switch delivery address"
            >
              <span style={S.locationPin}>📍</span>
              <span style={S.locationText}>{locationLabel}</span>
              <span style={S.locationChevron}>▾</span>
            </div>
          </div>

          <div style={S.headerActions}>
            <div
              style={S.walletBadge}
              onClick={() => setActiveTab("profile")}
              title="Click to view wallet details"
            >
              <span style={S.walletIcon}>💚</span>
              <span style={S.walletAmt}>₹{walletBalance.toLocaleString("en-IN")}</span>
            </div>
            <button
              style={S.avatarBtn}
              onClick={() => setActiveTab("profile")}
              title="Account Profile"
            >
              👤
            </button>
          </div>
        </div>

        {/* Real Interactive Search Bar */}
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
          {searchQuery ? (
            <button style={S.clearSearch} onClick={() => setSearchQuery("")}>✕</button>
          ) : (
            <span style={S.micIcon} onClick={() => triggerToast("🎙️ Voice search activated - Speak now!")}>🎤</span>
          )}
        </div>

        {/* Real Touchable Category Pills Bar */}
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
                style={{
                  ...S.pill,
                  ...(isActive ? S.pillActive : {}),
                }}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (activeTab !== "home") setActiveTab("home");
                  triggerToast(`Filtered: ${cat.id}`);
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main style={S.main}>

        {/* HOME TAB */}
        {activeTab === "home" && (
          <div>
            {/* Interactive Festive Banner Card */}
            <div
              style={S.interactiveBannerCard}
              onClick={() => {
                setSelectedCategory("Festive & Gifts");
                triggerToast("🎁 Opened Raksha Bandhan Festive Collection!");
              }}
              title="Tap to browse Festive & Rakhi Specials"
            >
              <div style={S.bannerImageWrap}>
                <Image
                  src="/assets/blinkit-festive-hero.jpeg"
                  alt="Raksha Bandhan & Festive Special"
                  width={480}
                  height={180}
                  style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
                  priority
                />
                <div style={S.bannerOverlayBadge}>
                  ⚡ TAP TO EXPLORE FESTIVE COLLECTION →
                </div>
              </div>
            </div>

            {/* Interactive Bestsellers Carousel Card */}
            <div
              style={{ ...S.interactiveBannerCard, marginTop: 12 }}
              onClick={() => {
                setSelectedCategory("Dairy & Breakfast");
                triggerToast("🥛 Browsing Daily Bestsellers!");
              }}
              title="Tap to browse Daily Bestsellers"
            >
              <div style={S.bannerImageWrap}>
                <Image
                  src="/assets/blinkit-bestsellers.jpeg"
                  alt="Bestsellers - Nandini Curd & Fresh Produce"
                  width={480}
                  height={160}
                  style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                />
                <div style={S.bannerOverlayBadgeGreen}>
                  ⭐ BESTSELLERS IN 8 MINS →
                </div>
              </div>
            </div>

            {/* Section Title with Result Count */}
            <div style={S.sectionHeaderRow}>
              <div style={S.sectionTitle}>
                {selectedCategory === "All" ? "Fresh Store Essentials" : selectedCategory}
              </div>
              <div style={S.resultCountBadge}>{filteredCatalog.length} Items</div>
            </div>

            {/* Real Interactive Product Grid */}
            <div style={S.productGrid}>
              {filteredCatalog.map((item) => {
                const qty = cart[item.sku] || 0;
                const discount = Math.round(((item.mrp - item.price) / item.mrp) * 100);
                return (
                  <div key={item.sku} style={S.productCard}>
                    {/* Clickable Image to view product detail modal */}
                    <div style={S.imageWrap} onClick={() => setSelectedProduct(item)}>
                      <img src={item.image} alt={item.name} style={S.productImage} />
                      <span style={S.deliveryChip}>⚡ {item.delivery}</span>
                      {discount > 0 && <span style={S.discountChip}>{discount}% OFF</span>}
                    </div>

                    <div style={S.productInfo}>
                      <div style={S.productWeight}>{item.weight} • {item.aisle}</div>
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

                        {/* Interactive Quantity Stepper / ADD Button */}
                        {qty === 0 ? (
                          <button
                            style={S.addBtn}
                            onClick={() => updateQty(item.sku, 1)}
                          >
                            ADD
                          </button>
                        ) : (
                          <div style={S.counter}>
                            <button
                              style={S.counterBtn}
                              onClick={() => updateQty(item.sku, -1)}
                            >
                              −
                            </button>
                            <span style={S.counterNum}>{qty}</span>
                            <button
                              style={S.counterBtn}
                              onClick={() => updateQty(item.sku, 1)}
                            >
                              +
                            </button>
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
            {/* Interactive Print Store Banner */}
            <div
              style={S.interactiveBannerCard}
              onClick={() => triggerToast("🖨️ Blinkit Print Store - Print documents delivered in 10 mins!")}
            >
              <div style={S.bannerImageWrap}>
                <Image
                  src="/assets/blinkit-print-store.jpeg"
                  alt="Blinkit Print Store"
                  width={480}
                  height={160}
                  style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                />
                <div style={S.bannerOverlayBadge}>
                  🖨️ PRINT & DELIVER DOCUMENTS →
                </div>
              </div>
            </div>

            <div style={S.sectionHeaderRow}>
              <div style={S.sectionTitle}>Frequently Ordered Items</div>
              <div style={S.resultCountBadge}>Fast Reorder</div>
            </div>

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
                      <div style={S.productName} onClick={() => setSelectedProduct(item)}>{item.name}</div>
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
            <div
              style={S.interactiveBannerCard}
              onClick={() => triggerToast("🔲 All Dark Store Categories Loaded")}
            >
              <div style={S.bannerImageWrap}>
                <Image
                  src="/assets/blinkit-categories-grid.jpeg"
                  alt="Categories Banner"
                  width={480}
                  height={180}
                  style={{ width: "100%", height: "180px", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>

            <div style={S.sectionTitle}>Explore All Store Departments</div>

            <div style={S.catDepartmentGrid}>
              {[
                { cat: "Vegetables & Fruits", icon: "🥦", bg: "#f0fdf4", color: "#166534", desc: "Fresh Farm Produce & Herbs" },
                { cat: "Dairy & Breakfast", icon: "🥛", bg: "#eff6ff", color: "#1e40af", desc: "Milk, Eggs, Bread & Butter" },
                { cat: "Ice Creams & Frozen", icon: "🍦", bg: "#fefce8", color: "#854d0e", desc: "Frozen Snacks & Desserts" },
                { cat: "Snacks & Drinks", icon: "🍿", bg: "#faf5ff", color: "#6b21a8", desc: "Chips, Cold Drinks & Sweets" },
                { cat: "Festive & Gifts", icon: "🎁", bg: "#fdf2f8", color: "#9d174d", desc: "Rakhis, Gift Hampers & Aartis" },
              ].map(({ cat, icon, bg, color, desc }) => (
                <div
                  key={cat}
                  style={{ ...S.catDepartmentCard, background: bg, borderColor: color + "33" }}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setActiveTab("home");
                    triggerToast(`Opened Department: ${cat}`);
                  }}
                >
                  <div style={S.catCardIcon}>{icon}</div>
                  <div style={S.catCardInfo}>
                    <div style={{ ...S.catCardTitle, color }}>{cat}</div>
                    <div style={S.catCardDesc}>{desc}</div>
                  </div>
                  <div style={{ ...S.catCardArrow, color }}>→</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={S.profileWrap}>
            <div style={S.profileCard}>
              <div style={S.profileAvatar}>👤</div>
              <div>
                <div style={S.profileName}>{customer.name || `Customer ${customer.phone}`}</div>
                <div style={S.profilePhone}>+91 {customer.phone}</div>
                <div style={S.profileTier}>⚡ Blinkit VIP Customer</div>
              </div>
            </div>

            {/* Interactive Wallet Balance Card */}
            <div style={S.walletCard}>
              <div style={S.walletCardTitle}>💚 Blinkit Wallet Balance</div>
              <div style={S.walletCardBalance}>₹{walletBalance.toLocaleString("en-IN")}</div>
              <div style={S.walletCardSub}>Instant 1-Click Checkout Enabled</div>
              <div style={S.walletProgressBar}>
                <div style={{ ...S.walletProgress, width: `${Math.max(1, (walletBalance / WALLET_LIMIT) * 100)}%` }} />
              </div>
            </div>

            {/* Interactive Menu List */}
            <div style={S.profileMenu}>
              {[
                { label: "📦 Your Orders & SLA History", action: () => triggerToast("Order history up to date") },
                { label: "📍 Saved Delivery Addresses", action: () => triggerToast(`Default: ${locationLabel}`) },
                { label: "💳 Payment Methods & Wallet Top-up", action: () => triggerToast(`Wallet balance: ₹${walletBalance.toLocaleString("en-IN")}`) },
                { label: "🎁 Rewards & Gift Cards", action: () => triggerToast("You have 1 active ₹100 gift card!") },
                { label: "🎧 24/7 Dark Store Customer Support", action: () => triggerToast("Connecting to live support agent...") },
              ].map((item) => (
                <div key={item.label} style={S.profileMenuRow} onClick={item.action}>
                  <span>{item.label}</span>
                  <span style={S.menuArrow}>›</span>
                </div>
              ))}
            </div>

            <button style={S.logoutBtn} onClick={logout}>Log Out Account</button>
            <div style={S.versionTag}>blinkit v18.19.0 • Powered by Dark Store Operations Engine</div>
          </div>
        )}
      </main>

      {/* ── INTERACTIVE PRODUCT DETAIL MODAL DRAWER ── */}
      {selectedProduct && (
        <div style={S.drawerOverlay} onClick={() => setSelectedProduct(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={S.modalClose} onClick={() => setSelectedProduct(null)}>✕</button>
            <img src={selectedProduct.image} alt={selectedProduct.name} style={S.modalImg} />
            <div style={S.modalBody}>
              <div style={S.modalDelivery}>⚡ Delivered in 8-14 minutes</div>
              <div style={S.modalTitle}>{selectedProduct.name}</div>
              <div style={S.modalWeight}>{selectedProduct.weight} • Aisle: {selectedProduct.aisle} • SKU: {selectedProduct.sku}</div>

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
                  <button
                    style={S.modalAddBtn}
                    onClick={() => {
                      updateQty(selectedProduct.sku, 1);
                      setSelectedProduct(null);
                    }}
                  >
                    ADD TO CART
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING CART SUMMARY BAR ── */}
      {totalItems > 0 && !showCart && (
        <div style={S.cartBar} onClick={() => setShowCart(true)}>
          <div style={S.cartLeft}>
            <div style={S.cartCount}>{totalItems} ITEM{totalItems > 1 ? "S" : ""} IN CART</div>
            <div style={S.cartPrice}>₹{totalPrice}</div>
          </div>
          <div style={S.cartRight}>
            View Cart & Pay →
          </div>
        </div>
      )}

      {/* ── CART DRAWER MODAL ── */}
      {showCart && (
        <div style={S.drawerOverlay} onClick={() => setShowCart(false)}>
          <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <div style={S.drawerTitle}>Your Cart ({totalItems} items)</div>
              <button style={S.drawerClose} onClick={() => setShowCart(false)}>✕</button>
            </div>

            <div style={S.drawerDelivery}>
              <span style={S.deliveryGreen}>⚡ Express Delivery in 8-14 mins</span>
              <span style={S.deliveryAddress}>To: {locationLabel}</span>
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

            <div style={S.billCard}>
              <div style={S.billTitle}>Bill Summary</div>
              <div style={S.billRow}><span>Item total</span><span>₹{totalPrice}</span></div>
              <div style={S.billRow}><span>Delivery fee</span><span style={{ color: "#0c831f", fontWeight: 800 }}>FREE</span></div>
              <div style={S.billRow}><span>Handling & Platform fee</span><span>₹0</span></div>
              <div style={S.billDivider} />
              <div style={{ ...S.billRow, fontWeight: 900, fontSize: 15, color: "#0f172a" }}>
                <span>To Pay</span><span>₹{totalPrice}</span>
              </div>
              <div style={S.paymentMethod}>
                <span>💚 Blinkit Wallet</span>
                <span>₹{walletBalance.toLocaleString("en-IN")} available</span>
              </div>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button
              style={S.placeOrderBtn}
              onClick={placeOrder}
              disabled={placingOrder}
            >
              {placingOrder ? "Processing Order..." : `Pay ₹${totalPrice} & Place Order →`}
            </button>
          </div>
        </div>
      )}

      {/* ── REAL INTERACTIVE BOTTOM NAVIGATION BAR ── */}
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
              style={{
                ...S.navTab,
                color: active ? "#0c831f" : "#64748b",
              }}
              onClick={() => {
                setActiveTab(tab.id);
                triggerToast(`Switched tab to ${tab.label}`);
              }}
            >
              {active && <div style={S.navActiveBar} />}
              <span style={S.navIcon}>{tab.icon}</span>
              <span style={{ ...S.navLabel, fontWeight: active ? 800 : 600 }}>{tab.label}</span>
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
  splashLogo: { fontSize: 56, fontWeight: 900, color: "#0c831f", letterSpacing: "-2px" },
  splashTag: { fontSize: 16, color: "#3f6212", fontWeight: 800, marginTop: 4 },

  bikeTrack: { position: "relative", height: 70, marginTop: 40, overflow: "hidden", display: "flex", alignItems: "center" },
  bikeWrapper: { animation: "bikeZoom 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite" },
  bikeEmoji: { fontSize: 44 },
  roadLine: { position: "absolute", bottom: 10, left: 0, right: 0, height: 4, background: "repeating-linear-gradient(90deg, #0c831f, #0c831f 15px, transparent 15px, transparent 25px)", animation: "roadMove 0.4s linear infinite" },
  splashStatus: { fontSize: 14, fontWeight: 800, color: "#15803d", marginTop: 24, animation: "pulseText 1.5s ease-in-out infinite" },

  app: { minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 },

  toastBox: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700, zIndex: 100, boxShadow: "0 10px 25px rgba(0,0,0,0.3)" },

  header: { background: "#fff", padding: "12px 16px 8px", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  deliveryRow: { display: "flex", alignItems: "center", gap: 6 },
  blinkitBrand: { fontSize: 22, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  inMinBadge: { background: "#0c831f", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 4 },
  locationRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 2, cursor: "pointer" },
  locationPin: { fontSize: 13 },
  locationText: { fontSize: 13, fontWeight: 800, color: "#0f172a", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  locationChevron: { color: "#0c831f", fontSize: 12, fontWeight: 800 },

  headerActions: { display: "flex", alignItems: "center", gap: 8 },
  walletBadge: { background: "#dcfce7", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" },
  walletIcon: { fontSize: 13 },
  walletAmt: { fontSize: 13, fontWeight: 900, color: "#15803d" },
  avatarBtn: { width: 34, height: 34, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" },

  searchRow: { background: "#f1f5f9", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 10, border: "1px solid #e2e8f0" },
  searchIcon: { fontSize: 14, color: "#64748b" },
  searchInput: { flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 600, color: "#0f172a" },
  clearSearch: { border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 14 },
  micIcon: { cursor: "pointer", fontSize: 15 },

  pills: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 },
  pill: { padding: "7px 16px", borderRadius: 20, background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 700, color: "#475569", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s ease" },
  pillActive: { background: "#0c831f", color: "#fff", borderColor: "#0c831f", fontWeight: 800 },

  main: { padding: 16, maxWidth: 500, margin: "0 auto" },

  interactiveBannerCard: { borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", cursor: "pointer", transition: "transform 0.15s ease, boxShadow 0.15s ease", border: "1px solid #e2e8f0" },
  bannerImageWrap: { position: "relative" },
  bannerOverlayBadge: { position: "absolute", bottom: 10, left: 12, right: 12, background: "rgba(15,23,42,0.85)", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, textAlign: "center", backdropFilter: "blur(4px)" },
  bannerOverlayBadgeGreen: { position: "absolute", bottom: 10, left: 12, right: 12, background: "rgba(12,131,31,0.9)", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 900, textAlign: "center" },

  sectionHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 900, color: "#0f172a" },
  resultCountBadge: { fontSize: 12, fontWeight: 700, color: "#0c831f", background: "#dcfce7", padding: "3px 10px", borderRadius: 12 },

  productGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  productCard: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" },
  imageWrap: { position: "relative", height: 125, background: "#f8fafc", cursor: "pointer" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  deliveryChip: { position: "absolute", bottom: 6, left: 6, background: "#fff", fontSize: 10, fontWeight: 900, color: "#0c831f", padding: "2px 6px", borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" },
  discountChip: { position: "absolute", top: 6, right: 6, background: "#10b981", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 6px", borderRadius: 6 },

  productInfo: { padding: 12 },
  productWeight: { fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 2 },
  productName: { fontSize: 13, fontWeight: 800, color: "#0f172a", height: 36, overflow: "hidden", cursor: "pointer", lineHeight: 1.3 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  salePrice: { fontSize: 16, fontWeight: 900, color: "#0f172a" },
  mrpPrice: { fontSize: 11, color: "#94a3b8", textDecoration: "line-through", marginLeft: 4 },

  addBtn: { background: "#fff", border: "1.5px solid #0c831f", color: "#0c831f", fontWeight: 900, fontSize: 13, padding: "6px 16px", borderRadius: 8, cursor: "pointer" },
  counter: { display: "flex", alignItems: "center", background: "#0c831f", borderRadius: 8, padding: "2px" },
  counterBtn: { background: "transparent", border: "none", color: "#fff", fontWeight: 900, fontSize: 16, width: 26, height: 26, cursor: "pointer" },
  counterNum: { color: "#fff", fontWeight: 900, fontSize: 13, padding: "0 6px" },

  categoriesWrap: { background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #e2e8f0" },
  catDepartmentGrid: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  catDepartmentCard: { display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, border: "1px solid", cursor: "pointer" },
  catCardIcon: { fontSize: 32 },
  catCardInfo: { flex: 1 },
  catCardTitle: { fontSize: 15, fontWeight: 900 },
  catCardDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  catCardArrow: { fontSize: 18, fontWeight: 900 },

  profileWrap: { display: "flex", flexDirection: "column", gap: 14 },
  profileCard: { background: "#fff", borderRadius: 16, padding: 18, display: "flex", alignItems: "center", gap: 14, border: "1px solid #e2e8f0" },
  profileAvatar: { fontSize: 32, background: "#f1f5f9", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 18, fontWeight: 900, color: "#0f172a" },
  profilePhone: { fontSize: 13, color: "#64748b", marginTop: 2 },
  profileTier: { fontSize: 11, fontWeight: 800, color: "#0c831f", background: "#dcfce7", padding: "2px 8px", borderRadius: 6, display: "inline-block", marginTop: 4 },

  walletCard: { background: "linear-gradient(135deg, #0c831f, #15803d)", borderRadius: 16, padding: 20, color: "#fff" },
  walletCardTitle: { fontSize: 14, fontWeight: 700, opacity: 0.9 },
  walletCardBalance: { fontSize: 34, fontWeight: 900, marginTop: 4 },
  walletCardSub: { fontSize: 12, opacity: 0.8, marginTop: 4 },
  walletProgressBar: { background: "rgba(255,255,255,0.25)", borderRadius: 999, height: 6, marginTop: 14 },
  walletProgress: { background: "#facc15", height: 6, borderRadius: 999 },

  profileMenu: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" },
  profileMenuRow: { display: "flex", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #f1f5f9", fontSize: 14, fontWeight: 700, color: "#0f172a", cursor: "pointer" },
  menuArrow: { color: "#94a3b8" },
  logoutBtn: { padding: 15, background: "#fff", border: "1.5px solid #0c831f", borderRadius: 14, color: "#0c831f", fontWeight: 900, fontSize: 15, cursor: "pointer" },
  versionTag: { textAlign: "center", fontSize: 12, color: "#94a3b8", paddingTop: 4 },

  cartBar: { position: "fixed", bottom: 64, left: 16, right: 16, background: "#0c831f", borderRadius: 16, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", boxShadow: "0 10px 25px rgba(12,131,31,0.4)", cursor: "pointer", zIndex: 40 },
  cartLeft: {},
  cartCount: { fontSize: 11, fontWeight: 900, opacity: 0.9 },
  cartPrice: { fontSize: 19, fontWeight: 900 },
  cartRight: { fontSize: 14, fontWeight: 900 },

  drawerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modalCard: { background: "#fff", width: "100%", maxWidth: 440, borderRadius: 20, overflow: "hidden", position: "relative", margin: "auto 16px" },
  modalClose: { position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", zIndex: 10, fontSize: 16 },
  modalImg: { width: "100%", height: 240, objectFit: "cover" },
  modalBody: { padding: 20 },
  modalDelivery: { color: "#0c831f", fontSize: 12, fontWeight: 900, marginBottom: 4 },
  modalTitle: { fontSize: 19, fontWeight: 900, color: "#0f172a" },
  modalWeight: { fontSize: 13, color: "#64748b", marginTop: 2, marginBottom: 18 },
  modalPriceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalPrice: { fontSize: 24, fontWeight: 900, color: "#0f172a" },
  modalMrp: { fontSize: 14, color: "#94a3b8", textDecoration: "line-through", marginLeft: 8 },
  modalAddBtn: { background: "#0c831f", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  drawer: { background: "#fff", width: "100%", maxWidth: 500, borderRadius: "24px 24px 0 0", maxHeight: "88vh", overflowY: "auto", padding: 20, paddingBottom: 36 },
  drawerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  drawerTitle: { fontSize: 19, fontWeight: 900, color: "#0f172a" },
  drawerClose: { fontSize: 18, background: "#f1f5f9", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer" },
  drawerDelivery: { background: "#f0fdf4", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 2, border: "1px solid #bbf7d0" },
  deliveryGreen: { fontSize: 13, fontWeight: 800, color: "#0c831f" },
  deliveryAddress: { fontSize: 12, color: "#64748b" },

  drawerItems: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 },
  drawerItem: { display: "flex", alignItems: "center", gap: 12, background: "#f8fafc", padding: 10, borderRadius: 12 },
  drawerItemImg: { width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: "1px solid #e2e8f0" },
  drawerItemInfo: { flex: 1 },
  drawerItemName: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  drawerItemWeight: { fontSize: 11, color: "#94a3b8" },
  drawerItemPrice: { fontSize: 12, fontWeight: 700, color: "#0c831f", marginTop: 2 },

  billCard: { background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid #e2e8f0" },
  billTitle: { fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 10 },
  billRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", padding: "4px 0" },
  billDivider: { border: "none", borderTop: "1px dashed #cbd5e1", margin: "10px 0" },
  paymentMethod: { display: "flex", justifyContent: "space-between", marginTop: 12, background: "#dcfce7", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#15803d" },

  errorBox: { background: "#fef2f2", borderRadius: 10, padding: "12px 14px", color: "#dc2626", fontSize: 13, fontWeight: 800, marginBottom: 14 },
  placeOrderBtn: { width: "100%", padding: 17, background: "#0c831f", color: "#fff", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 12px rgba(12,131,31,0.3)" },

  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, height: 62, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", zIndex: 30, boxShadow: "0 -4px 12px rgba(0,0,0,0.03)" },
  navTab: { flex: 1, height: "100%", border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" },
  navActiveBar: { position: "absolute", top: 0, width: 28, height: 3, background: "#0c831f", borderRadius: 2 },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, marginTop: 2 },
};
