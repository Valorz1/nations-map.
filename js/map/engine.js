/* ==========================================================================
   MAP ENGINE — draws the hand-drawn atlas and handles pan, zoom and selection.
   The drawing code is the original, unchanged: same geometry, layers, order,
   colours and interactions. Only the hooks out to the new interface are new.
   ========================================================================== */
import { GEO, R, byId, rankOf } from "../model.js";
import { BORDERS, GOV } from "../store.js";
import { sheetPx, mq } from "../ui/panel.js";
import { esc, emblem } from "../ui/dom.js";
import * as ed from "./editor.js";

export const X0 = 30, X1 = 1970, Y0 = 30, Y1 = 1384, PAD = 58;
const NS = "http://www.w3.org/2000/svg";
export const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(v * f)); return "rgb(" + c.join(",") + ")"; }
export const fmt = p => p[0] + "," + p[1];
export function ringPath(ring, arcs = GEO.arcs) { let pts = []; for (const i of ring) { const a = i >= 0 ? arcs[i] : [...arcs[~i]].reverse(); pts = pts.length ? pts.concat(a.slice(1)) : a.slice(); } return "M" + pts.map(fmt).join("L") + "Z"; }
export const regionD = (r, arcs) => GEO.geoms[r.id].map(g => ringPath(g, arcs)).join("") + (r.extra || []).map(p => "M" + p.map(fmt).join("L") + "Z").join("");

export let svg, ORIG_ARCS, selPath, gRegions, regionPath, borderEls, gRel, tip, wrapEl;
let defs, gL, gT;
export let curRel = [];
let highlighted = null;
const hooks = { select: () => {} };
export const setHooks = h => Object.assign(hooks, h);

