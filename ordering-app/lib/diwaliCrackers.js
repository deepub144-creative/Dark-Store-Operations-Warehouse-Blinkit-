/*! lib/diwaliCrackers.js · AUDIT'X Home Page Transparent Sound Crackers Show
 * Choreographed crackers (pop-pop, anar, rocket, bomb, laadi, skyshot, hydrogen bomb)
 * with Web Audio sound synthesis, scoped cleanly to #ax-ordering-shell when Home is active.
 */

let mounted = false;
let cv = null;
let cx = null;
let hintEl = null;
let resizeHandler = null;
let rafId = 0;
let tm = [];
let AC = null;
let ranSoundUnlock = false;
let lastB = 0;

let W = 0;
let H = 0;
let GROUND = 68;
let snd = true;
let loop = true;
let K = 0.6;
let rootSelector = "#ax-ordering-shell";

const S = [];
const F = [];
const RG = [];
const SM = [];
const C = [];

const COLS = ["#FFB000", "#FF6A00", "#FF2D55", "#E91E9C", "#1FB86B", "#1E90FF", "#F2C200", "#9B51E0"];
const PALS = [
  ["#FFB000", "#FF6A00", "#F2C200"],
  ["#FF2D55", "#E91E9C", "#FFB000"],
  ["#1FB86B", "#1E90FF", "#F2C200"],
  ["#9B51E0", "#1E90FF", "#EEEEEE"],
];
const PI2 = Math.PI * 2;
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const gy = () => H - GROUND / K;

function ctxA() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    AC = AC || new AudioCtx();
    if (AC.state === "suspended") AC.resume().catch(() => {});
    return AC;
  } catch (e) {
    return null;
  }
}

