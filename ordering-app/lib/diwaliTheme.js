/*! lib/diwaliTheme.js · AUDIT'X Home Page Festive Animation & Theme
 * Mounted ONLY when the Customer Ordering App Home view is active.
 */

const PALETTE = {
  light: {
    bg: "#FFF6E6",
    card: "#FFFFFF",
    soft: "#FFF9EE",
    ink: "#2A0A1F",
    muted: "#7A5C68",
    line: "#F0DDB8",
    primary: "#C2410C",
    primaryInk: "#FFFFFF",
    primarySoft: "#FFF1E6",
    gold: "#F5B82E",
    goldInk: "#4A1D00",
    header1: "#3A0F2C",
    header2: "#7A1239",
    headerInk: "#FFF1D6",
    badge: "#7A1239",
    badgeInk: "#FFD86B",
    nav: "#2A0A1F",
    navInk: "#E9D5C0",
    navOn: "#FFB000",
    delivery1: "#FFFFFF",
    delivery2: "#FFEFC4",
  },
  dark: {
    bg: "#160812",
    card: "#251020",
    soft: "#2E1627",
    ink: "#FBE9CF",
    muted: "#C9A9B5",
    line: "#42223A",
    primary: "#FF8A1F",
    primaryInk: "#2A0A00",
    primarySoft: "#3A1C10",
    gold: "#F5B82E",
    goldInk: "#2A1400",
    header1: "#240A1B",
    header2: "#5E0F2E",
    headerInk: "#FFF1D6",
    badge: "#FFB000",
    badgeInk: "#3A0F2C",
    nav: "#12060E",
    navInk: "#C9A9B5",
    navOn: "#FFB000",
    delivery1: "#251020",
    delivery2: "#3A1A1E",
  },
};

const q = (n) => `[data-dfx="${n}"]`;

const DEFAULTS = {
  root: "#ax-ordering-shell",
  ground: 58,
  mode: "light",
  sound: true,
  ambient: true,
  once: true,
  dates: null,
  petals: 24,
  greeting: "Happy Diwali",
  from: "team AUDIT'X",
  selectors: {
    page: q("page"),
    header: q("header"),
    delivery: q("delivery"),
    search: q("search"),
    chip: q("chip"),
    chipOn: `${q("chip")}.on,${q("chip")}.active,${q("chip")}[aria-pressed="true"],${q("chip")}[aria-selected="true"]`,
    card: q("card"),
    badge: q("badge"),
    add: q("add"),
    stepper: q("stepper"),
    cta: q("cta"),
    cart: q("cart"),
    cartCount: `${q("cart")} b`,
    nav: q("nav"),
    navOn: `${q("nav")} .on,${q("nav")} [aria-current="page"],${q("nav")} [aria-current="page"] span`,
  },
};