export function buildMap() {
  ORIG_ARCS = GEO.arcs.map(a => a.map(p => p.slice()));
  for (const k in BORDERS) GEO.arcs[+k] = BORDERS[k];
  for (const r of R) { if (r.kind) { r.d = r.shapes.map(p => "M" + p.map(fmt).join("L") + "Z").join(""); continue; } r.d = regionD(r); }

  svg = document.getElementById("map");
  defs = el("defs", {}, svg);
  defs.innerHTML = `
<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .32  0 0 0 0 .28  0 0 0 .09 0"/></filter>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,255,255,.4)"/><line x1="0" y1="0" x2="0" y2="6" stroke="#3b4252" stroke-width="1.3"/></pattern>
<pattern id="xhatch" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fff"/><path d="M0,3H6M3,0V6" stroke="#3b4252" stroke-width=".9"/></pattern>
<pattern id="hatchLight" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="14" stroke="#b8b4aa" stroke-width="1"/></pattern>
<pattern id="stipple" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1.3" fill="#6f6a5f"/><circle cx="11" cy="11" r="1" fill="#6f6a5f"/><circle cx="12" cy="2" r=".7" fill="#6f6a5f"/></pattern>
<pattern id="resist" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="rgba(255,255,255,.55)"/><circle cx="4" cy="4" r="1.2" fill="#8a4058"/></pattern>
<pattern id="infect" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.6" fill="#4b5a2c"/><circle cx="15" cy="14" r="1.2" fill="#4b5a2c"/><circle cx="17" cy="4" r=".8" fill="#6d1f1f"/><circle cx="7" cy="17" r="2.2" fill="#5c6b36" opacity=".55"/><path d="M11,8l2,2M13,8l-2,2" stroke="#6d1f1f" stroke-width=".9"/></pattern>
<filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="frameClip"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath>`;

  el("rect", { x: X0 - PAD, y: Y0 - PAD, width: X1 - X0 + PAD * 2, height: Y1 - Y0 + PAD * 2, fill: "#f1efe8", rx: 4 }, svg);
  paperTexture(el("rect", { x: X0 - PAD, y: Y0 - PAD, width: X1 - X0 + PAD * 2, height: Y1 - Y0 + PAD * 2, fill: "none", rx: 4 }, svg));

  gRegions = el("g", {}, svg);
  regionPath = {};
  for (const r of R) {
    if (r.kind) continue;
    const id = "clip-" + r.id;
    const cp = el("clipPath", { id }, defs); r.els = [el("path", { d: r.d }, cp)];
    const g = el("g", { class: "region", "data-id": r.id, tabindex: 0, role: "button", "aria-label": r.name }, gRegions);
    regionPath[r.id] = el("path", { d: r.d, fill: r.fill, stroke: r.fill, "stroke-width": 1.2 }, g); r.els.push(regionPath[r.id]);
    if (r.pattern) r.els.push(el("path", { d: r.d, fill: `url(#${r.pattern})` }, g));
    const s1 = el("path", { d: r.d, fill: "none", stroke: shade(r.fill, .8), "stroke-width": 16, opacity: .22, "clip-path": `url(#${id})` }, g), s2 = el("path", { d: r.d, fill: "none", stroke: shade(r.fill, .8), "stroke-width": 8, opacity: .28, "clip-path": `url(#${id})` }, g);
    r.els.push(s1, s2);
    r.col = [[regionPath[r.id], "fill", r.fill], [regionPath[r.id], "stroke", r.fill], [s1, "stroke", shade(r.fill, .8)], [s2, "stroke", shade(r.fill, .8)]];
  }

  gRegions.appendChild(gRegions.querySelector('[data-id="marmite"]')); // islands sit above neighbours
  // features traced from the sketch
  const gFeat = el("g", { "pointer-events": "none", "clip-path": "url(#frameClip)" }, svg);
  const polyIn = (g, pts, a) => el("path", Object.assign({ d: "M" + pts.map(fmt).join("L") + "Z", "stroke-linejoin": "round" }, a), g);
  const poly = (pts, a) => el("path", Object.assign({ d: "M" + pts.map(fmt).join("L") + "Z", "stroke-linejoin": "round" }, a), gFeat);
  const F = GEO.feats;
  const H = { fill: "url(#hatch)", stroke: "#3b4252", "stroke-width": 1.3 };
  ["h_sher", "h_lib", "h_fm", "h_roy", "h_bal"].forEach(k => F[k] && poly(F[k][0], H));
  poly([[1070, 1209], [1083, 1188], [1148, 1172], [1150, 1203]], H);
  { const g = el("g", { class: "feat", "data-id": "teddy", "pointer-events": "visiblePainted", tabindex: 0, role: "button", "aria-label": "Teddy Resistance" }, gFeat); regionPath.teddy = g; polyIn(g, [[158.8, 755], [172.5, 761.3], [175, 770], [185, 778.8], [190, 787.5], [198.8, 793.8], [206.3, 800], [207.5, 808.8], [205, 818.8], [200, 830], [192.5, 831.3], [180, 825], [167.5, 816.3], [160, 811.3], [151.3, 815], [141.3, 813.8], [132.5, 808.8], [130, 796.3], [132.5, 783.8], [135, 772.5], [142.5, 767.5], [148.8, 761.3]], { fill: "url(#resist)", stroke: "#3b4252", "stroke-width": 1.5, "stroke-dasharray": "5 4" }); }

  poly(F.mr[0], { fill: "none", stroke: "#3b4252", "stroke-width": 1.6 }); poly(F.mr[0], { fill: "url(#hatchLight)", opacity: .7 });
  poly(F.ind[0], { fill: "url(#hatch)", stroke: "#3b4252", "stroke-width": 1.3, opacity: .85 });
  poly(F.mrr[0], { fill: "none", stroke: "#3b4252", "stroke-width": 1.6 }); poly(F.mrr[0], { fill: "url(#hatch)", opacity: .55 });
  const resist = { fill: "url(#resist)", stroke: "#5b2a3a", "stroke-width": 1.4 };
  {
    const g = el("g", { class: "feat", "data-id": "lego", "pointer-events": "visiblePainted", tabindex: 0, role: "button", "aria-label": "Lego Resistance" }, gFeat); regionPath.lego = g; polyIn(g, [[1542, 989], [1540, 1006], [1546, 1011], [1559, 1015], [1564, 1024], [1569, 1024], [1575, 1020], [1574, 1009], [1571, 1002], [1567, 1000], [1565, 992], [1561, 989], [1552, 986], [1544, 990]], resist);
    polyIn(g, [[1572, 1045], [1569, 1045], [1567, 1048], [1558, 1050], [1557, 1056], [1559, 1059], [1563, 1060], [1565, 1064], [1571, 1064], [1576, 1057], [1577, 1051], [1575, 1047]], resist);
    el("circle", { cx: 1556, cy: 1033, r: 2.6, fill: "#5b2a3a" }, g);
    { const t = el("text", { x: 1552, y: 1004, style: "font:600 11px 'IBM Plex Mono',monospace;fill:#3b2030", "text-anchor": "middle", "dominant-baseline": "central", "pointer-events": "none" }, g); t.textContent = "0"; }
    el("rect", { x: 1536, y: 982, width: 46, height: 86, fill: "transparent" }, g);
  }

  // borders = the traced pencil lines
  {
    const m = el("mask", { id: "islandMask", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 2000, height: 1414 }, defs);
    el("rect", { x: 0, y: 0, width: 2000, height: 1414, fill: "#fff" }, m);
    [GEO.feats.mr[0], GEO.feats.mrr[0], GEO.feats.ind[0]].forEach(p => el("path", { d: "M" + p.map(fmt).join("L") + "Z", fill: "#000", stroke: "#000", "stroke-width": 1 }, m));
  }
  const gB = el("g", { mask: "url(#islandMask)" }, svg);
  borderEls = {};
  for (const i of GEO.border) borderEls[i] = [el("path", { d: arcD(i), class: "border-under" }, gB)];
  for (const i of GEO.border) borderEls[i].push(el("path", { d: arcD(i), class: "border" }, gB));
  // junction dots drawn on the sketch
  [[800, 753], [1095, 771], [873, 1168], [1385, 982]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 4.5, fill: "#2c3240" }, gB));
  el("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: "none", stroke: "#2c3240", "stroke-width": 2.5 }, svg);
  el("rect", { x: X0 - 10, y: Y0 - 10, width: X1 - X0 + 20, height: Y1 - Y0 + 20, fill: "none", stroke: "#2c3240", "stroke-width": .8 }, svg);

  // grid reference
  const gG = el("g", { class: "grid" }, svg);
  const COLS = 10, ROWS = 7, cw = (X1 - X0) / COLS, rh = (Y1 - Y0) / ROWS;
  for (let i = 1; i < COLS; i++) el("line", { x1: X0 + i * cw, y1: Y0, x2: X0 + i * cw, y2: Y1 }, gG);
  for (let j = 1; j < ROWS; j++) el("line", { x1: X0, y1: Y0 + j * rh, x2: X1, y2: Y0 + j * rh }, gG);
  for (let i = 0; i < COLS; i++) { const x = X0 + (i + .5) * cw, t = "ABCDEFGHIJ"[i]; [Y0 - 32, Y1 + 32].forEach(y => { const e = el("text", { x, y, class: "gridlbl" }, gG); e.textContent = t; }); }
  for (let j = 0; j < ROWS; j++) { const y = Y0 + (j + .5) * rh; [X0 - 32, X1 + 32].forEach(x => { const e = el("text", { x, y, class: "gridlbl" }, gG); e.textContent = j + 1; }); }

  selPath = el("path", { class: "sel", d: "" }, svg);

  // compass rose in open Marbonese country
  const gDeco = el("g", { "pointer-events": "none" }, svg);
  gDeco.innerHTML = COMPASS;

  // labels, notes, rating tags, circled numbers
  gRel = el("g", { class: "rel" }, svg);
  gL = el("g", {}, svg);
  gT = el("g", {}, gL);
  drawTags();
  for (const r of R) { (r.notes || []).forEach(n => addText(n.cls === "sub" ? "lbl" : "note", n.x, n.y, n.t, n.cls === "sub" ? 17 : 14)); }
  addText("note", 160, 783, ["Teddy", "Resistance"], 10.5);
  addText("note", 1707, 374, ["Ind"], 13);
  [[338, 812], [850, 762], [918, 1022], [1340, 884], [1110, 1192], [50, 1092], [1707, 392]].forEach(([x, y]) => { const t = el("text", { x, y: y + (y > 1100 ? 22 : -2), class: "dis" }, gL); t.textContent = "DIS"; });
  addText("note", 1878, 215, ["Mr"], 15);
  addText("note", 1950, 320, ["M.R"], 12);
  for (const r of R) { (r.labels2 || []).forEach(L => addText("lbl", L.x, L.y, L.l, L.s)); addText("lbl", r.label.x, r.label.y, r.label.l, r.label.s); r.marks.forEach(m => mark(m[0], m[1], m[2], m[3], m[4], m[5])); }

  initView();
  initPointer();
  initTooltip();
}