function boom(v = 0.2, low = 1800, dur = 0.35) {
  if (!snd || !mounted) return;
  const t = performance.now();
  if (t - lastB < 25) return;
  lastB = t;
  const A = ctxA();
  if (!A || A.state !== "running") return;
  const n = (A.sampleRate * dur) | 0;
  const b = A.createBuffer(1, n, A.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = A.createBufferSource();
  const g = A.createGain();
  const f = A.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = low;
  g.gain.value = v;
  s.buffer = b;
  s.connect(f);
  f.connect(g);
  g.connect(A.destination);
  s.start();
}

function tone(f0, f1, dur, v, type = "sine") {
  if (!snd || !mounted) return;
  const A = ctxA();
  if (!A || A.state !== "running") return;
  const o = A.createOscillator();
  const g = A.createGain();
  const t = A.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(A.destination);
  o.start();
  o.stop(t + dur);
}

const whistle = () => tone(500, 2200, 0.9, 0.05);
const thump = () => {
  tone(140, 35, 0.3, 0.35);
  boom(0.2, 500, 0.2);
};
const crack = (n) => {
  for (let i = 0; i < n; i++) {
    tm.push(setTimeout(() => boom(0.08, 5000, 0.08), R(80, 900)));
  }
};

const spark = (x, y, vx, vy, c, d = 0.02, o = {}) => {
  if (S.length < 3200) {
    S.push({ x, y, vx, vy, c, l: 1, d, s: o.s || 2, g: o.g ?? 0.05, f: o.f ?? 0.97, cr: o.cr });
  }
};
const flash = (x, y, r) => F.push({ x, y, r, l: 1 });
const smoke = (x, y, r = 6) => SM.push({ x, y, r, l: 1, vx: R(-0.3, 0.3), vy: -R(0.3, 0.9) });
const glow = (x, y, r, a, c = "255,170,40") => {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${c},${a})`);
  g.addColorStop(1, `rgba(${c},0)`);
  cx.fillStyle = g;
  cx.fillRect(x - r, y - r, r * 2, r * 2);
};
const fz = (x, y) => {
  for (let j = 0; j < 2; j++) spark(x, y, R(-1, 1), R(-1.6, 0), "#FFB000", 0.12, { s: 1.5, g: 0.08 });
};

function burst(x, y, t, c, s = 1) {
  const n = t === "ring" ? 50 : t === "heart" ? 64 : 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI2;
    const b = R(0, PI2);
    let v = R(1.5, 5) * s;
    let vx = Math.cos(b) * v;
    let vy = Math.sin(b) * v;
    let d = R(0.012, 0.024);
    let col = c;
    const o = { s: 2 };
    if (t === "ring") {
      v = 4.2 * s;
      vx = Math.cos(a) * v;
      vy = Math.sin(a) * v;
      o.g = 0.03;
      o.f = 0.96;
    } else if (t === "heart") {
      vx = 16 * Math.pow(Math.sin(a), 3) * 0.26 * s;
      vy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.26 * s;
      o.g = 0.03;
      o.f = 0.96;
    } else if (t === "willow") {
      d = R(0.005, 0.009);
      o.g = 0.035;
      o.f = 0.985;
      col = "#E8A200";
    } else if (t === "crackle") {
      o.cr = 1;
    } else if (t === "multi") {
      col = i % 2 ? c : pick(COLS);
    }
    spark(x, y, vx, vy, col, d, o);
  }
}

function explode(x, y) {
  const t = pick(["peony", "ring", "willow", "crackle", "heart", "multi"]);
  const c = pick(COLS);
  burst(x, y, t, c);
  flash(x, y, 190);
  boom(0.3, 2500, 0.5);
  crack(5);
  if (Math.random() < 0.4) {
    tm.push(setTimeout(() => mounted && burst(x, y, "peony", pick(COLS), 0.6), 200));
  }
}

function pot(x, y, col) {
  cx.fillStyle = col;
  cx.beginPath();
  cx.moveTo(x - 17, y);
  cx.lineTo(x + 17, y);
  cx.lineTo(x + 11, y - 42);
  cx.lineTo(x - 11, y - 42);
  cx.closePath();
  cx.fill();
  cx.fillStyle = "#F5B82E";
  cx.fillRect(x - 14, y - 26, 28, 5);
  cx.fillRect(x - 16, y - 6, 32, 4);
  cx.fillStyle = "#222";
  cx.beginPath();
  cx.ellipse(x, y - 42, 11, 3, 0, 0, PI2);
  cx.fill();
}

function rk(x, y) {
  cx.strokeStyle = "#8a6a3a";
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(x, y);
  cx.lineTo(x, y + 60);
  cx.stroke();
  cx.fillStyle = "#D7263D";
  cx.fillRect(x - 4, y - 22, 8, 22);
  cx.fillStyle = "#F5B82E";
  cx.fillRect(x - 4, y - 22, 8, 4);
  cx.beginPath();
  cx.moveTo(x - 4, y - 22);
  cx.lineTo(x, y - 32);
  cx.lineTo(x + 4, y - 22);
  cx.fill();
}

const T = {
  anar(c, f) {
    const { x, y } = c;
    pot(x, y, c.col);
    if (f < 45) {
      fz(x + 5 * (1 - f / 45), y - 46 - 4 * (1 - f / 45));
      return;
    }
    if (f > 340) return true;
    const n = f < 70 ? 3 : 5;
    for (let j = 0; j < n; j++) spark(x + R(-3, 3), y - 44, R(-1.7, 1.7), -R(4.5, 9), pick(c.pal), R(0.012, 0.022), { s: 1.8 });
    glow(x, y - 52, 48, 0.45);
    if (f % 9 === 0) boom(0.14, 5200, 0.15);
  },
  rocket(c, f) {
    if (!c.shell) {
      if (f < 40) {
        rk(c.x, c.y);
        fz(c.x, c.y);
        return;
      }
      if (f === 40) whistle();
      c.vy = (c.vy || -0.5) - 0.14;
      if (c.vy < -10.5) c.vy = -10.5;
    } else {
      c.vy += 0.08;
    }
    c.y += c.vy;
    c.x += Math.sin(f * 0.25) * 0.35;
    if (c.shell) glow(c.x, c.y, 12, 0.9, "255,200,90");
    else rk(c.x, c.y);
    for (let j = 0; j < 3; j++) {
      spark(c.x + R(-1.5, 1.5), c.y + R(0, 4), R(-0.5, 0.5), R(1, 3), pick(["#FFB000", "#FF6A00", "#F2C200"]), 0.05, { s: 1.6, g: 0.02 });
    }
    glow(c.x, c.y + 6, 18, 0.45);
    if (c.y < c.top || (c.shell && c.vy > -1.5)) {
      explode(c.x, c.y);
      return true;
    }
  },
  bomb(c, f) {
    const { x, y } = c;
    if (f < 75) {
      cx.fillStyle = "#C62828";
      cx.fillRect(x - 9, y - 26, 18, 26);
      cx.fillStyle = "#F5B82E";
      cx.fillRect(x - 9, y - 18, 18, 4);
      cx.fillStyle = "#fff3";
      cx.fillRect(x - 6, y - 24, 3, 22);
      const L = 26 * (1 - f / 75);
      const fx = x + 6;
      const fy = y - 26 - L;
      cx.strokeStyle = "#6b4f2a";
      cx.lineWidth = 1.8;
      cx.beginPath();
      cx.moveTo(x, y - 26);
      cx.quadraticCurveTo(x + 9, y - 26 - L * 0.5, fx, fy);
      cx.stroke();
      fz(fx, fy);
      return;
    }
    boom(0.6, 1200, 0.6);
    flash(x, y - 14, 320);
    RG.push({ x, y: y - 14, r: 10, l: 1 });
    for (let i = 0; i < 70; i++) {
      const q = R(0, PI2);
      const v = R(2, 9);
      spark(x, y - 14, Math.cos(q) * v, Math.sin(q) * v, pick(["#FF6A00", "#FFB000", "#F2C200"]), R(0.03, 0.06), { s: 2.4, g: 0.08 });
    }
    for (let i = 0; i < 14; i++) {
      const q = R(0, PI2);
      const v = R(1, 6);
      spark(x, y - 14, Math.cos(q) * v, Math.sin(q) * v - 2, pick(["#D7263D", "#F5B82E"]), 0.02, { s: 3.6, g: 0.16, f: 0.98 });
    }
    for (let i = 0; i < 7; i++) smoke(x + R(-14, 14), y - 14 + R(-10, 10), R(8, 16));
    return true;
  },
  laadi(c, f) {
    const n = 24;
    const sp = Math.min(300, W * 0.8);
    const x0 = c.x - sp / 2;
    const st = sp / (n - 1);
    const y = c.y;
    c.p = c.p || 0;
    while (c.p < n && f >= c.p * 3 + 20) {
      const px = x0 + c.p * st;
      for (let j = 0; j < 9; j++) {
        spark(px, y - 10, R(-2.6, 2.6), -R(0.5, 3.8), j % 2 ? "#FFFFFF" : "#FF9A00", R(0.06, 0.1), { s: 1.8 });
      }
      flash(px, y - 10, 46);
      boom(0.14, 4200, 0.12);
      smoke(px, y - 12, 5);
      c.p++;
    }
    cx.strokeStyle = "#6b4f2a";
    cx.lineWidth = 1.4;
    cx.beginPath();
    cx.moveTo(x0 + c.p * st, y - 5);
    cx.lineTo(x0 + sp, y - 5);
    cx.stroke();
    for (let k = c.p; k < n; k++) {
      const px = x0 + k * st;
      cx.fillStyle = "#D7263D";
      cx.fillRect(px - 3, y - 15, 6, 11);
      cx.fillStyle = "#F5B82E";
      cx.fillRect(px - 3, y - 11, 6, 2);
    }
    if (c.p < n) fz(x0 + c.p * st, y - 17);
    return c.p >= n && f > n * 3 + 50;
  },
  skyshot(c, f) {
    const { x, y } = c;
    cx.fillStyle = "#1d3a8a";
    cx.fillRect(x - 28, y - 30, 56, 30);
    cx.fillStyle = "#F5B82E";
    cx.fillRect(x - 28, y - 18, 56, 4);
    cx.fillStyle = "#111";
    for (let j = 0; j < 5; j++) {
      cx.beginPath();
      cx.ellipse(x - 20 + j * 10, y - 30, 4, 1.8, 0, 0, PI2);
      cx.fill();
    }
    c.n = c.n || 0;
    if (f < 30) fz(x, y - 32);
    if (c.n < 8 && f >= 30 + c.n * 26) {
      C.push({ k: "rocket", shell: 1, x: x + R(-16, 16), y: y - 34, vy: -R(8, 10.5), top: R(0.1, 0.45) * gy(), f: 0, pal: c.pal });
      flash(x, y - 34, 70);
      thump();
      whistle();
      for (let j = 0; j < 12; j++) spark(x + R(-14, 14), y - 34, R(-2, 2), -R(1, 4), "#FFB000", 0.06);
      c.n++;
    }
    return c.n >= 8 && f > 30 + 8 * 26 + 10;
  },
  poppop(c, f) {
    c.n = c.n || 0;
    if (c.next == null) c.next = 10;
    if (f >= c.next) {
      const px = c.x + R(-70, 70);
      const py = c.y - 3;
      flash(px, py, 38);
      boom(0.1, 3800);
      for (let j = 0; j < 8; j++) {
        spark(px, py, R(-2.5, 2.5), -R(0.5, 3), j % 2 ? "#FFFFFF" : "#F2B100", R(0.07, 0.12), { s: 1.5 });
      }
      c.n++;
      c.next = f + R(8, 22);
    }
    return c.n >= 14;
  },
  bigbomb(c, f) {
    const { x, y } = c;
    if (f < 100) {
      cx.fillStyle = "#1B5E20";
      cx.fillRect(x - 13, y - 40, 26, 40);
      cx.fillStyle = "#F5B82E";
      cx.fillRect(x - 13, y - 30, 26, 5);
      cx.fillRect(x - 13, y - 8, 26, 4);
      cx.fillStyle = "#D7263D";
      cx.beginPath();
      cx.arc(x, y - 19, 6, 0, PI2);
      cx.fill();
      const L = 34 * (1 - f / 100);
      const fx = x + 7;
      const fy = y - 40 - L;
      cx.strokeStyle = "#6b4f2a";
      cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(x, y - 40);
      cx.quadraticCurveTo(x + 12, y - 40 - L * 0.5, fx, fy);
      cx.stroke();
      fz(fx, fy);
      return;
    }
    const cy = y - 20;
    if (f === 100) {
      boom(0.9, 900, 0.8);
      flash(x, cy, 480);
      RG.push({ x, y: cy, r: 10, l: 1 });
      for (let i = 0; i < 140; i++) {
        const q = R(0, PI2);
        const v = R(2, 12);
        spark(x, cy, Math.cos(q) * v, Math.sin(q) * v, pick(["#FF6A00", "#FFB000", "#F2C200", "#FF2D55"]), R(0.025, 0.055), { s: 2.8, g: 0.09 });
      }
      for (let i = 0; i < 20; i++) {
        const q = R(0, PI2);
        const v = R(1, 7);
        spark(x, cy, Math.cos(q) * v, Math.sin(q) * v - 2.5, pick(["#1B5E20", "#F5B82E"]), 0.02, { s: 4, g: 0.17, f: 0.98 });
      }
      for (let i = 0; i < 12; i++) smoke(x + R(-20, 20), cy + R(-14, 14), R(10, 20));
    }
    if (f === 106) {
      boom(0.5, 700);
      flash(x, cy, 320);
      RG.push({ x, y: cy, r: 30, l: 1 });
    }
    return f >= 106;
  },
};

function light(k, xf) {
  const x = (xf == null ? R(0.12, 0.88) : xf) * W;
  const c = {
    k,
    x,
    y: gy(),
    f: 0,
    col: pick(["#C62828", "#1565C0", "#2E7D32", "#7B1FA2"]),
    pal: pick(PALS),
    dir: Math.random() < 0.5 ? 1 : -1,
    ph: R(0, 6),
  };
  if (k === "rocket") {
    c.y -= 62;
    c.top = R(0.1, 0.42) * gy();
  }
  C.push(c);
}

function sizeCanvas() {
  if (!cv || !cx) return;
  const rootEl = document.querySelector(rootSelector);
  const r = rootEl ? rootEl.getBoundingClientRect() : { left: 0, width: window.innerWidth };
  const cssW = Math.max(280, Math.round(r.width || Math.min(window.innerWidth, 440)));
  const cssH = window.innerHeight;
  const cssL = Math.round(r.left || 0);
  const d = Math.min(window.devicePixelRatio || 1, 2);

  cv.style.left = `${cssL}px`;
  cv.style.width = `${cssW}px`;
  cv.style.height = `${cssH}px`;

  if (hintEl) {
    hintEl.style.left = `${cssL + cssW / 2}px`;
  }

  W = cssW / K;
  H = cssH / K;
  cv.width = cssW * d;
  cv.height = cssH * d;
  cx.setTransform(d * K, 0, 0, d * K, 0, 0);
}

function stepFrame() {
  if (!cx) return;
  cx.clearRect(0, 0, W, H);
  for (let i = SM.length - 1; i >= 0; i--) {
    const s = SM[i];
    s.x += s.vx;
    s.y += s.vy;
    s.r += 0.35;
    s.l -= 0.012;
    if (s.l <= 0) {
      SM.splice(i, 1);
      continue;
    }
    cx.fillStyle = `rgba(110,100,100,${s.l * 0.28})`;
    cx.beginPath();
    cx.arc(s.x, s.y, s.r, 0, PI2);
    cx.fill();
  }
  for (let i = C.length - 1; i >= 0; i--) {
    const c = C[i];
    if (T[c.k](c, c.f++)) C.splice(i, 1);
  }
  cx.lineCap = "round";
  for (let i = S.length - 1; i >= 0; i--) {
    const p = S[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= p.f;
    p.vy = p.vy * p.f + p.g;
    p.l -= p.d;
    if (p.l <= 0) {
      if (p.cr) {
        for (let k = 0; k < 5; k++) spark(p.x, p.y, R(-1.6, 1.6), R(-1.6, 1.6), "#F2B100", 0.08, { s: 1.3 });
      }
      S.splice(i, 1);
      continue;
    }
    cx.globalAlpha = p.l;
    cx.strokeStyle = p.c;
    cx.lineWidth = p.s * (0.4 + p.l * 0.6);
    cx.beginPath();
    cx.moveTo(p.x - p.vx * 1.7, p.y - p.vy * 1.7);
    cx.lineTo(p.x, p.y);
    cx.stroke();
  }
  cx.globalAlpha = 1;
  for (let i = RG.length - 1; i >= 0; i--) {
    const r = RG[i];
    r.r += 7;
    r.l -= 0.045;
    if (r.l <= 0) {
      RG.splice(i, 1);
      continue;
    }
    cx.strokeStyle = `rgba(255,190,90,${r.l})`;
    cx.lineWidth = 1 + 3 * r.l;
    cx.beginPath();
    cx.arc(r.x, r.y, r.r, 0, PI2);
    cx.stroke();
  }
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i];
    f.l -= 0.09;
    if (f.l <= 0) {
      F.splice(i, 1);
      continue;
    }
    glow(f.x, f.y, f.r, f.l * 0.85, "255,215,120");
  }
}

const SEQ = [
  [300, "poppop", 0.5],
  [4200, "anar", 0.5],
  [10400, "rocket", 0.5],
  [15200, "bomb", 0.5],
  [17800, "laadi", 0.5],
  [21400, "skyshot", 0.5],
  [30000, "bigbomb", 0.5],
];

function stopTimers() {
  tm.forEach(clearTimeout);
  tm = [];
}

function clearEntities() {
  stopTimers();
  C.length = 0;
  S.length = 0;
  F.length = 0;
  RG.length = 0;
  SM.length = 0;
}

function show() {
  if (!mounted) return;
  stopTimers();
  SEQ.forEach(([t, k, x]) => {
    tm.push(setTimeout(() => mounted && !document.hidden && light(k, x), t));
  });
  tm.push(
    setTimeout(() => {
      if (mounted && loop) show();
    }, 35000)
  );
}

function onUnlockGesture() {
  if (!mounted || ranSoundUnlock) return;
  const A = ctxA();
  if (!A) return;
  const finishUnlock = () => {
    if (!mounted || ranSoundUnlock) return;
    ranSoundUnlock = true;
    if (hintEl) {
      hintEl.remove();
      hintEl = null;
    }
    clearEntities();
    show();
  };
  if (A.state === "running") {
    finishUnlock();
  } else {
    A.resume()
      .then(() => {
        if (A.state === "running") finishUnlock();
      })
      .catch(() => {});
  }
}

const GESTURE_EVENTS = ["pointerdown", "touchstart", "click", "keydown", "wheel"];

function mount(opts = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (mounted) return true;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;

  rootSelector = opts.root || "#ax-ordering-shell";
  GROUND = Number(opts.ground ?? 68);
  K = Math.min(Math.max(Number(opts.scale ?? 0.6), 0.3), 1.2);
  snd = opts.sound !== false;
  loop = opts.loop !== false;
  ranSoundUnlock = false;
  mounted = true;

  cv = document.createElement("canvas");
  cv.id = "ax-diwali-crackers-fx";
  cv.style.cssText =
    "position:fixed;top:0;height:100vh;pointer-events:none;z-index:96;background:transparent;";
  document.body.appendChild(cv);
  cx = cv.getContext("2d");

  const existingA = ctxA();
  if (existingA && existingA.state === "running") {
    ranSoundUnlock = true;
  } else if (snd) {
    hintEl = document.createElement("div");
    hintEl.textContent = "🔊 Tap anywhere to turn on sound";
    hintEl.style.cssText =
      "position:fixed;top:calc(54px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:98;padding:6px 13px;border-radius:999px;background:rgba(30,12,30,0.82);color:#FFE9B8;font:600 12px system-ui,sans-serif;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.22);";
    document.body.appendChild(hintEl);
  }

  sizeCanvas();
  resizeHandler = () => sizeCanvas();
  window.addEventListener("resize", resizeHandler);
  GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, onUnlockGesture, { passive: true }));

  let lastT = performance.now();
  let acc = 0;
  const raf = (now) => {
    if (!mounted) return;
    rafId = requestAnimationFrame(raf);
    acc += Math.min(now - lastT, 50);
    lastT = now;
    while (acc >= 16.67) {
      stepFrame();
      acc -= 16.67;
    }
  };
  rafId = requestAnimationFrame(raf);

  const startDelay = Number(opts.delayMs ?? 0);
  if (startDelay > 0) {
    tm.push(setTimeout(() => mounted && show(), startDelay));
  } else {
    show();
  }
  return true;
}

function unmount() {
  if (typeof window === "undefined" || !mounted) return;
  mounted = false;
  cancelAnimationFrame(rafId);
  clearEntities();
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, onUnlockGesture));
  if (hintEl) {
    hintEl.remove();
    hintEl = null;
  }
  if (cv) {
    cv.remove();
    cv = null;
  }
  cx = null;
}

const DiwaliCrackers = {
  mount,
  unmount,
  show,
  light,
  clear: clearEntities,
  sound: (v) => {
    snd = !!v;
  },
  ground: (v) => {
    GROUND = Number(v);
  },
  scale: (v) => {
    K = Math.min(Math.max(Number(v), 0.3), 1.2);
    sizeCanvas();
  },
  loop: (v) => {
    loop = !!v;
  },
};

if (typeof window !== "undefined") {
  window.DiwaliCrackers = DiwaliCrackers;
}

export default DiwaliCrackers;