const themeRules = (S) => `
${S.page}{background:var(--dfx-bg)!important;color:var(--dfx-ink)!important}
${S.header}{background:linear-gradient(160deg,var(--dfx-header1),var(--dfx-header2))!important;color:var(--dfx-headerInk)!important;border-color:transparent!important}
${S.header} .c.open{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,216,107,0.45)!important;color:#FFD86B!important}
${S.header} .c.open i{background:#FFD86B!important}
${S.header} .c.user{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,216,107,0.4)!important}
${S.header} .c.support{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,216,107,0.35)!important;color:#FFD86B!important}
${S.delivery}{background:linear-gradient(180deg,var(--dfx-delivery1),var(--dfx-delivery2))!important;border-color:var(--dfx-line)!important;color:var(--dfx-ink)!important}
${S.search}{background:var(--dfx-card)!important;border-color:var(--dfx-gold)!important}
${S.chip}{background:var(--dfx-card)!important;border-color:var(--dfx-line)!important;color:var(--dfx-ink)!important}
${S.chipOn}{background:var(--dfx-primary)!important;border-color:var(--dfx-primary)!important;color:var(--dfx-primaryInk)!important}
${S.card}{background:var(--dfx-card)!important;border-color:var(--dfx-line)!important}
${S.badge}{background:var(--dfx-badge)!important;color:var(--dfx-badgeInk)!important}
${S.add}{background:var(--dfx-primarySoft)!important;border-color:var(--dfx-primary)!important;color:var(--dfx-primary)!important}
${S.stepper}{background:var(--dfx-primary)!important;color:var(--dfx-primaryInk)!important}
${S.cta}{background:var(--dfx-soft)!important;border-color:var(--dfx-gold)!important;color:var(--dfx-primary)!important}
${S.cart}{background:linear-gradient(135deg,var(--dfx-gold),#FF9E1B)!important;border-color:transparent!important;color:var(--dfx-goldInk)!important}
${S.cartCount}{background:var(--dfx-header2)!important;color:#fff!important}
${S.nav}{background:var(--dfx-nav)!important;border-color:transparent!important;color:var(--dfx-navInk)!important}
${S.nav} button{color:var(--dfx-navInk)!important}
${S.nav} button span{color:var(--dfx-navInk)!important}
${S.nav} [aria-current="page"] svg{stroke:var(--dfx-navOn)!important;fill:rgba(255,176,0,0.2)!important}
${S.navOn}{color:var(--dfx-navOn)!important}`;