/* The paper grain used to be a live feTurbulence filter over the whole map,
   recomputed on every pan/zoom frame (very slow on iPads). Render it once into
   a small tile and repeat it as a pattern instead; same noise, same look. */
function paperTexture(rect) {
  const S = 256, fallback = () => rect.setAttribute("filter", "url(#paper)");
  const src = `<svg xmlns="${NS}" width="${S}" height="${S}"><filter id="p" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .32  0 0 0 0 .28  0 0 0 .09 0"/></filter><rect width="${S}" height="${S}" filter="url(#p)"/></svg>`;
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = c.height = S; c.getContext("2d").drawImage(img, 0, 0);
      const pat = el("pattern", { id: "paperTex", width: S, height: S, patternUnits: "userSpaceOnUse" }, defs);
      el("image", { href: c.toDataURL("image/png"), width: S, height: S }, pat);
      rect.setAttribute("fill", "url(#paperTex)");
    } catch { fallback(); }
  };
  img.onerror = fallback;
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
}

/* colour equivalent of CSS `saturate(.35) brightness(1.06)`, used to dim the
   unselected regions without per-element filters (slow on iPad Safari) */
const dimCache = {};
function dimColor(c) {
  if (dimCache[c]) return dimCache[c];
  const v = c[0] === "#" ? (n => [n >> 16, n >> 8 & 255, n & 255])(parseInt(c.slice(1), 16)) : c.match(/\d+/g).map(Number);
  const s = .35, [r, g, b] = v;
  const o = [(.213 + .787 * s) * r + (.715 - .715 * s) * g + (.072 - .072 * s) * b,
    (.213 - .213 * s) * r + (.715 + .285 * s) * g + (.072 - .072 * s) * b,
    (.213 - .213 * s) * r + (.715 - .715 * s) * g + (.072 + .928 * s) * b].map(x => Math.max(0, Math.min(255, Math.round(x * 1.06))));
  return dimCache[c] = "rgb(" + o.join(",") + ")";
}

