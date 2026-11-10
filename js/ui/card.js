/* NATION CARD — a one-page summary of a nation that can be saved as a picture
   or printed. The card is a single self-contained SVG (no web fonts, no
   outside files) so the saved image looks the same as the one on screen. */
import { byId, caps, terr, kindLabel, rankOf, capName } from "../model.js";
import { GOV } from "../store.js";
import { regionPath } from "../map/engine.js";
import { LAND_TYPES } from "../map/geography.js";
import { estimate, resourcesOf, tradeDeals, short, money, whole, pct } from "../estimates.js";
import { emblem, esc } from "./dom.js";
import { icon } from "./icons.js";
import { toast } from "./feedback.js";

const W = 720, INK = "#1f2430", SOFT = "#5d6577", GOLD = "#8a6414", LINE = "#2c3240";
const SERIF = "Georgia, 'Times New Roman', serif", MONO = "'Courier New', Courier, monospace", SANS = "Arial, Helvetica, sans-serif";

function wrap(text, max) { const out = []; let line = ""; for (const w of String(text).split(/\s+/)) { if ((line + " " + w).trim().length > max) { out.push(line); line = w; } else line = (line + " " + w).trim(); } if (line) out.push(line); return out; }

export function cardSVG(r, landText = "") {
  const g = GOV[r.id] || {}, x = estimate(r), s = r.stats || {}, rk = rankOf(r, "rate");
  let y = 0, body = "";
  const T = (tx, ty, str, a = "") => { body += `<text x="${tx}" y="${ty}" ${a}>${esc(str)}</text>`; };
  const head = str => { y += 34; T(48, y, str.toUpperCase(), `font-family="${SANS}" font-size="11" font-weight="700" letter-spacing="2.4" fill="${GOLD}"`); body += `<path d="M${52 + str.length * 9.4},${y - 4}H672" stroke="${LINE}" stroke-opacity=".25"/>`; y += 8; };

  // header
  body += emblem(r, 78).replace('<svg class="emblem"', '<svg x="48" y="44"');
  const fs = Math.min(30, 500 / (r.name.length * .6));
  T(146, 82, r.name, `font-family="${SERIF}" font-size="${fs.toFixed(1)}" font-weight="700" letter-spacing="1" fill="${INK}"`);
  T(146, 108, [kindLabel(r), g.gov, rk && `#${rk.rank} of ${rk.of} by Rate`].filter(Boolean).join("  ·  ").toUpperCase(), `font-family="${SANS}" font-size="11" letter-spacing="1.8" fill="${GOLD}"`);
  T(146, 130, g.leader ? `Ruled by ${g.leader}` : r.of ? `Territory of ${byId[r.of].name}` : "", `font-family="${SERIF}" font-size="15" font-style="italic" fill="${SOFT}"`);
  body += `<path d="M48,154H672" stroke="${LINE}" stroke-width="1.2"/>`;

  // ratings (left) and the nation's shape (right)
  [["Rate", s.rate], ["Military", s.m], ["Economy", s.e]].forEach(([k, v], i) => {
    const bx = 48 + i * 120; body += `<rect x="${bx}" y="172" width="110" height="66" rx="5" fill="#fffdf4" stroke="${LINE}" stroke-width="1.1"/>`;
    T(bx + 55, 192, k.toUpperCase(), `text-anchor="middle" font-family="${SANS}" font-size="10" letter-spacing="1.6" fill="${SOFT}"`);
    T(bx + 55, 226, v ?? "—", `text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" fill="${INK}"`);
  });
  const facts = x ? [["Population", short(x.pop)], ["Economy (GDP)", money(x.gdp)], ["Income per person", x.perHead == null ? "—" : "$" + whole(x.perHead)], ["Land", short(x.km2) + " km²"], ["Army", x.troops == null ? "—" : short(x.troops)], ["Capitals", String(caps(r).length)]] : [];
  facts.forEach(([k, v], i) => { const fx = 48 + (i % 2) * 180, fy = 266 + Math.floor(i / 2) * 50; T(fx, fy, k.toUpperCase(), `font-family="${SANS}" font-size="10" letter-spacing="1.4" fill="${SOFT}"`); T(fx, fy + 24, v, `font-family="${MONO}" font-size="20" font-weight="700" fill="${INK}"`); });
  body += `<rect x="424" y="172" width="248" height="232" rx="5" fill="#ece5cd" stroke="${LINE}" stroke-width="1.1"/>`;
  try {
    const shapes = [r, ...terr(r.id)].filter(q => regionPath[q.id] && q.d), bbs = shapes.map(q => regionPath[q.id].getBBox());
    const x0 = Math.min(...bbs.map(b => b.x)), y0 = Math.min(...bbs.map(b => b.y)), x1 = Math.max(...bbs.map(b => b.x + b.width)), y1 = Math.max(...bbs.map(b => b.y + b.height));
    const k = Math.min(220 / (x1 - x0), 204 / (y1 - y0)), ox = 424 + (248 - (x1 - x0) * k) / 2 - x0 * k, oy = 172 + (232 - (y1 - y0) * k) / 2 - y0 * k;
    body += `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${k.toFixed(4)})">${shapes.map(q => `<path d="${q.d}" fill="${q.fill}" stroke="${LINE}" stroke-width="${(1.4 / k).toFixed(2)}" stroke-linejoin="round"${q === r ? "" : ' fill-opacity=".6"'}/>`).join("")}
      ${caps(r).map(m => `<circle cx="${m[1]}" cy="${m[2]}" r="${((m[3] ? 3 : 4.5) / k).toFixed(1)}" fill="#fff" stroke="${LINE}" stroke-width="${(1.2 / k).toFixed(2)}"/>`).join("")}</g>`;
  } catch (e) { /* shape not available: leave the box empty */ }
  y = 404;

  if (x) {
    // land
    head("Land");
    const total = Object.values(x.land).reduce((a, b) => a + b, 0) || 1, parts = LAND_TYPES.map(([k, label, c]) => ({ label, c, f: x.land[k] / total })).filter(p => p.f > .005).sort((a, b) => b.f - a.f);
    let bx = 48; y += 8;
    for (const p of parts) { const w = p.f * 624; body += `<rect x="${bx.toFixed(1)}" y="${y}" width="${Math.max(.5, w).toFixed(1)}" height="16" fill="${p.c}" stroke="${LINE}" stroke-width=".7"/>`; bx += w; }
    y += 36;
    parts.forEach((p, i) => { const lx = 48 + (i % 4) * 158, ly = y + Math.floor(i / 4) * 20; body += `<rect x="${lx}" y="${ly - 10}" width="11" height="11" fill="${p.c}" stroke="${LINE}" stroke-width=".7"/>`; T(lx + 17, ly, `${p.label} ${pct(p.f)}`, `font-family="${SANS}" font-size="12" fill="${INK}"`); });
    y += Math.floor((parts.length - 1) / 4) * 20 + 4;
    if (landText) { y += 8; for (const ln of wrap(landText, 92)) { y += 19; T(48, y, ln, `font-family="${SERIF}" font-size="14" font-style="italic" fill="${SOFT}"`); } }

    // resources and trade
    const res = resourcesOf(r).slice(0, 4);
    if (res.length) {
      head("Resources");
      const mx = Math.max(...res.map(q => q.share));
      for (const q of res) { y += 24; T(48, y, q.res.label, `font-family="${SANS}" font-size="13" font-weight="700" fill="${INK}"`); body += `<rect x="160" y="${y - 11}" width="300" height="11" rx="3" fill="#e4dcc2"/><rect x="160" y="${y - 11}" width="${(q.share / mx * 300).toFixed(1)}" height="11" rx="3" fill="${q.res.color}"/>`; T(474, y, `${pct(q.share)} of the world's supply`, `font-family="${SANS}" font-size="12" fill="${SOFT}"`); }
      const deals = tradeDeals(r);
      if (deals.length) { y += 10; for (const ln of wrap("Trades with " + deals.map(d => byId[d.id].name + (d.open ? "" : " (closed by war)")).join(", ") + ".", 92)) { y += 19; T(48, y, ln, `font-family="${SERIF}" font-size="14" fill="${INK}"`); } }
    }
  }
  // capitals
  const cs = r.marks.map((m, i) => ({ m, i })).filter(c => !c.m[5]);
  if (cs.length) {
    head("Capitals");
    cs.slice(0, 6).forEach(({ m, i }, n) => { y += 24; body += `<circle cx="58" cy="${y - 5}" r="${m[3] ? 7 : 10}" fill="#fff" stroke="${LINE}" stroke-width="1.2"/>`; T(58, y - 1, m[0], `text-anchor="middle" font-family="${MONO}" font-size="${m[3] ? 9 : 11}" font-weight="700" fill="${INK}"`); T(80, y, capName(r, i) || (cs.length > 1 ? `Capital ${n + 1}` : "Capital"), `font-family="${SERIF}" font-size="15" font-weight="700" fill="${INK}"`); T(672, y, `infrastructure ${m[0]} · ${m[3] ? "smaller" : "large"} population`, `text-anchor="end" font-family="${SANS}" font-size="12" fill="${SOFT}"`); });
  }
  y += 44;
  T(W / 2, y, "POLITICAL MAP OF THE NATIONS  ·  figures are estimates worked out from the map", `text-anchor="middle" font-family="${SANS}" font-size="10" letter-spacing="1.4" fill="${SOFT}"`);
  const H = y + 34;
  return { w: W, h: H, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f6f0dc"/><rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${LINE}" stroke-width="2.2"/><rect x="22" y="22" width="${W - 44}" height="${H - 44}" fill="none" stroke="${LINE}" stroke-width=".8"/>${body}</svg>` };
}

export function openCard(r, landText) {
  document.getElementById("cardOverlay")?.remove();
  const card = cardSVG(r, landText), o = document.createElement("div");
  o.id = "cardOverlay"; o.className = "card-overlay"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", `${r.name} nation card`);
  o.innerHTML = `<div class="card-acts"><button type="button" class="btn btn-primary" data-card="save">${icon("download")}Save as picture</button><button type="button" class="btn" data-card="print">${icon("scroll")}Print</button><span style="flex:1"></span><button type="button" class="btn" data-card="close">${icon("x")}Close</button></div>
    <div class="card-paper">${card.svg}</div>`;
  document.body.appendChild(o);
  const close = () => { o.remove(); document.removeEventListener("keydown", onKey, true); document.body.classList.remove("print-card"); };
  const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);
  o.addEventListener("click", e => {
    const a = e.target.closest("[data-card]")?.dataset.card;
    if (a === "close" || e.target === o) close();
    if (a === "print") { document.body.classList.add("print-card"); window.print(); setTimeout(() => document.body.classList.remove("print-card"), 800); }
    if (a === "save") savePNG(card, r.name);
  });
  o.querySelector("[data-card='save']").focus();
}

function savePNG(card, name) {
  const url = URL.createObjectURL(new Blob([card.svg], { type: "image/svg+xml;charset=utf-8" })), img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = card.w * 2; c.height = card.h * 2; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => { if (!b) return fail(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + "-card.png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Card saved", { sub: "Look in your downloads or Files" }); }, "image/png");
    } catch (e) { fail(); }
  };
  const fail = () => toast("Couldn't save the picture", { sub: "Use Print instead, or take a screenshot", kind: "err" });
  img.onerror = fail; img.src = url;
}