const FX_CSS = `
.dfx-l{position:fixed;pointer-events:none}
.dfx-lights{z-index:52;transition:opacity .15s ease}.dfx-lights path{fill:none;stroke:#2b1a14;stroke-width:1.5}
.dfx-lights circle{animation:dfx-tw 1.5s ease-in-out infinite alternate;filter:drop-shadow(0 0 4px currentColor)}
@keyframes dfx-tw{from{opacity:.3}to{opacity:1}}
.dfx-lants{z-index:30;overflow:hidden}
.dfx-lant{position:absolute;bottom:-40px;width:15px;height:21px;border-radius:45% 45% 35% 35%;background:linear-gradient(#FFE08A,#FF9E1B);box-shadow:0 0 14px 4px #FFC24D88;opacity:0;animation:dfx-rise 9s ease-in infinite}
@keyframes dfx-rise{0%{transform:translate(0,0);opacity:0}12%{opacity:.9}100%{transform:translate(18px,-62vh) scale(.55);opacity:0}}
.dfx-glow{position:relative;overflow:hidden}
.dfx-glow:after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,#FFD86B66,transparent);transform:skewX(-18deg);animation:dfx-sw 4.5s 1.5s ease-in-out infinite;pointer-events:none}
@keyframes dfx-sw{0%{left:-40%}45%,100%{left:130%}}
.dfx-bump{animation:dfx-bump .5s}
@keyframes dfx-bump{35%{transform:scale(1.2) rotate(-5deg);box-shadow:0 0 0 6px #FFB00055}}
.dfx-splash{z-index:90;display:grid;place-content:center;justify-items:center;overflow:hidden;pointer-events:auto;cursor:pointer;background:radial-gradient(circle at 50% 42%,#5a1236,#1a0612 70%);transition:opacity .7s,visibility .7s}
.dfx-splash.off{opacity:0;visibility:hidden;pointer-events:none}
.dfx-rays{position:absolute;left:-50%;top:-25%;width:200%;height:150%;background:repeating-conic-gradient(from 0deg at 50% 45%,#FFB00033 0 5deg,transparent 5deg 15deg);-webkit-mask-image:radial-gradient(circle at 50% 45%,#000,transparent 55%);mask-image:radial-gradient(circle at 50% 45%,#000,transparent 55%);opacity:0;animation:dfx-spin 30s linear infinite}
.go .dfx-rays{opacity:1;transition:opacity 1.2s .6s}
@keyframes dfx-spin{to{transform:rotate(360deg)}}
.dfx-diya{width:170px;position:relative}
.dfx-flame{transform-origin:60px 50px;transform:scale(0)}.dfx-glw{opacity:0}
.go .dfx-flame{animation:dfx-ign .6s .5s forwards,dfx-flk .2s 1.1s infinite alternate}
.go .dfx-glw{animation:dfx-g 1.6s .6s infinite alternate}
@keyframes dfx-ign{to{transform:scale(1)}}
@keyframes dfx-flk{from{transform:scale(1) rotate(-2deg)}to{transform:scale(1.06,.93) rotate(2deg)}}
@keyframes dfx-g{from{opacity:.55}to{opacity:1}}
.dfx-splash h1{position:relative;margin:6px 0 0;font:800 40px/1.1 'Baloo 2',system-ui,sans-serif;color:#FFC84A;text-shadow:0 0 22px #FF8A0088;text-align:center}
.dfx-splash h1 i{display:inline-block;font-style:normal;opacity:0;transform:translateY(-16px)}
.go h1 i{animation:dfx-drop .6s both;animation-delay:calc(var(--i)*55ms + 1s)}
@keyframes dfx-drop{to{opacity:1;transform:none}}
.dfx-splash p{position:relative;margin:4px 0 0;color:#FBE9CF;font:600 14px 'Baloo 2',system-ui,sans-serif;opacity:0;text-align:center}
.go p{animation:dfx-drop .8s 1.9s both}
@media(prefers-reduced-motion:reduce){.dfx-l,.dfx-l *,.dfx-glow:after,.dfx-bump{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;

const DIYA_SVG = `<svg class="dfx-diya" viewBox="0 0 120 100" aria-hidden="true"><defs>
<radialGradient id="dg"><stop offset="0" stop-color="#FFD86B" stop-opacity=".9"/><stop offset="1" stop-color="#FF8A00" stop-opacity="0"/></radialGradient>
<linearGradient id="dc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2802F"/><stop offset="1" stop-color="#8E3A12"/></linearGradient>
<linearGradient id="df" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF6A00"/><stop offset=".6" stop-color="#FFB000"/><stop offset="1" stop-color="#FFF6C8"/></linearGradient></defs>
<circle class="dfx-glw" cx="60" cy="34" r="46" fill="url(#dg)"/><path d="M8 54 Q60 112 112 54 Q60 64 8 54Z" fill="url(#dc)"/>
<path d="M8 54 Q60 64 112 54 Q60 46 8 54Z" fill="#B85A1E"/><path class="dfx-flame" d="M60 52 C45 36 54 20 60 4 C66 20 75 36 60 52Z" fill="url(#df)"/></svg>`;

const NS = "http://www.w3.org/2000/svg";
const COL = ["#FFB000", "#FF7A1A", "#FFD86B", "#FF4D6D", "#FFF1B8"];
const rnd = (a, b) => a + Math.random() * (b - a);
const vars = (p) => Object.entries(p).map(([k, v]) => `--dfx-${k}:${v}`).join(";");

let o,
  on = false,
  RM = false,
  root,
  styleEl,
  meta,
  metaPrev,
  mq,
  cv,
  cx,
  lights,
  splash,
  glowEls = [];
let els = [],
  tm = [],
  raf = 0,
  amb = 0,
  ac,
  L = 0,
  W = 0,
  H = 0,
  t = 0,
  petals = [],
  sparks = [],
  ck = [];

const merge = (u) => ({
  ...DEFAULTS,
  ...u,
  selectors: { ...DEFAULTS.selectors, ...u.selectors },
  palette: {
    light: { ...PALETTE.light, ...u.palette?.light },
    dark: { ...PALETTE.dark, ...u.palette?.dark },
  },
});

const inRange = (d) =>
  !d || (Date.now() >= new Date(d[0] + "T00:00:00") && Date.now() <= new Date(d[1] + "T23:59:59"));

const addEl = (tag, cls, html, svg) => {
  const e = svg ? document.createElementNS(NS, tag) : document.createElement(tag);
  e.setAttribute("class", cls);
  if (html) e.innerHTML = html;
  document.body.appendChild(e);
  els.push(e);
  return e;
};

function setMode(m) {
  o.mode = m;
  const dark =
    m === "dark" || (m === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.dfxMode = dark ? "dark" : "light";
  if (meta) meta.content = dark ? o.palette.dark.header1 : o.palette.light.header2;
}

const onScheme = () => o.mode === "auto" && setMode("auto");

function applyTheme() {
  styleEl = document.createElement("style");
  styleEl.id = "dfx-theme";
  styleEl.textContent =
    `:root{${vars(o.palette.light)}}:root[data-dfx-mode="dark"]{${vars(o.palette.dark)}}` +
    themeRules(o.selectors) +
    FX_CSS;
  document.head.appendChild(styleEl);
  meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.dataset.dfx = "1";
    document.head.appendChild(meta);
  }
  metaPrev = meta.content;
  mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onScheme);
  setMode(o.mode);
}

function positionLightsOnly() {
  if (!lights || !o) return;
  const hd = document.querySelector(o.selectors.header);
  const top = hd ? hd.getBoundingClientRect().bottom : 38;
  lights.style.left = `${L}px`;
  lights.style.top = `${Math.max(-46, top)}px`;
  lights.style.width = `${W}px`;
  lights.style.opacity = top <= 4 ? "0" : "1";
}

function buildLights() {
  const hd = document.querySelector(o.selectors.header);
  const top = hd ? hd.getBoundingClientRect().bottom : 38;
  lights.style.cssText = `left:${L}px;top:${Math.max(-46, top)}px;width:${W}px;height:42px`;
  lights.setAttribute("width", W);
  lights.setAttribute("height", 42);
  let d = "M0 2",
    x = 0;
  while (x < W) {
    d += ` Q${x + 55} 34 ${x + 110} 4`;
    x += 110;
  }
  lights.innerHTML = `<path d="${d}"/><g></g>`;
  const p = lights.querySelector("path"),
    g = lights.querySelector("g"),
    len = p.getTotalLength(),
    n = Math.max(8, Math.round(W / 26));
  for (let i = 0; i <= n; i++) {
    const pt = p.getPointAtLength((len * i) / n),
      c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", pt.x);
    c.setAttribute("cy", pt.y + 4);
    c.setAttribute("r", 4);
    c.style.fill = c.style.color = COL[i % 5];
    c.style.animationDelay = (i % 7) * 0.22 + "s";
    g.appendChild(c);
  }
}

function layout() {
  if (!root || !cv) return;
  const r = root.getBoundingClientRect(),
    d = Math.min(devicePixelRatio || 1, 2);
  L = r.left;
  W = r.width || Math.min(innerWidth, 440);
  H = innerHeight;
  cv.width = W * d;
  cv.height = H * d;
  cx.setTransform(d, 0, 0, d, 0, 0);
  els.forEach((e) => {
    if (e === lights) return;
    e.style.left = L + "px";
    e.style.width = W + "px";
    if (e.classList.contains("dfx-splash") || e.classList.contains("dfx-lants")) {
      e.style.top = "0";
      e.style.height = H + "px";
    }
  });
  buildLights();
}

function buildLayers() {
  cv = addEl("canvas", "dfx-l");
  cv.style.cssText = "top:0;height:100vh;z-index:95";
  cx = cv.getContext("2d");
  lights = addEl("svg", "dfx-l dfx-lights", "", true);
  addEl(
    "div",
    "dfx-l dfx-lants",
    [12, 38, 64, 86]
      .map(
        (l, i) =>
          `<i class="dfx-lant" style="left:${l}%;animation-delay:${[0, 3, 6, 1.5][i]}s"></i>`
      )
      .join("")
  );
  const word = [...o.greeting]
    .map((c, i) => `<i style="--i:${i}">${c === " " ? "&nbsp;" : c}</i>`)
    .join("");
  splash = addEl(
    "div",
    "dfx-l dfx-splash",
    `<div class="dfx-rays"></div>${DIYA_SVG}<h1 aria-label="${o.greeting}">${word}</h1><p>${o.from}</p>`
  );
  splash.onclick = () => {
    tm.forEach(clearTimeout);
    splash.classList.add("off");
  };
  glowEls = [...document.querySelectorAll(o.selectors.delivery)];
  glowEls.forEach((e) => e.classList.add("dfx-glow"));
}

const petal = (top) => ({
  x: rnd(0, W),
  y: top ? rnd(-40, -8) : rnd(0, H),
  s: rnd(4, 7.5),
  vy: rnd(0.35, 0.9),
  sw: rnd(0.6, 1.6),
  ph: rnd(0, 6.28),
  rot: rnd(0, 6.28),
  vr: rnd(-0.03, 0.03),
  c: Math.random() < 0.7 ? "#FFA800" : "#FF6A00",
});

const spk = (x, y, vx, vy, c, d) =>
  sparks.push({ x, y, vx, vy, l: 1, d: d || rnd(0.015, 0.03), c: c || COL[(Math.random() * 5) | 0] });

function burst(x, y, n) {
  if (RM) n = Math.min(n, 10);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rnd(-0.1, 0.1),
      v = rnd(1.6, 4.8);
    spk(x, y, Math.cos(a) * v, Math.sin(a) * v, COL[i % 5], rnd(0.012, 0.02));
  }
}

const gy = () => H - o.ground;
const light = (k, x, extra) => ck.push({ k, x, y: gy(), a: 0, ...extra });

function pop(v) {
  if (!o.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const n = (ac.sampleRate * 0.18) | 0,
      b = ac.createBuffer(1, n, ac.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = ac.createBufferSource(),
      g = ac.createGain();
    g.gain.value = v || 0.15;
    s.buffer = b;
    s.connect(g);
    g.connect(ac.destination);
    s.start();
  } catch (e) {
    /* audio blocked until a tap */
  }
}

function glow(x, y, r, a) {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,214,107,${a})`);
  g.addColorStop(1, "rgba(255,138,0,0)");
  cx.globalCompositeOperation = "lighter";
  cx.fillStyle = g;
  cx.beginPath();
  cx.arc(x, y, r, 0, 6.283);
  cx.fill();
  cx.globalCompositeOperation = "source-over";
}