const arcD = i => "M" + GEO.arcs[i].map(fmt).join("L");

function addText(cls, x, y, lines, size) {
  const t = el("text", { class: cls, x, y, "font-size": size }, gL);
  lines.forEach((ln, i) => { const s = el("tspan", { x, dy: i ? size * 1.08 : -(lines.length - 1) * size * .54 }, t); s.textContent = ln; }); return t;
}
function tag(s) {
  if (s.rate == null && s.m == null && s.e == null) return;
  const g = el("g", { class: "tag", transform: `translate(${s.x},${s.y})` }, gT);
  const hasRate = s.rate != null, w = 124, h = hasRate ? 52 : 28;
  el("rect", { class: "o", x: -w / 2, y: -h / 2, width: w, height: h, rx: 2 }, g);
  if (hasRate) {
    el("line", { x1: -w / 2, y1: 0, x2: w / 2, y2: 0, stroke: "#2c3240", "stroke-width": .8 }, g);
    el("line", { x1: -6, y1: -h / 2, x2: -6, y2: 0, stroke: "#2c3240", "stroke-width": .8 }, g);
    const k = el("text", { class: "k", x: -w / 2 + 10, y: -8 }, g); k.textContent = "RATE";
    const v = el("text", { class: "v", x: w / 2 - 10, y: -7, "text-anchor": "end" }, g); v.textContent = s.rate;
  }
  const me = el("text", { class: "me", x: 0, y: hasRate ? 18 : 5, "text-anchor": "middle" }, g); me.textContent = `M ${s.m ?? "—"}   ·   E ${s.e ?? "—"}`;
}
function mark(n, x, y, small, hatched, slash) {
  const g = el("g", { class: "mk", transform: `translate(${x},${y})` }, gL); const r = small ? 11 : 17;
  el("circle", { r }, g); if (hatched) el("circle", { r, fill: "url(#xhatch)", stroke: "#2c3240", "stroke-width": 1.6 }, g);
  if (slash) { el("line", { x1: -r * .7, y1: r * .7, x2: r * .7, y2: -r * .7, stroke: "#2c3240", "stroke-width": 1.4 }, g); return; }
  const t = el("text", { style: small ? "font-size:11px" : "" }, g); t.textContent = n;
  if (hatched) { t.setAttribute("style", "paint-order:stroke;stroke:#fff;stroke-width:3px"); }
}
export function drawTags() { gT.innerHTML = ""; for (const r of R) if (r.stats) tag(r.stats); }

/* ============ PAN / ZOOM ============ */
const FULL = { x: X0 - PAD, y: Y0 - PAD, w: X1 - X0 + PAD * 2, h: Y1 - Y0 + PAD * 2 };
export const FULLBOX = { x: X0 - PAD, y: Y0 - PAD, width: X1 - X0 + PAD * 2, height: Y1 - Y0 + PAD * 2 };
export const vb = { ...FULL };
/* `vb` is the live view; `drawn` is what the SVG was last rendered at. While a
   finger is moving we only CSS-transform the already-rendered map (cheap, done
   by the GPU) and re-render the SVG once the gesture ends or pauses. */
