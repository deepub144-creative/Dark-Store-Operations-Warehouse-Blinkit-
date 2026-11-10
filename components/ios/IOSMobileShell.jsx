"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const IOSContainerContext = createContext({
  isScrolled: false,
  isLargeCollapsed: false,
  keyboardOpen: false,
  scrollToTop: () => {},
  registerSentinel: () => {},
});

export function useIOSContainer() {
  return useContext(IOSContainerContext);
}

/**
 * Native-feeling iOS 17/18 mobile viewport shell:
 * - Fixed 100dvh outer frame (overflow: hidden) so the page itself never rubber-bands.
 * - Single inner scroll view (.ios-scroll-area) with overscroll-behavior: contain.
 * - Tracks scroll collapse via IntersectionObserver on a top sentinel (zero scroll-handler layout thrash).
 * - Built-in Pull-to-Refresh + Left-Edge Swipe-Back + VisualViewport keyboard detection.
 */
export default function IOSMobileShell({
  children,
  header = null,
  tabBar = null,
  stickyFooter = null,
  overlay = null,
  onRefresh = null,
  onSwipeBack = null,
  shellId = undefined,
  dataDfx = undefined,
  className = "",
  style = {},
}) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLargeCollapsed, setIsLargeCollapsed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Pull-to-refresh state
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartYRef = useRef(null);
  const isPullingRef = useRef(false);

  // Left-edge swipe-back gesture state
  const [edgeSwipeX, setEdgeSwipeX] = useState(0);
  const edgeStartRef = useRef(null);

  // Lock root html/body scroll synchronously before paint while an iOS mobile screen is active
  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("ios-shell-locked");
    return () => {
      document.documentElement.classList.remove("ios-shell-locked");
    };
  }, []);

  // VisualViewport keyboard awareness: avoids squishing fixed bars when mobile keyboard opens
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const baseHeight = window.innerHeight;
    const handleResize = () => {
      const heightDiff = baseHeight - vv.height;
      setKeyboardOpen(heightDiff > 150);
    };
    vv.addEventListener("resize", handleResize, { passive: true });
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  // Observe sentinel at top of scroll view for hairline separator & large-title collapse (no layout read inside scroll!)
  useEffect(() => {
    const rootEl = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!rootEl || !sentinel || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const scrolledPast = !entry.isIntersecting;
        setIsScrolled(scrolledPast);
        setIsLargeCollapsed(scrolledPast);
      },
      { root: rootEl, threshold: 0.05 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  // Passive scroll listener ONLY updates simple boolean fallback when needed
  useEffect(() => {
    const rootEl = scrollRef.current;
    if (!rootEl) return;
    const onScroll = () => {
      const y = rootEl.scrollTop;
      setIsScrolled(y > 6);
      setIsLargeCollapsed(y > 32);
    };
    rootEl.addEventListener("scroll", onScroll, { passive: true });
    return () => rootEl.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleTouchStart = useCallback(
    (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;

      // Edge swipe-back detection (within 24px from left edge of viewport or frame)
      if (onSwipeBack && touch.clientX <= 28) {
        edgeStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          t: performance.now(),
        };
      } else {
        edgeStartRef.current = null;
      }

      // Pull-to-refresh detection only when scroll area is at top
      if (onRefresh && !refreshing && scrollRef.current && scrollRef.current.scrollTop <= 1) {
        pullStartYRef.current = touch.clientY;
        isPullingRef.current = true;
      } else {
        pullStartYRef.current = null;
        isPullingRef.current = false;
      }
    },
    [onRefresh, onSwipeBack, refreshing]
  );

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches?.[0];
    if (!touch) return;

    if (edgeStartRef.current) {
      const dx = touch.clientX - edgeStartRef.current.x;
      const dy = Math.abs(touch.clientY - edgeStartRef.current.y);
      if (dx > 8 && dx > dy * 1.2) {
        setEdgeSwipeX(Math.min(180, dx * 0.75));
        return;
      }
    }

    if (isPullingRef.current && pullStartYRef.current !== null && scrollRef.current) {
      if (scrollRef.current.scrollTop > 1) {
        isPullingRef.current = false;
        setPullDist(0);
        return;
      }
      const dy = touch.clientY - pullStartYRef.current;
      if (dy > 0) {
        // Rubber-band resistance curve
        const damped = Math.min(82, Math.round(Math.pow(dy, 0.78) * 2.2));
        setPullDist(damped);
      } else {
        setPullDist(0);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (edgeStartRef.current) {
      const elapsed = Math.max(1, performance.now() - edgeStartRef.current.t);
      const velocity = edgeSwipeX / elapsed;
      if ((edgeSwipeX > 68 || velocity > 0.35) && onSwipeBack) {
        try {
          navigator.vibrate?.(10);
        } catch {}
        setEdgeSwipeX(0);
        edgeStartRef.current = null;
        onSwipeBack();
        return;
      }
      setEdgeSwipeX(0);
      edgeStartRef.current = null;
    }

    if (isPullingRef.current) {
      isPullingRef.current = false;
      pullStartYRef.current = null;
      if (pullDist >= 54 && onRefresh) {
        try {
          navigator.vibrate?.(10);
        } catch {}
        setRefreshing(true);
        setPullDist(48);
        try {
          await Promise.resolve(onRefresh());
        } finally {
          setTimeout(() => {
            setRefreshing(false);
            setPullDist(0);
          }, 320);
        }
      } else {
        setPullDist(0);
      }
    }
  }, [edgeSwipeX, onRefresh, onSwipeBack, pullDist]);

  return (
    <IOSContainerContext.Provider
      value={{
        isScrolled,
        isLargeCollapsed,
        keyboardOpen,
        scrollToTop,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100dvh",
          maxHeight: "100dvh",
          overflow: "hidden",
          background: "var(--ios-bg)",
          display: "flex",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          id={shellId}
          data-dfx={dataDfx}
          className={`ios-phone-frame ${className}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform:
              edgeSwipeX > 0
                ? `translate3d(${edgeSwipeX}px, 0, 0)`
                : "translate3d(0, 0, 0)",
            transition:
              edgeSwipeX > 0
                ? "none"
                : "transform 320ms var(--ios-spring)",
            ...style,
          }}
        >
          {/* Edge swipe-back visual indicator */}
          {edgeSwipeX > 6 && (
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                left: 6,
                top: "50%",
                transform: `translate3d(0, -50%, 0) scale(${Math.min(1, edgeSwipeX / 70)})`,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--ios-chrome-bg)",
                backdropFilter: "blur(12px)",
                border: "0.5px solid var(--ios-sep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99,
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                pointerEvents: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ios-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>
          )}

          {/* Fixed Translucent Top Chrome Slot */}
          {header}

          {/* Inner Momentum Scroll Area */}
          <div ref={scrollRef} className="ios-scroll-area">
            {/* Pull-to-Refresh Spinner */}
            {(pullDist > 0 || refreshing) && (
              <div
                aria-hidden="true"
                style={{
                  height: pullDist,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  transition: isPullingRef.current
                    ? "none"
                    : "height 280ms var(--ios-spring)",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "2.5px solid var(--ios-fill)",
                    borderTopColor: "var(--ios-blue)",
                    animation: refreshing ? "iosSpin 750ms linear infinite" : "none",
                    transform: refreshing
                      ? "none"
                      : `rotate(${pullDist * 4}deg)`,
                  }}
                />
              </div>
            )}

            {/* Zero-cost scroll collapse sentinel */}
            <div
              ref={sentinelRef}
              aria-hidden="true"
              style={{ position: "relative", height: 1, width: "100%", pointerEvents: "none" }}
            />

            {children}
          </div>

          {/* Sticky CTA Footer (when outside scroll) */}
          {stickyFooter}

          {/* Native Blurred Bottom TabBar (hidden automatically during mobile virtual keyboard) */}
          {!keyboardOpen && tabBar}

          {/* Global Modals, Bottom Sheets & Toasts */}
          {overlay}
        </div>
      </div>
    </IOSContainerContext.Provider>
  );
}