function drawCrackers() {
  for (let i = ck.length - 1; i >= 0; i--) {
    const c = ck[i],
      f = ++c.a,
      x = c.x,
      y = c.y;
    if (c.k === "anar") {
      const out = f > 330;
      cx.save();
      cx.translate(x, y);
      cx.fillStyle = out ? "#2d1812" : "#C8321E";
      cx.beginPath();
      cx.moveTo(-13, 0);
      cx.lineTo(13, 0);
      cx.lineTo(9, -30);
      cx.lineTo(-9, -30);
      cx.closePath();
      cx.fill();
      cx.fillStyle = out ? "#4a3a22" : "#F5B82E";
      cx.fillRect(-11, -11, 22, 4);
      if (f < 40) {
        const p = f / 40,
          fx = 4 * (1 - p),
          fy = -50 + 20 * p;
        cx.strokeStyle = "#d9c79a";
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(fx, fy);
        cx.lineTo(0, -30);
        cx.stroke();
        cx.restore();
        spk(x + fx, y + fy, rnd(-0.6, 0.6), rnd(-0.6, 0.6), "#FFF1B8", 0.08);
        glow(x + fx, y + fy, 12, 0.9);
      } else {
        cx.restore();
      }
      if (f >= 40 && f < 330) {
        const n = f < 70 ? 3 : 6;
        for (let j = 0; j < n; j++) spk(x + rnd(-3, 3), y - 30, rnd(-1.5, 1.5), -rnd(4, 8), null, rnd(0.012, 0.022));
        glow(x, y - 32, 42, 0.6);
        if (f === 40) pop(0.12);
      } else if (f > 420) {
        ck.splice(i, 1);
      }
    } else if (c.k === "spark") {
      const len = Math.max(0, 70 * (1 - f / 360)),
        tx = x + Math.cos(-1.15) * len,
        ty = y + Math.sin(-1.15) * len;
      cx.strokeStyle = "#8a8f98";
      cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(x, y);
      cx.lineTo(tx, ty);
      cx.stroke();
      if (f < 360) {
        for (let j = 0; j < 5; j++) {
          const a = rnd(0, 6.283),
            v = rnd(1, 3.2);
          spk(tx, ty, Math.cos(a) * v, Math.sin(a) * v - 0.3, Math.random() < 0.6 ? "#FFF1B8" : "#FFB000", rnd(0.04, 0.08));
        }
        glow(tx, ty, 26, 0.8);
      } else if (f > 380) {
        ck.splice(i, 1);
      }
    } else if (c.k === "chakra") {
      const ang = f * 0.12 + f * f * 0.0006;
      cx.save();
      cx.translate(x, y - 9);
      cx.rotate(ang);
      cx.fillStyle = f > 280 ? "#2d1812" : "#2E7D32";
      cx.beginPath();
      cx.arc(0, 0, 11, 0, 6.283);
      cx.fill();
      cx.strokeStyle = "#F5B82E";
      cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(-11, 0);
      cx.lineTo(11, 0);
      cx.moveTo(0, -11);
      cx.lineTo(0, 11);
      cx.stroke();
      cx.restore();
      if (f < 260) {
        for (let j = 0; j < 2; j++) {
          const a = ang + j * 3.14159;
          spk(
            x + Math.cos(a) * 12,
            y - 9 + Math.sin(a) * 12,
            -Math.sin(a) * 3.2 + Math.cos(a) * 1.2,
            Math.cos(a) * 3.2 + Math.sin(a) * 1.2 - 0.4,
            j ? "#FFD86B" : "#FF4D6D",
            rnd(0.025, 0.04)
          );
        }
        glow(x, y - 9, 24, 0.5);
      } else if (f > 300) {
        ck.splice(i, 1);
      }
    } else if (c.k === "rocket") {
      if (f === 1) {
        c.vy = -9;
        c.dx = rnd(-0.5, 0.5);
        c.top = H * rnd(0.2, 0.34);
        pop(0.1);
      }
      c.vy += 0.07;
      c.y += c.vy;
      c.x += c.dx;
      cx.save();
      cx.translate(c.x, c.y);
      cx.rotate(c.dx * 0.1);
      cx.fillStyle = "#E11D48";
      cx.fillRect(-2.5, -8, 5, 12);
      cx.fillStyle = "#FACC15";
      cx.fillRect(-2.5, -8, 5, 3);
      cx.strokeStyle = "#C9A36B";
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.moveTo(0, 4);
      cx.lineTo(0, 16);
      cx.stroke();
      cx.restore();
      for (let j = 0; j < 3; j++) {
        spk(
          c.x + rnd(-1.5, 1.5),
          c.y + 5,
          rnd(-0.4, 0.4),
          rnd(0.5, 1.6),
          Math.random() < 0.5 ? "#FFB000" : "#FFF1B8",
          rnd(0.035, 0.06)
        );
      }
      if (c.y < c.top || c.vy > -1.2) {
        const bx = c.x,
          by = c.y;
        burst(bx, by, 64);
        tm.push(setTimeout(() => burst(bx, by, 36), 220));
        pop(0.25);
        ck.splice(i, 1);
      }
    } else if (c.k === "string") {
      const n = 26,
        st = (c.x1 - c.x0) / (n - 1);
      c.fl = c.fl || [];
      c.p = c.p || 0;
      cx.strokeStyle = "#d9c79a";
      cx.lineWidth = 1;
      cx.beginPath();
      cx.moveTo(c.x0, y - 5);
      cx.lineTo(c.x1, y - 5);
      cx.stroke();
      while (c.p < n && f >= c.p * 3) {
        const px = c.x0 + c.p * st;
        for (let j = 0; j < 8; j++) {
          spk(px, y - 6, rnd(-2.4, 2.4), -rnd(0.3, 3.2), j % 2 ? "#FFFFFF" : "#FFB000", rnd(0.06, 0.1));
        }
        c.fl.push([px, f]);
        if (c.p % 3 === 0) pop(0.07);
        c.p++;
      }
      for (const s of c.fl) if (f - s[1] < 6) glow(s[0], y - 6, 32, 1 - (f - s[1]) / 6);
      for (let k = c.p; k < n; k++) {
        const px = c.x0 + k * st;
        cx.fillStyle = "#D7263D";
        cx.fillRect(px - 3, y - 12, 6, 10);
        cx.fillStyle = "#F5B82E";
        cx.fillRect(px - 3, y - 8, 6, 2);
      }
      if (f > n * 3 + 40) ck.splice(i, 1);
    }
  }
}