const drawn = { ...FULL };
let liveRaf = 0, idleT = 0;
export function setVB() {
  cancelAnimationFrame(liveRaf); liveRaf = 0; clearTimeout(idleT);
  Object.assign(drawn, vb); svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); svg.style.transform = "";
}
function applyLive() {
  liveRaf = 0;
  const W = svg.clientWidth, H = svg.clientHeight, s0 = Math.min(W / drawn.w, H / drawn.h), k = drawn.w / vb.w;
  const tx = (W - drawn.w * s0) / 2 * (1 - k) + k * s0 * (drawn.x - vb.x), ty = (H - drawn.h * s0) / 2 * (1 - k) + k * s0 * (drawn.y - vb.y);
  svg.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
}
function liveVB() {
  if (!liveRaf) liveRaf = requestAnimationFrame(applyLive);
  clearTimeout(idleT); idleT = setTimeout(setVB, 200); // sharpen when the finger rests
}
const commitVB = () => { if (liveRaf || svg.style.transform) setVB(); };
/* screen -> map coordinates from the live view (valid mid-gesture, while the SVG is transformed) */
export function toSvg(cx, cy) {
  const r = svg.parentNode.getBoundingClientRect(), W = svg.clientWidth, H = svg.clientHeight, s = Math.min(W / vb.w, H / vb.h);
  return { x: vb.x + (cx - r.left - (W - vb.w * s) / 2) / s, y: vb.y + (cy - r.top - (H - vb.h * s) / 2) / s };
}
export function zoomAt(f, cx, cy, live = false) {
  const nw = Math.min(Math.max(vb.w * f, 220), FULL.w * 1.4); f = nw / vb.w;
  const p = toSvg(cx, cy); Object.assign(vb, { x: p.x - (p.x - vb.x) * f, y: p.y - (p.y - vb.y) * f, w: vb.w * f, h: vb.h * f }); live ? liveVB() : setVB();
}
let anim;
export function flyTo(t) {
  cancelAnimationFrame(anim); commitVB(); const s = { ...vb }, t0 = performance.now(), D = matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 420;
  // zooming into something already on screen: animate the rendered picture, redraw once at the end
  const zoomIn = t.x >= s.x - 1 && t.y >= s.y - 1 && t.x + t.w <= s.x + s.w + 1 && t.y + t.h <= s.y + s.h + 1 && Math.abs(t.w / t.h - s.w / s.h) < .01;
  const step = n => { const k = D ? Math.min(1, (n - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3); for (const q of ["x", "y", "w", "h"]) vb[q] = s[q] + (t[q] - s[q]) * e; if (k < 1) { zoomIn ? applyLive() : setVB(); anim = requestAnimationFrame(step); } else setVB(); }; anim = requestAnimationFrame(step);
}
export function fitView(b, pad) {
  const r = svg.getBoundingClientRect(), W = r.width, H = r.height, Hv = Math.max(120, H - sheetPx() - (mq.matches ? 8 : 0));
  const bw = Math.max(b.width * pad, pad > 1 ? 380 : 0), bh = Math.max(b.height * pad, pad > 1 ? 300 : 0), sc = Math.max(bw / W, bh / Hv);
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, F = FULLBOX, vw = W * sc, vh = Hv * sc; let x = cx - vw / 2, y = cy - vh / 2;
  if (vw <= F.width) x = Math.min(Math.max(x, F.x), F.x + F.width - vw); if (vh <= F.height) y = Math.min(Math.max(y, F.y), F.y + F.height - vh);
  return { x, y, w: vw, h: H * sc };
}
export const fitAll = () => flyTo(fitView(FULLBOX, 1));
export const resetView = () => { Object.assign(vb, fitView(FULLBOX, 1)); setVB(); };
export const flyToRegion = id => requestAnimationFrame(() => flyTo(fitView(regionPath[id].getBBox(), 1.5)));
export const flyToPoint = (x, y, size = 260) => flyTo(fitView({ x: x - size / 2, y: y - size / 2, width: size, height: size }, 1.5));
/* refit the whole map after the layout changes, unless a nation is in focus */
export const refitIfIdle = () => { if (!highlighted) resetView(); };

function initView() {
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); svg.style.transformOrigin = "0 0"; setVB();
  const ctr = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  document.getElementById("zIn").onclick = () => zoomAt(.7, ...ctr());
  document.getElementById("zOut").onclick = () => zoomAt(1 / .7, ...ctr());
  document.getElementById("zFit").onclick = () => flyTo(fitView(FULLBOX, 1));
}

