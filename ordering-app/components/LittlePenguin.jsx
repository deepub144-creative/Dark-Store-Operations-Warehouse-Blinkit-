"use client";

import { memo, useEffect, useRef } from "react";

/**
 * Interactive animated Little Penguin overlay scoped strictly inside the Ordering App shell.
 * Waddles in from edge, breathes/blinks/looks around, waves & talks ("hii" waves),
 * and on tap/click belly-flops onto ice with snow spray and scratch trail.
 */
const LittlePenguin = memo(function LittlePenguin({
  rootSelector = "#ax-ordering-shell",
  pos = "left",
  ground = 60,
  scale = 1,
  awaySeconds = 12,
}) {
  const stageRef = useRef(null);
  const pRef = useRef(null);
  const tRef = useRef(null);
  const fRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (navigator?.connection?.saveData) return;

    const stage = stageRef.current;
    const p = pRef.current;
    const t = tRef.current;
    const f = fRef.current;
    if (!stage || !p || !t || !f) return;

    const timers = new Set();
    const activeAnims = new Set();
    const edge = ["left", "right", "center"].includes(pos) ? pos : "left";
    const clampedScale = Math.min(Math.max(Number(scale) || 1, 0.4), 2);
    const safeGround = Number.isFinite(Number(ground)) ? Number(ground) : 60;
    const awayMs = Math.max(Number(awaySeconds) || 12, 1) * 1000;
    const H = 56 * clampedScale;

    p.style.height = `${H}px`;
    p.style.width = `${(H * 72) / 94}px`;
    p.style.bottom = `${edge === "center" ? 0 : Math.max(safeGround - 2, 0)}px`;
    if (edge === "right") f.style.transform = "scaleX(-1)";

    let shellWidth = Math.min(window.innerWidth, 440);
    let shellLeft = Math.max(0, (window.innerWidth - shellWidth) / 2);

    const syncBounds = () => {
      const target = document.querySelector(rootSelector);
      if (target) {
        const rect = target.getBoundingClientRect();
        shellWidth = Math.max(280, Math.round(rect.width || Math.min(window.innerWidth, 440)));
        shellLeft = Math.round(rect.left || 0);
      } else {
        shellWidth = Math.min(window.innerWidth, 440);
        shellLeft = Math.max(0, Math.round((window.innerWidth - shellWidth) / 2));
      }
      stage.style.left = `${shellLeft}px`;
      stage.style.width = `${shellWidth}px`;
    };
    syncBounds();

    const W = () => p.offsetWidth || (H * 72) / 94;
    const VW = () => shellWidth;
    const peekPos = () =>
      edge === "left"
        ? [-W() / 2, 0]
        : edge === "right"
        ? [VW() - W() / 2, 0]
        : [(VW() - W()) / 2, H / 2];
    const awayPos = () =>
      edge === "left"
        ? [-W() * 2, 0]
        : edge === "right"
        ? [VW() + W(), 0]
        : [(VW() - W()) / 2, H * 1.4];

    const put = (a) => {
      p.style.transform = `translate3d(${a[0]}px,${a[1]}px,0)`;
    };
    const sleep = (ms) =>
      new Promise((r) => {
        const id = setTimeout(() => {
          timers.delete(id);
          r();
        }, ms);
        timers.add(id);
      });
    const tilt = (deg, lift, sx, sy, ms, ease) => {
      t.style.transition = ms ? `transform ${ms}ms ${ease || "ease-out"}` : "none";
      t.style.transform = `translateY(${lift}px) rotate(${deg}deg) scale(${sx},${sy})`;
    };
    const move = (a, b, dur, ease) =>
      new Promise((res) => {
        if (!mounted || !p.animate) {
          put(b);
          res();
          return;
        }
        const an = p.animate(
          [
            { transform: `translate3d(${a[0]}px,${a[1]}px,0)` },
            { transform: `translate3d(${b[0]}px,${b[1]}px,0)` },
          ],
          { duration: dur, easing: ease, fill: "forwards" }
        );
        activeAnims.add(an);
        an.finished
          .then(() => {
            activeAnims.delete(an);
            if (mounted) put(b);
            an.cancel();
            res();
          })
          .catch(() => {
            activeAnims.delete(an);
            res();
          });
      });

    let mounted = true;
    let state = "gone";
    let waveTimer = 0;
    let lookTimer = 0;
    let backTimer = 0;
    let initTimer = 0;
    let activeFx = null;

    function waveLoop() {
      clearTimeout(waveTimer);
      const steps = [
        ["wave", 3200],
        ["", 4500],
      ];
      let i = 0;
      (function run() {
        if (!mounted || state !== "peek") {
          p.classList.remove("ax-peng-wave");
          return;
        }
        p.classList.toggle("ax-peng-wave", steps[i][0] === "wave");
        const d = steps[i][1];
        i = (i + 1) % steps.length;
        waveTimer = setTimeout(run, d);
      })();
    }

    function lookLoop() {
      clearTimeout(lookTimer);
      (function go() {
        if (!mounted || state !== "peek") {
          p.style.setProperty("--lx", "0px");
          p.style.setProperty("--ly", "0px");
          return;
        }
        p.style.setProperty("--lx", `${((Math.random() * 2 - 1) * 1.7).toFixed(2)}px`);
        p.style.setProperty("--ly", `${((Math.random() * 2 - 1) * 0.8).toFixed(2)}px`);
        lookTimer = setTimeout(go, 1100 + Math.random() * 2600);
      })();
    }

    async function peekIn() {
      if (!mounted) return;
      state = "enter";
      p.classList.remove("ax-peng-slide", "ax-peng-wave", "ax-peng-wow");
      tilt(0, 0, 1, 1, 0);
      put(awayPos());
      void p.offsetWidth;
      p.classList.add("ax-peng-walk");
      await move(awayPos(), peekPos(), 1600, "cubic-bezier(.3,.55,.45,1)");
      if (!mounted) return;
      p.classList.remove("ax-peng-walk");
      tilt(0, 0, 0.95, 1.06, 0);
      void t.offsetWidth;
      tilt(0, 0, 1, 1, 380, "cubic-bezier(.3,1.7,.5,1)");
      state = "peek";
      await sleep(420);
      if (mounted && state === "peek") {
        waveLoop();
        lookLoop();
      }
    }

    function startFx(dir) {
      const tr = document.createElement("div");
      tr.style.cssText =
        "position:absolute;height:2px;border-radius:2px;pointer-events:none;z-index:1;";
      tr.style.background = `linear-gradient(to ${
        dir > 0 ? "right" : "left"
      },rgba(191,227,245,0),rgba(191,227,245,.95))`;
      stage.appendChild(tr);

      const fx = { run: true, tr, sx: null, last: 0, raf: 0 };
      const stageRect = () => stage.getBoundingClientRect();

      const loop = (ts) => {
        if (!mounted || !fx.run) return;
        const sr = stageRect();
        const R = t.getBoundingClientRect();
        const trailX = (dir > 0 ? R.left : R.right) - sr.left;
        const gy = R.bottom - sr.top - 1;
        if (fx.sx === null) fx.sx = trailX;
        tr.style.left = `${Math.min(fx.sx, trailX)}px`;
        tr.style.width = `${Math.abs(trailX - fx.sx)}px`;
        tr.style.top = `${gy}px`;

        if (ts - fx.last > 32) {
          fx.last = ts;
          const s = document.createElement("div");
          const z = 2 + Math.random() * 4;
          s.style.cssText =
            `position:absolute;left:${trailX}px;top:${gy - z - Math.random() * 8}px;width:${z}px;height:${z}px;` +
            "border-radius:50%;background:#fff;box-shadow:0 0 3px rgba(110,170,215,.9);pointer-events:none;z-index:1";
          stage.appendChild(s);
          if (s.animate) {
            s.animate(
              [
                { transform: "translate(0,0) scale(1)", opacity: 0.95 },
                {
                  transform: `translate(${-dir * (10 + Math.random() * 40)}px,${-(
                    6 + Math.random() * 26
                  )}px) scale(.3)`,
                  opacity: 0,
                },
              ],
              { duration: 450 + Math.random() * 450, easing: "ease-out" }
            ).onfinish = () => s.remove();
          } else {
            s.remove();
          }
        }
        fx.raf = requestAnimationFrame(loop);
      };
      fx.raf = requestAnimationFrame(loop);
      return fx;
    }

    function stopFx(fx) {
      if (!fx) return;
      fx.run = false;
      cancelAnimationFrame(fx.raf);
      if (fx.tr.animate) {
        fx.tr
          .animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 1400,
            easing: "ease-out",
            fill: "forwards",
          })
          .onfinish = () => fx.tr.remove();
      } else {
        fx.tr.remove();
      }
    }

    async function slideAway() {
      if (!mounted || state !== "peek") return;
      state = "slide";
      clearTimeout(waveTimer);
      clearTimeout(lookTimer);
      p.classList.remove("ax-peng-wave");
      p.classList.add("ax-peng-wow");
      const dir = edge === "right" ? -1 : 1;
      tilt(-10 * dir, 0, 1.06, 0.9, 190, "ease-out");
      await sleep(230);
      if (!mounted) return;
      p.classList.remove("ax-peng-wow");
      p.classList.add("ax-peng-slide");
      tilt(90 * dir, 0, 1, 1, 430, "cubic-bezier(.4,0,.2,1.35)");
      await sleep(130);
      if (!mounted) return;
      activeFx = startFx(dir);
      const end = [dir > 0 ? VW() + W() * 1.6 : -W() * 2.6, 0];
      await move(peekPos(), end, 2400, "cubic-bezier(.25,.6,.5,.9)");
      stopFx(activeFx);
      activeFx = null;
      if (!mounted) return;
      state = "gone";
      p.classList.remove("ax-peng-slide");
      tilt(0, 0, 1, 1, 0);
      clearTimeout(backTimer);
      backTimer = setTimeout(peekIn, awayMs);
    }

    const onClick = () => slideAway();
    const onTouchStart = (e) => {
      e.preventDefault();
      slideAway();
    };
    const onResize = () => {
      syncBounds();
      if (state === "peek") put(peekPos());
    };

    p.addEventListener("click", onClick);
    p.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("resize", onResize);

    put(awayPos());
    initTimer = setTimeout(peekIn, 300);

    return () => {
      mounted = false;
      clearTimeout(initTimer);
      clearTimeout(waveTimer);
      clearTimeout(lookTimer);
      clearTimeout(backTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      activeAnims.forEach((an) => {
        try {
          an.cancel();
        } catch {}
      });
      activeAnims.clear();
      stopFx(activeFx);
      p.removeEventListener("click", onClick);
      p.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("resize", onResize);
    };
  }, [rootSelector, pos, ground, scale, awaySeconds]);

  return (
    <>
      <style>{`
        .ax-peng-stage {
          position: fixed;
          top: 0;
          height: 100vh;
          pointer-events: none;
          overflow: hidden;
          z-index: 94;
        }
        .ax-peng-root {
          position: absolute;
          left: 0;
          cursor: pointer;
          pointer-events: auto;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          will-change: transform;
          z-index: 2;
          --lx: 0px;
          --ly: 0px;
        }
        .ax-peng-tilt { height: 100%; transform-origin: 50% 70%; }
        .ax-peng-flip { height: 100%; }
        .ax-peng-flip svg { height: 100%; width: auto; display: block; overflow: visible; }

        .ax-peng-body { transform-origin: 30px 75px; animation: axPengIdle 2.2s ease-in-out infinite alternate; }
        @keyframes axPengIdle {
          from { transform: rotate(-1.6deg) scale(1,1); }
          to { transform: rotate(1.6deg) translateY(-1px) scale(1.012,1.022); }
        }
        .ax-peng-fl { transform-origin: 15px 36px; animation: axPengFl 2.2s ease-in-out infinite alternate; }
        .ax-peng-fr { transform-origin: 45px 36px; animation: axPengFr 2.2s ease-in-out infinite alternate; }
        @keyframes axPengFl { from { transform: rotate(5deg); } to { transform: rotate(-2deg); } }
        @keyframes axPengFr { from { transform: rotate(-5deg); } to { transform: rotate(2deg); } }
        .ax-peng-ft { transform-box: fill-box; transform-origin: 50% 100%; }

        .ax-peng-eye { transform-origin: 30px 23px; animation: axPengBlink 4.5s infinite; }
        @keyframes axPengBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }
        .ax-peng-pup { transform: translate(var(--lx), var(--ly)); transition: transform .25s ease-out; }
        .ax-peng-ew { transform-origin: 30px 23px; transition: transform .15s; }
        .ax-peng-wow .ax-peng-ew { transform: scale(1.18); }

        .ax-peng-walk .ax-peng-body { animation: axPengSway .5s ease-in-out infinite alternate; }
        @keyframes axPengSway {
          0% { transform: rotate(-6deg); }
          50% { transform: rotate(0) translateY(-2.5px); }
          100% { transform: rotate(6deg); }
        }
        .ax-peng-walk .ax-peng-ft.l { animation: axPengStep .5s ease-in-out infinite alternate; }
        .ax-peng-walk .ax-peng-ft.r { animation: axPengStep .5s ease-in-out infinite alternate-reverse; }
        @keyframes axPengStep {
          from { transform: translateY(0) rotate(0); }
          to { transform: translateY(-4px) rotate(-10deg); }
        }
        .ax-peng-walk .ax-peng-fl { animation: axPengSwl .5s ease-in-out infinite alternate; }
        .ax-peng-walk .ax-peng-fr { animation: axPengSwr .5s ease-in-out infinite alternate; }
        @keyframes axPengSwl { from { transform: rotate(12deg); } to { transform: rotate(-6deg); } }
        @keyframes axPengSwr { from { transform: rotate(-12deg); } to { transform: rotate(6deg); } }

        .ax-peng-wave .ax-peng-fr { animation: axPengWv .3s ease-in-out infinite alternate; }
        @keyframes axPengWv { from { transform: rotate(-140deg); } to { transform: rotate(-105deg); } }
        .ax-peng-wave .ax-peng-body { animation: axPengHop .6s ease-in-out infinite alternate; }
        @keyframes axPengHop {
          from { transform: rotate(-3deg) translateY(0); }
          to { transform: rotate(3deg) translateY(-3px); }
        }
        .ax-peng-mouth { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); }
        .ax-peng-wave .ax-peng-mouth { animation: axPengTalk .28s ease-in-out infinite alternate; }
        @keyframes axPengTalk { from { transform: scaleY(.15); } to { transform: scaleY(1); } }
        .ax-peng-vo path { fill: none; stroke: #5B9BD5; stroke-width: 2.2; stroke-linecap: round; opacity: 0; }
        .ax-peng-wave .ax-peng-vo path { animation: axPengVo .6s ease-out infinite; }
        .ax-peng-wave .ax-peng-vo path:nth-child(2) { animation-delay: .2s; }
        @keyframes axPengVo {
          0% { opacity: 0; transform: translateX(-3px); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: translateX(3px); }
        }

        .ax-peng-slide .ax-peng-body,
        .ax-peng-slide .ax-peng-fl,
        .ax-peng-slide .ax-peng-fr,
        .ax-peng-slide .ax-peng-eye,
        .ax-peng-slide .ax-peng-mouth,
        .ax-peng-slide .ax-peng-vo path {
          animation: none !important;
        }
        .ax-peng-slide .ax-peng-body { transform: none; }
        .ax-peng-slide .ax-peng-fl { transform: rotate(18deg); }
        .ax-peng-slide .ax-peng-fr { transform: rotate(-18deg); }
        .ax-peng-slide .ax-peng-eye { transform: scaleY(.5); }
        .ax-peng-slide .ax-peng-sh { opacity: 0; }
      `}</style>
      <div ref={stageRef} className="ax-peng-stage">
        <div ref={pRef} className="ax-peng-root" aria-label="Little penguin" role="button">
          <div ref={tRef} className="ax-peng-tilt">
            <div ref={fRef} className="ax-peng-flip">
              <svg viewBox="-6 -8 72 94" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ax-peng-pb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2F4258" />
                    <stop offset="1" stopColor="#162230" />
                  </linearGradient>
                  <linearGradient id="ax-peng-bl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#DDE6EE" />
                  </linearGradient>
                </defs>
                <ellipse className="ax-peng-sh" cx="30" cy="77" rx="17" ry="3.4" fill="rgba(0,0,0,.2)" />
                <g className="ax-peng-body">
                  <g className="ax-peng-ft l">
                    <ellipse cx="22" cy="75" rx="8" ry="3.6" fill="#F59E0B" />
                  </g>
                  <g className="ax-peng-ft r">
                    <ellipse cx="38" cy="75" rx="8" ry="3.6" fill="#F59E0B" />
                  </g>
                  <g className="ax-peng-fl">
                    <ellipse cx="10" cy="50" rx="5.5" ry="15" transform="rotate(14 10 50)" fill="#1B2A3B" />
                  </g>
                  <g className="ax-peng-fr">
                    <ellipse cx="50" cy="50" rx="5.5" ry="15" transform="rotate(-14 50 50)" fill="#1B2A3B" />
                  </g>
                  <ellipse cx="30" cy="44" rx="22" ry="31" fill="url(#ax-peng-pb)" />
                  <ellipse cx="30" cy="51" rx="14.5" ry="23" fill="url(#ax-peng-bl)" />
                  <circle cx="30" cy="23" r="16" fill="url(#ax-peng-pb)" />
                  <g className="ax-peng-ew">
                    <ellipse cx="24" cy="23" rx="6.2" ry="7" fill="#fff" />
                    <ellipse cx="36" cy="23" rx="6.2" ry="7" fill="#fff" />
                  </g>
                  <g className="ax-peng-eye">
                    <g className="ax-peng-pup">
                      <circle cx="24.8" cy="23.6" r="2.8" fill="#111" />
                      <circle cx="35.2" cy="23.6" r="2.8" fill="#111" />
                      <circle cx="25.6" cy="22.6" r="1" fill="#fff" />
                      <circle cx="36" cy="22.6" r="1" fill="#fff" />
                    </g>
                  </g>
                  <path d="M24.5 29 Q30 25.5 35.5 29 Q30 38 24.5 29Z" fill="#F59E0B" />
                  <ellipse className="ax-peng-mouth" cx="30" cy="30.6" rx="2.8" ry="3" fill="#B45309" />
                  <ellipse cx="19" cy="29" rx="3" ry="2" fill="#F5A3A3" opacity=".5" />
                  <ellipse cx="41" cy="29" rx="3" ry="2" fill="#F5A3A3" opacity=".5" />
                  <g className="ax-peng-vo">
                    <path d="M50 16 q4 7 0 14" />
                    <path d="M55 11 q6 12 0 24" />
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default LittlePenguin;