function frame() {
  if (!on || !cx) return;
  if (typeof document !== "undefined" && document.hidden) {
    raf = requestAnimationFrame(frame);
    return;
  }
  cx.clearRect(0, 0, W, H);
  t += 0.016;
  for (const p of petals) {
    p.y += p.vy;
    p.x += Math.sin(t * p.sw + p.ph) * 0.6;
    p.rot += p.vr;
    if (p.y > H + 10) Object.assign(p, petal(true));
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + p.ph));
    cx.fillStyle = p.c;
    cx.globalAlpha = 0.9;
    cx.beginPath();
    cx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, 6.283);
    cx.fill();
    cx.restore();
  }
  cx.globalCompositeOperation = "lighter";
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.97;
    s.vy = s.vy * 0.97 + 0.05;
    s.l -= s.d;
    if (s.l <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    cx.globalAlpha = s.l;
    cx.fillStyle = s.c;
    cx.beginPath();
    cx.arc(s.x, s.y, 2.4 * s.l + 0.4, 0, 6.283);
    cx.fill();
  }
  cx.globalCompositeOperation = "source-over";
  cx.globalAlpha = 1;
  drawCrackers();
  raf = requestAnimationFrame(frame);
}

function getDailyGreetingKey() {
  try {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `auditx_diwali_seen_${yr}-${mo}-${da}`;
  } catch (e) {
    return "auditx_diwali_seen_today";
  }
}