/* ============ POINTER: drag to pan, pinch to zoom, tap to select ============ */
export const ptrs = new Map();
function initPointer() {
  let moved = 0, downRegion = null, pinch = null;
  svg.addEventListener("pointerdown", e => {
    svg.setPointerCapture(e.pointerId); if (!ptrs.size) cancelAnimationFrame(anim); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
    if (ed.editMode) { if (ptrs.size === 1 && ed.brushStart(e)) return; if (ptrs.size > 1) ed.brushEnd(true); }
    const g = e.target.closest(".region,.feat"); downRegion = ptrs.size === 1 && g ? g.dataset.id : null; svg.classList.add("dragging");
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  svg.addEventListener("pointermove", e => {
    if (ed.editMode) ed.brushCursor(e); if (!ptrs.has(e.pointerId)) return;
    if (ed.brush) { ed.brushMove(e); return; } const prev = ptrs.get(e.pointerId), cur = { x: e.clientX, y: e.clientY };
    if (ptrs.size === 1) {
      const sc = Math.max(vb.w / svg.clientWidth, vb.h / svg.clientHeight); vb.x -= (cur.x - prev.x) * sc; vb.y -= (cur.y - prev.y) * sc; liveVB();
    }
    moved += Math.hypot(cur.x - prev.x, cur.y - prev.y); ptrs.set(e.pointerId, cur);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) { zoomAt(pinch / dd, (a.x + b.x) / 2, (a.y + b.y) / 2, true); } pinch = dd; }
  });
  function up(e) {
    if (!ptrs.has(e.pointerId)) return; if (ed.brush) { ptrs.delete(e.pointerId); ed.brushEnd(false); svg.classList.remove("dragging"); return; } ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { svg.classList.remove("dragging"); commitVB(); if (moved < 7 && downRegion) hooks.select(downRegion, { fly: false }); downRegion = null; }
  }
  svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  svg.addEventListener("wheel", e => { e.preventDefault(); cancelAnimationFrame(anim); zoomAt(Math.exp(e.deltaY * .0015), e.clientX, e.clientY, true); }, { passive: false });
  svg.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.dataset.id) { e.preventDefault(); hooks.select(e.target.dataset.id, { fly: true }); } });
}

/* ============ SELECTION HIGHLIGHT (as in the original select()) ============ */
export function highlight(id, { withHost = true } = {}) {
  highlighted = id || null;
  const r = id && byId[id];
  selPath.setAttribute("d", r ? r.d : ""); svg.classList.toggle("focus", !!r);
  gRegions.querySelectorAll(".region").forEach(g => {
    const on = !!r && (g.dataset.id === id || (withHost && g.dataset.id === r.in)), reg = byId[g.dataset.id], dim = !!r && !on;
    g.classList.toggle("on", on);
    if (reg && reg.col && reg.dim !== dim) { reg.dim = dim; for (const [e, a, c] of reg.col) e.setAttribute(a, dim ? dimColor(c) : c); }
  });
}
export const highlightedId = () => highlighted;

/* ============ HOVER TOOLTIP (mouse only) ============ */
function initTooltip() {
  tip = document.getElementById("tip"); wrapEl = document.getElementById("wrap");
  let last = null;
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse" || ptrs.size || ed.editMode) { tip.style.display = "none"; return; }
    const g = e.target.closest(".region,.feat"); if (!g) { tip.style.display = "none"; last = null; return; }
    const r = byId[g.dataset.id];
    if (last !== r.id) { last = r.id; tip.innerHTML = tipHTML(r); }
    const w = wrapEl.getBoundingClientRect(); let x = e.clientX - w.left + 16, y = e.clientY - w.top + 16; tip.style.display = "block";
    if (x + tip.offsetWidth > w.width - 8) x -= tip.offsetWidth + 32; if (y + tip.offsetHeight > w.height - 8) y -= tip.offsetHeight + 32; tip.style.transform = `translate(${x}px,${y}px)`;
  });
  svg.addEventListener("pointerleave", () => { tip.style.display = "none"; last = null; });
}
export const hideTip = () => { if (tip) tip.style.display = "none"; };
function tipHTML(r) {
  const s = r.stats || {}, gv = GOV[r.id], rk = rankOf(r, "rate");
  const sub = [r.of ? `Territory of ${byId[r.of].name}` : r.kind ? `Resistance in ${byId[r.in].name}` : r.tag || null,
    gv && gv.gov ? gv.gov : null, gv && gv.leader ? "ruled by " + gv.leader : null, rk ? `#${rk.rank} of ${rk.of}` : null].filter(Boolean);
  const st = [["Rate", s.rate], ["Mil.", s.m], ["Econ.", s.e]].filter(([, v]) => v != null);
  return `<div class="tp-h">${emblem(r, 24)}<b>${esc(r.name)}</b></div>${sub.length ? `<span class="tp-sub">${sub.map(esc).join(" · ")}</span>` : ""}
    ${st.length ? `<div class="tp-stats">${st.map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join("")}</div>` : ""}<span class="tp-hint">Click to open the dossier</span>`;
}

