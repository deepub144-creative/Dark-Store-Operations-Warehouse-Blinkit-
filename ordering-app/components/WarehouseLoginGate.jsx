"use client";

import { useEffect, useRef, useState } from "react";
import { getTodayISTDateKey } from "@/lib/hubState";

// Exact SHA-256 credentials from Warehouse_Login_Page.html (NAME|digitsOfDOB)
const WAREHOUSE_USERS = [
  {
    h: "56f05a5c821c205cebb9afd2ac6e52d556d0bbffa2159ac389a296468b3ea8ce",
    n: "Deepu B",
    id: "deepu",
    roleCode: "ASM",
  },
  {
    h: "3990c5fa93e1f413feee4f73014d338f86880bc8f6edcdf0243756383cfde492",
    n: "Bhaskar N S",
    id: "bhaskar",
    roleCode: "SM",
  },
  {
    h: "5c01d7914c0a302e1c98a1f79d8292abc42fa7f00ed7bb37342aca39f93fb952",
    n: "A B Harshitha",
    id: "harshitha",
    roleCode: "MD",
  },
];

const CAPTCHA_LIFETIME_MS = 5 * 60 * 1000;
const CAPTCHA_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_TRIES = 5;
const LOCK_MS = 30000;

function secureRnd(n) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

// Pure-JS SHA-256 fallback in case browser blocks crypto.subtle on non-HTTPS LAN origins
function sha256PureJs(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

async function computeSha256Hex(str) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return sha256PureJs(str);
    }
  }
  return sha256PureJs(str);
}