function hasSeenGreetingToday() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const key = getDailyGreetingKey();
    return window.localStorage.getItem(key) === "1";
  } catch (e) {
    return false;
  }
}

function markGreetingSeenToday() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const key = getDailyGreetingKey();
    window.localStorage.setItem(key, "1");
    // Prune stale diwali keys older than today
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("auditx_diwali_seen_") && k !== key) {
        window.localStorage.removeItem(k);
      }
    }
  } catch (e) {}
}

function play(withSplash = true) {
  if (!on || !splash) return;
  tm.forEach(clearTimeout);
  tm = [];

  // When splash is disabled (already seen today or returning to home),
  // hide the "Happy Diwali" text overlay and immediately fire background celebratory animations
  if (RM || !withSplash) {
    splash.classList.add("off");
    const at = (ms, fn) => tm.push(setTimeout(fn, ms));
    at(400, () => light("anar", W * 0.14));
    at(800, () => light("anar", W * 0.86));
    at(1300, () => light("chakra", W * 0.5));
    at(1900, () => light("rocket", W * 0.3));
    at(2400, () => light("rocket", W * 0.7));
    return;
  }

  // First-time daily visit / after 12:00 AM: show full "Happy Diwali" festive splash
  splash.classList.remove("off", "go");
  void splash.offsetWidth;
  splash.classList.add("go");
  const at = (ms, fn) => tm.push(setTimeout(fn, ms));
  at(700, () => light("anar", W * 0.14));
  at(1000, () => light("anar", W * 0.86));
  at(1500, () => light("chakra", W * 0.5));
  at(2200, () => light("rocket", W * 0.3));
  at(2700, () => light("rocket", W * 0.7));
  at(3200, () => light("rocket", W * 0.5));
  at(3800, () => light("spark", W * 0.3));
  at(3900, () => light("spark", W * 0.7));
  at(5300, () => splash.classList.add("off"));
  at(5600, () => light("string", 0, { x0: W * 0.1, x1: W * 0.9 }));
}