/* ============ BORDER GEOMETRY UPDATES ============ */
export function redrawArcs(list) {
  const regs = new Set();
  for (const i of list) { if (borderEls[i]) borderEls[i].forEach(p => p.setAttribute("d", arcD(i))); (ed.arcOwners[i] || []).forEach(id => regs.add(id)); }
  for (const id of regs) { const r = byId[id]; r.d = regionD(r); r.els.forEach(p => p.setAttribute("d", r.d)); }
  if (highlighted && regs.has(highlighted)) selPath.setAttribute("d", byId[highlighted].d);
}
/* region outlines for an arbitrary set of arcs (used for timeline thumbnails) */
export function regionPathsFor(arcs) {
  return R.filter(r => !r.kind).map(r => ({ r, d: regionD(r, arcs) }));
}

/* ============ WARS & ALLIANCES on the map (drawing unchanged) ============ */
function anchor(id) { const r = byId[id]; return [r.label.x, r.label.y]; }
export function drawRel(list) {
  curRel = list; gRel.innerHTML = "";
  for (const rel of list) {
    if (!byId[rel.a] || !byId[rel.b] || rel.status === "ended") continue;
    const [x1, y1] = anchor(rel.a), [x2, y2] = anchor(rel.b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, k = Math.min(.22, 60 / L + .08);
    const cx = (x1 + x2) / 2 - dy * k, cy = (y1 + y2) / 2 + dx * k, mx = (x1 + 2 * cx + x2) / 4, my = (y1 + 2 * cy + y2) / 4, d = `M${x1},${y1}Q${cx},${cy} ${x2},${y2}`, w = rel.t === "war";
    const g = el("g", { class: "relg " + (w ? "war" : "ally") }, gRel);
    el("path", { d, class: "rl-u" }, g); el("path", { d, class: "rl" }, g);
    [[x1, y1], [x2, y2]].forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 6, class: "rl-end" }, g));
    el("circle", { cx: mx, cy: my, r: 12, class: "rl-mid" }, g);
    if (w) el("path", { d: `M${mx - 5},${my - 5}L${mx + 5},${my + 5}M${mx + 5},${my - 5}L${mx - 5},${my + 5}`, class: "rl-ico" }, g);
    else el("path", { d: `M${mx - 5.5},${my}L${mx + 5.5},${my}M${mx},${my - 5.5}L${mx},${my + 5.5}`, class: "rl-ico" }, g);
  }
}

/* ============ LAYERS ============ */
export const LAYERS = [["tStats", "hide-stats"], ["tMarks", "hide-marks"], ["tNotes", "hide-notes"], ["tRel", "hide-rel"], ["tGrid", "hide-grid"]];
export const setLayer = (cls, on) => svg.classList.toggle(cls, !on);