export default function WarehouseLoginGate({ onAuthenticated, initialNotice = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [timerLabel, setTimerLabel] = useState("Captcha changes automatically in 5:00");
  const [statusMsg, setStatusMsg] = useState(initialNotice ? { text: initialNotice, ok: false } : { text: "", ok: false });
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const vid1Ref = useRef(null);
  const vid2Ref = useRef(null);
  const captchaTextRef = useRef("");
  const expiresAtRef = useRef(0);
  const failsRef = useRef(0);
  const lockedUntilRef = useRef(0);

  function drawCaptcha() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const nextCap = Array.from({ length: 5 }, () => CAPTCHA_CHARS[secureRnd(CAPTCHA_CHARS.length)]).join("");
    captchaTextRef.current = nextCap;
    expiresAtRef.current = Date.now() + CAPTCHA_LIFETIME_MS;

    const W = cv.width,
      H = cv.height;
    ctx.fillStyle = "#ece9e4";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(${secureRnd(200)},${secureRnd(200)},${secureRnd(200)},.45)`;
      ctx.fillRect(secureRnd(W), secureRnd(H), 2, 2);
    }
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(${secureRnd(160)},${secureRnd(160)},${secureRnd(160)},.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(secureRnd(W), secureRnd(H));
      ctx.bezierCurveTo(
        secureRnd(W),
        secureRnd(H),
        secureRnd(W),
        secureRnd(H),
        secureRnd(W),
        secureRnd(H)
      );
      ctx.stroke();
    }
    ctx.textBaseline = "middle";
    [...nextCap].forEach((c, i) => {
      ctx.save();
      ctx.translate(26 + i * 50, H / 2 + (secureRnd(10) - 5));
      ctx.rotate(((secureRnd(40) - 20) * Math.PI) / 180);
      ctx.font = `bold ${38 + secureRnd(8)}px Arial Black, Arial, sans-serif`;
      ctx.fillStyle = `rgb(${secureRnd(90)},${secureRnd(90)},${secureRnd(90)})`;
      ctx.fillText(c, 0, 0);
      ctx.restore();
    });
    setCapInput("");
  }

  useEffect(() => {
    drawCaptcha();
    const tick = () => {
      const left = Math.max(0, expiresAtRef.current - Date.now());
      if (left === 0) {
        drawCaptcha();
        return;
      }
      const m = Math.floor(left / 60000);
      const s = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
      setTimerLabel(`Captcha changes automatically in ${m}:${s}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // Keep split videos playing silently
  useEffect(() => {
    const startVids = () => {
      [vid1Ref.current, vid2Ref.current].forEach((v) => {
        if (!v) return;
        v.muted = true;
        v.defaultMuted = true;
        if (v.paused) v.play().catch(() => {});
      });
    };
    startVids();
    window.addEventListener("pointerdown", startVids, { once: true });
    window.addEventListener("keydown", startVids, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startVids);
      window.removeEventListener("keydown", startVids);
    };
  }, []);

  // Scale card cleanly into any viewport without scrollbars (exact HTML formula)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const fit = () => {
      if (!cardRef.current) return;
      const s = Math.min(
        1.35,
        (window.innerWidth - 24) / cardRef.current.offsetWidth,
        (window.innerHeight - 24) / cardRef.current.offsetHeight
      );
      cardRef.current.style.setProperty("--wh-scale", Math.max(0.4, s).toFixed(3));
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (Date.now() < lockedUntilRef.current) {
      const secs = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      setStatusMsg({ text: `Too many attempts. Try again in ${secs}s.`, ok: false });
      return;
    }

    const u = username.trim().replace(/\s+/g, " ").toUpperCase();
    const p = password.replace(/\D/g, "");
    const c = capInput.trim();

    if (!u || !password || !c) {
      setStatusMsg({ text: "Enter username, password and captcha.", ok: false });
      return;
    }

    if (c !== captchaTextRef.current) {
      failsRef.current += 1;
      drawCaptcha();
      if (failsRef.current >= MAX_TRIES) {
        lockedUntilRef.current = Date.now() + LOCK_MS;
        failsRef.current = 0;
        setStatusMsg({ text: "Too many attempts. Locked for 30 seconds.", ok: false });
      } else {
        setStatusMsg({ text: "Captcha is incorrect. A new one has been generated.", ok: false });
      }
      return;
    }

    setSubmitting(true);
    const h = await computeSha256Hex(`${u}|${p}`);
    const user = WAREHOUSE_USERS.find((x) => x.h === h);
    setSubmitting(false);

    if (!user) {
      failsRef.current += 1;
      drawCaptcha();
      if (failsRef.current >= MAX_TRIES) {
        lockedUntilRef.current = Date.now() + LOCK_MS;
        failsRef.current = 0;
        setStatusMsg({ text: "Too many attempts. Locked for 30 seconds.", ok: false });
      } else {
        setStatusMsg({ text: "Invalid username or password.", ok: false });
      }
      return;
    }

    failsRef.current = 0;
    const sessionObj = {
      id: user.id,
      name: user.n,
      roleCode: user.roleCode,
      authDate: getTodayISTDateKey(),
      loggedInAt: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem("wh_user", user.n);
      localStorage.setItem("auditx_wh_session", JSON.stringify(sessionObj));
    } catch {}

    setStatusMsg({ text: `Welcome, ${user.n}! Opening Dashboard...`, ok: true });
    onAuthenticated?.(sessionObj);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#0b1d36",
        overflow: "hidden",
        fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif',
      }}
    >
      <style>{`
        .wh-bgvideo { position: fixed; inset: 0; z-index: 0; display: flex; background: #000; width: 100vw; height: 100dvh; }
        .wh-bgvideo video { flex: 1 1 50%; width: 50%; height: 100%; min-width: 0; object-fit: cover; display: block; }
        .wh-bgvideo video + video { border-left: 2px solid rgba(255,255,255,.55); }
        @media (max-width: 700px) {
          .wh-bgvideo { flex-direction: column; }
          .wh-bgvideo video { width: 100%; height: 50%; flex: 1 1 50%; }
          .wh-bgvideo video + video { border-left: 0; border-top: 2px solid rgba(255,255,255,.55); }
        }
        .wh-card {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 3;
          width: 480px;
          background: #072a50;
          color: #fff;
          border: 3px solid #041a33;
          border-radius: 16px;
          padding: 26px 28px 30px;
          box-shadow: 0 18px 50px rgba(4,26,51,.55);
          transform: translate(-50%, -50%) scale(var(--wh-scale, 1));
          transform-origin: center;
          box-sizing: border-box;
        }
        .wh-card * { box-sizing: border-box; }
        .wh-input {
          width: 100%;
          height: 50px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: #e8edfb;
          font-size: 18px;
          padding: 0 14px;
          color: #0b1d36;
          outline: none;
        }
        .wh-input:focus-visible { border-color: #7fb0ff; box-shadow: 0 0 0 3px rgba(127,176,255,.45); }
        .wh-cap-input {
          flex: 1;
          min-width: 0;
          height: 50px;
          background: transparent;
          border: 1px solid #cfd8ea;
          border-radius: 6px;
          color: #fff;
          font-size: 17px;
          padding: 0 14px;
          outline: none;
        }
        .wh-cap-input::placeholder { color: #8fa3c0; }
        .wh-cap-input:focus-visible { border-color: #7fb0ff; box-shadow: 0 0 0 3px rgba(127,176,255,.45); }
      `}</style>

      {/* Split looping background videos */}
      <div className="wh-bgvideo" aria-hidden="true">
        <video
          ref={vid1Ref}
          src="/warehouse-video1.mp4"
          muted
          loop
          playsInline
          preload="auto"
          autoPlay
        />
        <video
          ref={vid2Ref}
          src="/warehouse-video2.mp4"
          muted
          loop
          playsInline
          preload="auto"
          autoPlay
        />
      </div>

      {/* Fitted Centered Warehouse Login Card */}
      <main ref={cardRef} className="wh-card">
        <form onSubmit={handleLogin}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ background: "#edeee8", borderRadius: 10, padding: "4px 8px" }}>
              <img
                src="/warehouse-brand-top.jpg"
                alt="AUDIT'X Dark Store Operations"
                style={{ width: "100%", height: "auto", display: "block", mixBlendMode: "multiply" }}
              />
            </div>
            <img
              src="/warehouse-logo-sub.png"
              alt="Warehouse Portal"
              style={{ height: 58, width: "auto", display: "block", margin: "10px auto 0" }}
            />
          </div>

          <label htmlFor="wh-user" style={{ display: "block", fontSize: 16, margin: "6px 0 6px" }}>
            Username
          </label>
          <input
            id="wh-user"
            type="text"
            className="wh-input"
            autoComplete="username"
            autoCapitalize="words"
            spellCheck={false}
            placeholder="Full Name (SM / ASM / MD)"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (statusMsg.text) setStatusMsg({ text: "", ok: false });
            }}
          />

          <label htmlFor="wh-pass" style={{ display: "block", fontSize: 16, margin: "14px 0 6px" }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="wh-pass"
              type={showPass ? "text" : "password"}
              className="wh-input"
              style={{ paddingRight: 64 }}
              autoComplete="current-password"
              placeholder="DOB Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (statusMsg.text) setStatusMsg({ text: "", ok: false });
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: 50,
                width: 56,
                border: 0,
                borderLeft: "1px solid #c5cbe0",
                background: "#f1f3fa",
                borderRadius: "0 6px 6px 0",
                cursor: "pointer",
                fontSize: 18,
                color: "#333",
              }}
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>

          <label htmlFor="wh-cap" style={{ display: "block", fontSize: 16, margin: "16px 0 6px" }}>
            Enter Captcha
          </label>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
            <canvas
              ref={canvasRef}
              width={300}
              height={60}
              aria-label="Captcha image"
              style={{ width: 150, height: 30, borderRadius: 3, background: "#eee", flex: "none" }}
            />
            <button
              type="button"
              onClick={drawCaptcha}
              aria-label="New captcha"
              style={{
                flex: "none",
                width: 30,
                height: 30,
                border: 0,
                borderRadius: 4,
                background: "#0b4ba8",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ⟳
            </button>
            <input
              id="wh-cap"
              type="text"
              className="wh-cap-input"
              placeholder="Enter Captcha"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={capInput}
              onChange={(e) => {
                setCapInput(e.target.value);
                if (statusMsg.text) setStatusMsg({ text: "", ok: false });
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: "#8fa3c0", margin: "8px 0 0" }}>{timerLabel}</p>

          <button
            type="submit"
            disabled={submitting}
            style={{
              display: "block",
              width: 230,
              margin: "16px auto 0",
              height: 44,
              border: 0,
              borderRadius: 6,
              background: "#0a6cff",
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? "Verifying..." : "Log In"}
          </button>

          <p
            role="alert"
            style={{
              minHeight: 22,
              margin: "12px 0 0",
              textAlign: "center",
              color: statusMsg.ok ? "#9be7a8" : "#ff8a80",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {statusMsg.text}
          </p>
        </form>
      </main>
    </div>
  );
}