function onClick(e) {
  const b = e.target.closest("button,[data-dfx]");
  if (!b) return;
  if (b.matches(`${o.selectors.add},${q("pop")}`) || /^ADD$/i.test(b.textContent.trim())) {
    const r = b.getBoundingClientRect();
    burst(r.left + r.width / 2 - L, r.top + r.height / 2, 22);
    pop(0.1);
    const c = document.querySelector(o.selectors.cart);
    if (c) {
      c.classList.remove("dfx-bump");
      void c.offsetWidth;
      c.classList.add("dfx-bump");
    }
  }
}

function mount(opts = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (on) return true;
  o = merge(opts);
  if (!inRange(o.dates)) return false;
  on = true;
  RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root = document.querySelector(o.root) || document.body;
  applyTheme();
  buildLayers();
  const isMobile = typeof window !== "undefined" && (window.innerWidth <= 768 || (typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))));
  const petalCount = RM ? 0 : isMobile ? Math.min(o.petals, 8) : o.petals;
  petals = Array.from({ length: petalCount }, () => petal(false));
  layout();
  addEventListener("resize", layout);
  addEventListener("scroll", positionLightsOnly, { passive: true });
  document.addEventListener("click", onClick);
  if (o.ambient && !RM) {
    amb = setInterval(() => {
      if (!document.hidden && on) {
        light(Math.random() < 0.75 ? "rocket" : "anar", rnd(W * 0.15, W * 0.85));
      }
    }, 9000);
  }
  frame();
  const seenToday = hasSeenGreetingToday();
  const showSplash = opts.forceSplash ? true : !seenToday;

  if (showSplash) {
    play(true);
    markGreetingSeenToday();
  } else {
    // Already seen today or returning to home view: keep "Happy Diwali" screen off, play festive animations only
    play(false);
  }
  return true;
}