const COMPASS = `
<g transform="translate(640,610)" class="compass">
 <circle r="100" fill="rgba(255,253,247,.55)"/>
 <circle r="74" fill="none" stroke="#2c3240" stroke-width="1.4"/>
 <circle r="78" fill="none" stroke="#2c3240" stroke-width=".7"/>
 <path d="M0.0,-74.0L0.0,-65.0M6.4,-73.7L6.1,-70.2M12.8,-72.9L12.2,-69.4M19.2,-71.5L17.6,-65.7M25.3,-69.5L24.1,-66.2M31.3,-67.1L29.8,-63.9M37.0,-64.1L34.0,-58.9M42.4,-60.6L40.4,-57.8M47.6,-56.7L45.3,-54.0M52.3,-52.3L46.0,-46.0M56.7,-47.6L54.0,-45.3M60.6,-42.4L57.8,-40.4M64.1,-37.0L58.9,-34.0M67.1,-31.3L63.9,-29.8M69.5,-25.3L66.2,-24.1M71.5,-19.2L65.7,-17.6M72.9,-12.8L69.4,-12.2M73.7,-6.4L70.2,-6.1M74.0,-0.0L65.0,-0.0M73.7,6.4L70.2,6.1M72.9,12.8L69.4,12.2M71.5,19.2L65.7,17.6M69.5,25.3L66.2,24.1M67.1,31.3L63.9,29.8M64.1,37.0L58.9,34.0M60.6,42.4L57.8,40.4M56.7,47.6L54.0,45.3M52.3,52.3L46.0,46.0M47.6,56.7L45.3,54.0M42.4,60.6L40.4,57.8M37.0,64.1L34.0,58.9M31.3,67.1L29.8,63.9M25.3,69.5L24.1,66.2M19.2,71.5L17.6,65.7M12.8,72.9L12.2,69.4M6.4,73.7L6.1,70.2M0.0,74.0L0.0,65.0M-6.4,73.7L-6.1,70.2M-12.8,72.9L-12.2,69.4M-19.2,71.5L-17.6,65.7M-25.3,69.5L-24.1,66.2M-31.3,67.1L-29.8,63.9M-37.0,64.1L-34.0,58.9M-42.4,60.6L-40.4,57.8M-47.6,56.7L-45.3,54.0M-52.3,52.3L-46.0,46.0M-56.7,47.6L-54.0,45.3M-60.6,42.4L-57.8,40.4M-64.1,37.0L-58.9,34.0M-67.1,31.3L-63.9,29.8M-69.5,25.3L-66.2,24.1M-71.5,19.2L-65.7,17.6M-72.9,12.8L-69.4,12.2M-73.7,6.4L-70.2,6.1M-74.0,0.0L-65.0,0.0M-73.7,-6.4L-70.2,-6.1M-72.9,-12.8L-69.4,-12.2M-71.5,-19.2L-65.7,-17.6M-69.5,-25.3L-66.2,-24.1M-67.1,-31.3L-63.9,-29.8M-64.1,-37.0L-58.9,-34.0M-60.6,-42.4L-57.8,-40.4M-56.7,-47.6L-54.0,-45.3M-52.3,-52.3L-46.0,-46.0M-47.6,-56.7L-45.3,-54.0M-42.4,-60.6L-40.4,-57.8M-37.0,-64.1L-34.0,-58.9M-31.3,-67.1L-29.8,-63.9M-25.3,-69.5L-24.1,-66.2M-19.2,-71.5L-17.6,-65.7M-12.8,-72.9L-12.2,-69.4M-6.4,-73.7L-6.1,-70.2" stroke="#2c3240" stroke-width="1"/>
 <circle r="52" fill="none" stroke="#2c3240" stroke-width=".6" stroke-dasharray="1.5 3.5"/>
 <path d="M0,0L29.7,-29.7L5.7,5.7ZM0,0L29.7,29.7L-5.7,5.7ZM0,0L-29.7,29.7L-5.7,-5.7ZM0,0L-29.7,-29.7L5.7,-5.7Z" fill="#6b7384"/><path d="M0,0L29.7,-29.7L-5.7,-5.7ZM0,0L29.7,29.7L5.7,-5.7ZM0,0L-29.7,29.7L5.7,5.7ZM0,0L-29.7,-29.7L-5.7,5.7Z" fill="#fffdf7" stroke="#6b7384" stroke-width=".8"/>
 <path d="M0,0L0.0,-66.0L11.0,-0.0ZM0,0L66.0,-0.0L0.0,11.0ZM0,0L0.0,66.0L-11.0,0.0ZM0,0L-66.0,0.0L-0.0,-11.0Z" fill="#2c3240"/><path d="M0,0L0.0,-66.0L-11.0,-0.0ZM0,0L66.0,-0.0L0.0,-11.0ZM0,0L0.0,66.0L11.0,-0.0ZM0,0L-66.0,0.0L0.0,11.0Z" fill="#fffdf7" stroke="#2c3240" stroke-width=".9"/>
 <path d="M0,0L0.0,-66.0L11.0,-0.0Z" fill="#b0452f"/><path d="M0,0L0.0,-66.0L-11.0,-0.0Z" fill="#e8a08e" stroke="#b0452f" stroke-width=".9"/>
 <circle r="6" fill="#fffdf7" stroke="#2c3240" stroke-width="1.4"/><circle r="2" fill="#2c3240"/>
 <text x="0.0" y="-88.0" class="cr-l n">N</text><text x="88.0" y="-0.0" class="cr-l">E</text><text x="0.0" y="88.0" class="cr-l">S</text><text x="-88.0" y="0.0" class="cr-l">W</text>
</g>`;