function unmount() {
  if (typeof window === "undefined" || !on) return;
  on = false;
  cancelAnimationFrame(raf);
  clearInterval(amb);
  tm.forEach(clearTimeout);
  tm = [];
  removeEventListener("resize", layout);
  removeEventListener("scroll", positionLightsOnly);
  document.removeEventListener("click", onClick);
  mq && mq.removeEventListener("change", onScheme);
  els.forEach((e) => e.remove());
  els = [];
  ck = [];
  sparks = [];
  petals = [];
  glowEls.forEach((e) => e.classList.remove("dfx-glow"));
  glowEls = [];
  styleEl && styleEl.remove();
  styleEl = null;
  if (typeof document !== "undefined") {
    delete document.documentElement.dataset.dfxMode;
    if (meta) {
      meta.dataset.dfx ? meta.remove() : (meta.content = metaPrev);
    }
  }
}

const DiwaliTheme = {
  mount,
  unmount,
  play,
  hasSeenToday: hasSeenGreetingToday,
  triggerGreetingOnceToday: () => {
    if (!hasSeenGreetingToday()) {
      play(true);
      markGreetingSeenToday();
      return true;
    }
    return false;
  },
  resetDailyGreeting: () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(getDailyGreetingKey());
      }
    } catch (e) {}
  },
  setMode: (m) => on && setMode(m),
  isActive: () => on,
  burst: (x, y, n = 40) => on && burst(x, y, n),
};

if (typeof window !== "undefined") window.DiwaliTheme = DiwaliTheme;

export default DiwaliTheme;
