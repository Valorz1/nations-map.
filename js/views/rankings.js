/* RANKINGS — power rankings, leaderboards, infrastructure and comparisons. */
import { R, byId, MAX, METRICS, metric, rankOf, avgOf, caps, infra, topLevel, terr, neighbours, relationsOf, charsOf, isRated, sortedByName, isTerritory } from "../model.js";
import { GOV, getPref, setPref } from "../store.js";
import { curRel } from "../map/engine.js";
import { viewedMoment } from "../map/timeline.js";
import { esc, emblem, dot, viewHead, secHead, emptyState, tabsHTML, tabKeys, signed } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href, go, refresh } from "../ui/router.js";
import { mount, listMode } from "./common.js";

let tab = "overall", rankKey = getPref("rankKey", "rate"), q = "", dir = "desc", infraSort = { k: "infra", dir: "desc" }, withTerr = true;
let cmpA = null, cmpB = null;
const TABS = [["overall", "Overall", "trophy"], ["rate", "Rate", "star"], ["m", "Military", "shield"], ["e", "Economy", "trend"], ["infrastructure", "Infrastructure", "castle"], ["compare", "Compare", "scale"]];

const ratedRows = () => R.filter(isRated);
const matchQ = r => !q || r.name.toLowerCase().includes(q) || (GOV[r.id]?.gov || "").toLowerCase().includes(q);

function render(args, opts) {
  listMode(opts);
  const t = args[0];
  if (TABS.some(x => x[0] === t)) tab = t;
  const past = viewedMoment();
  const html = viewHead({
    eyebrow: "Rankings", ico: "trophy", title: "Power Rankings",
    sub: `<span>${ratedRows().length} rated nations</span>${past ? `<span class="pill gold">${icon("history")}${esc(past.name)}</span>` : ""}`,
    tabs: tabsHTML(TABS, tab, "Ranking views"),
  }) + `<div class="vb" id="tp-${tab}" role="tabpanel" aria-labelledby="tab-${tab}">${body()}</div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}
function body() {
  if (tab === "overall") return overall();
  if (tab === "infrastructure") return infrastructure();
  if (tab === "compare") return compare();
  return leaderboard(metric(tab));
}
const searchTools = (ph = "Filter nations") => `<div class="searchbox">${icon("search")}<input id="rq" class="input" type="search" placeholder="${ph}" value="${esc(q)}" aria-label="${ph}"></div>`;

/* ---- overall: the original power rankings (three bars on one shared scale) ---- */
function overall() {
  const rows = ratedRows().sort((a, b) => (b.stats[rankKey] ?? -1) - (a.stats[rankKey] ?? -1) || a.name.localeCompare(b.name));
  const mx = Math.max(1, ...rows.flatMap(r => METRICS.map(m => r.stats[m.k] || 0)));
  const shown = rows.map((r, i) => [r, i]).filter(([r]) => matchQ(r));
  return `<div class="tools-row">${searchTools()}<div class="seg" role="group" aria-label="Rank by"><span class="seg-label">Rank by</span>${METRICS.map(m => `<button type="button" data-rk="${m.k}" aria-pressed="${rankKey === m.k}"><span class="kd" style="background:${m.color}"></span>${m.label}</button>`).join("")}</div></div>
    <div class="legend-row">${METRICS.map(m => `<span><i style="background:${m.color}"></i>${m.long}</span>`).join("")}<span class="muted">All bars share one scale (0–${mx})</span></div>
    ${shown.length ? `<ol class="rank">${shown.map(([r, i]) => `<li><a class="rk" href="${href("nation", r.id)}">
      <div class="rkh"><span class="rn${i < 3 && r.stats[rankKey] != null ? " top t" + (i + 1) : ""}">${r.stats[rankKey] != null ? i + 1 : "–"}</span>${emblem(r, 24)}<span class="nm2">${esc(r.name)}</span>${GOV[r.id]?.gov ? `<span class="tag-s">${esc(GOV[r.id].gov)}</span>` : ""}</div>
      <div class="bars">${METRICS.map(m => { const v = r.stats[m.k]; return `<div class="b${m.k === rankKey ? " on" : ""}"><span>${m.label}</span><i><s style="width:${v == null ? 0 : v / mx * 100}%;background:${m.color}"></s></i><b>${v ?? "—"}</b></div>`; }).join("")}</div></a></li>`).join("")}</ol>`
      : emptyState(`No nation matches “${esc(q)}”.`)}`;
}

/* ---- single-metric leaderboard with podium ---- */
function leaderboard(m) {
  const rows = ratedRows().filter(r => r.stats[m.k] != null).sort((a, b) => b.stats[m.k] - a.stats[m.k] || a.name.localeCompare(b.name));
  const lead = rows[0]?.stats[m.k] ?? 0, avg = avgOf(m.k), list = dir === "desc" ? rows : [...rows].reverse();
  const unrated = ratedRows().filter(r => r.stats[m.k] == null);
  const podium = rows.slice(0, 3);
  const pod = podium.length === 3 ? `<div class="podium" aria-label="Top three by ${m.label}">${[1, 0, 2].map(i => { const r = podium[i]; return `<a class="pod p${i + 1}" href="${href("nation", r.id)}">
      ${emblem(r, i ? 40 : 52)}<b>${esc(r.name)}</b><span class="pod-v">${r.stats[m.k]}</span><span class="pod-step"><span>${i + 1}</span></span></a>`; }).join("")}</div>` : "";
  return `${pod}
    <div class="tools-row">${searchTools()}<button type="button" class="btn btn-sm" data-act="dir" aria-label="Reverse order">${icon("sort")}${dir === "desc" ? "Highest first" : "Lowest first"}</button></div>
    <div class="table-wrap"><table class="table lb"><caption class="sr-only">Nations ranked by ${m.long}</caption>
      <thead><tr><th class="num">#</th><th>Nation</th><th>${m.label}</th><th class="num">Value</th><th class="num">vs leader</th><th class="num">vs avg</th></tr></thead>
      <tbody>${list.filter(matchQ).map(r => { const v = r.stats[m.k], rk = rankOf(r, m.k); return `<tr data-href="${href("nation", r.id)}">
        <td class="num"><span class="rk-n${rk.rank <= 3 ? " t" + rk.rank : ""}">${rk.rank}</span></td>
        <td><div class="nm">${emblem(r, 22)}<a href="${href("nation", r.id)}">${esc(r.name)}</a></div></td>
        <td class="barcell"><div class="hbar" style="--sc:${m.color}"><i style="width:${(v / MAX[m.k] * 100).toFixed(1)}%"></i></div></td>
        <td class="num">${v}</td><td class="num muted">${v === lead ? "—" : signed(v - lead)}</td><td class="num ${v >= avg ? "pos" : "neg"}">${signed(Math.round(v - avg))}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="foot-note">${icon("info", "i-xs")}World average ${m.label.toLowerCase()} is ${avg.toFixed(1)}. Ties share a rank.${unrated.length ? ` Not rated: ${unrated.map(r => esc(r.name)).join(", ")}.` : ""}</p>`;
}

/* ---- capitals & infrastructure ---- */
function infrastructure() {
  const rows = R.filter(r => caps(r).length && (withTerr || !isTerritory(r))).filter(matchQ).map(r => ({ r, n: caps(r).length, infra: infra(r), top: topLevel(r), big: caps(r).filter(m => !m[3]).length }));
  const k = infraSort.k, s = infraSort.dir === "desc" ? -1 : 1;
  rows.sort((a, b) => k === "name" ? s * a.r.name.localeCompare(b.r.name) : (s * (a[k] - b[k])) || a.r.name.localeCompare(b.r.name));
  const mx = Math.max(1, ...rows.map(x => x.infra));
  const th = (key, label, num = true) => `<th class="${num ? "num" : ""}"${infraSort.k === key ? ` aria-sort="${infraSort.dir === "desc" ? "descending" : "ascending"}"` : ""}><button type="button" data-isort="${key}">${label}${infraSort.k === key ? icon("chev-down", "i-xs" + (infraSort.dir === "asc" ? " flip" : "")) : ""}</button></th>`;
  return `<div class="tools-row">${searchTools()}<label class="check"><input type="checkbox" class="switch" id="withTerr" ${withTerr ? "checked" : ""}><span>Include territories</span></label></div>
    <div class="table-wrap"><table class="table"><caption class="sr-only">Capitals and infrastructure by nation</caption>
      <thead><tr>${th("name", "Nation", false)}${th("n", "Capitals")}${th("infra", "Total infrastructure")}${th("top", "Highest level")}${th("big", "Large capitals")}</tr></thead>
      <tbody>${rows.map(x => `<tr data-href="${href("nation", x.r.id)}"><td><div class="nm">${emblem(x.r, 22)}<a href="${href("nation", x.r.id)}">${esc(x.r.name)}</a>${isTerritory(x.r) ? `<span class="tag-s">Territory</span>` : ""}</div></td>
        <td class="num">${x.n}</td><td class="num"><div class="numbar"><span class="hbar"><i style="width:${(x.infra / mx * 100).toFixed(1)}%"></i></span>${x.infra}</div></td><td class="num">${x.top}</td><td class="num">${x.big}</td></tr>`).join("")}</tbody></table></div>
    <p class="foot-note">${icon("info", "i-xs")}Infrastructure is the number inside each capital's circle on the map; totals add up every capital. “Large capitals” have the bigger circle, meaning a larger population. Destroyed cities aren't counted.</p>`;
}

/* ---- head-to-head comparison ---- */
function facts(r) {
  const rel = relationsOf(r.id, curRel);
  return { rate: r.stats?.rate, m: r.stats?.m, e: r.stats?.e, caps: caps(r).length, infra: infra(r), terr: terr(r.id).length, nb: neighbours(r.id).length, allies: rel.allies.length, wars: rel.wars.length, chars: charsOf(r.id).length };
}
const ROWS = [["rate", "Rate", "star", true], ["m", "Military", "shield", true], ["e", "Economy", "trend", true], ["caps", "Capitals", "castle"], ["infra", "Total infrastructure", "castle"], ["terr", "Territories", "pin"], ["nb", "Neighbours", "grid"], ["allies", "Allies", "link"], ["wars", "Wars", "swords"], ["chars", "Characters", "users"]];
function compare() {
  const pool = sortedByName(ratedRows());
  if (!cmpA || !byId[cmpA]) cmpA = pool[0]?.id;
  if (!cmpB || !byId[cmpB] || cmpB === cmpA) cmpB = ratedRows().sort((a, b) => (b.stats.rate ?? 0) - (a.stats.rate ?? 0)).find(r => r.id !== cmpA)?.id;
  const A = byId[cmpA], B = byId[cmpB];
  const sel = (id, v) => `<select id="${id}" class="select" aria-label="${id === "ca" ? "First" : "Second"} nation">${pool.map(r => `<option value="${r.id}"${r.id === v ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select>`;
  const fa = facts(A), fb = facts(B);
  let winsA = 0, winsB = 0;
  const rows = ROWS.map(([k, label, ico, core]) => {
    const a = fa[k], b = fb[k], mx = Math.max(1, a ?? 0, b ?? 0, core ? MAX[k] : 0);
    const better = a == null || b == null || a === b ? 0 : a > b ? 1 : -1;
    if (core && better === 1) winsA++; if (core && better === -1) winsB++;
    const diff = a != null && b != null ? a - b : null;
    return `<div class="cmp-row${core ? " core" : ""}"><div class="cmp-v a${better === 1 ? " win" : ""}">${a ?? "—"}</div>
      <div class="cmp-bar a"><i style="width:${a == null ? 0 : (a / mx * 100).toFixed(1)}%"></i></div>
      <div class="cmp-k">${icon(ico, "i-xs")}<span>${label}</span>${diff ? `<em>${signed(Math.abs(diff))}</em>` : ""}</div>
      <div class="cmp-bar b"><i style="width:${b == null ? 0 : (b / mx * 100).toFixed(1)}%"></i></div>
      <div class="cmp-v b${better === -1 ? " win" : ""}">${b ?? "—"}</div></div>`;
  }).join("");
  const side = (r, cls) => { const g = GOV[r.id] || {}, rk = rankOf(r, "rate"); return `<a class="cmp-side ${cls}" href="${href("nation", r.id)}">${emblem(r, 46)}<b>${esc(r.name)}</b><small>${[g.gov, g.leader].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</small>${rk ? `<span class="pill gold">#${rk.rank} by Rate</span>` : ""}</a>`; };
  const verdict = winsA === winsB ? `${esc(A.name)} and ${esc(B.name)} are evenly matched on the core ratings.`
    : `<b>${esc((winsA > winsB ? A : B).name)}</b> leads on ${Math.max(winsA, winsB)} of 3 core ratings.`;
  return `<div class="cmp-pick">${sel("ca", cmpA)}<button type="button" class="icon-btn" data-act="swap" aria-label="Swap nations" data-tip="Swap">${icon("swap")}</button>${sel("cb", cmpB)}</div>
    <div class="cmp card"><div class="cmp-head">${side(A, "a")}<span class="cmp-vs">vs</span>${side(B, "b")}</div>
      <div class="cmp-verdict">${icon("scale", "i-sm")}<span>${verdict}</span></div>
      <div class="cmp-rows" role="table" aria-label="Comparison of ${esc(A.name)} and ${esc(B.name)}">${rows}</div>
      <div class="legend-row cmp-legend"><span><i style="background:var(--c-a)"></i>${esc(A.name)}</span><span><i style="background:var(--c-b)"></i>${esc(B.name)}</span><span class="muted">Brighter value = higher. Ratings use the world's maximum as the scale.</span></div></div>`;
}

export const rankingsView = {
  render,
  click(e) {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; q = ""; go(tab === "compare" && cmpA ? `compare/${cmpA}/${cmpB}` : `rankings/${tab}`, { keepFocus: true }); setTimeout(() => document.getElementById("tab-" + tab)?.focus({ preventScroll: true })); return true; }
    const rk = e.target.closest("[data-rk]"); if (rk) { rankKey = rk.dataset.rk; setPref("rankKey", rankKey); refresh(); return true; }
    const is = e.target.closest("[data-isort]"); if (is) { const k = is.dataset.isort; infraSort = { k, dir: infraSort.k === k ? (infraSort.dir === "desc" ? "asc" : "desc") : (k === "name" ? "asc" : "desc") }; refresh(); return true; }
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "dir") { dir = dir === "desc" ? "asc" : "desc"; refresh(); return true; }
    if (a === "swap") { [cmpA, cmpB] = [cmpB, cmpA]; go(`compare/${cmpA}/${cmpB}`, { keepFocus: true }); return true; }
    const tr = e.target.closest("tr[data-href]"); if (tr && !e.target.closest("a")) { location.hash = tr.dataset.href.slice(1); return true; }
  },
  keydown(e) {
    if (tabKeys(e)) return true;
    const tr = e.target.closest("tr[data-href]"); if (tr && e.key === "Enter") { location.hash = tr.dataset.href.slice(1); return true; }
  },
  input(e) {
    if (e.target.id === "rq") { q = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; refresh(); const el = document.getElementById("rq"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } return true; }
  },
  change(e) {
    if (e.target.id === "ca" || e.target.id === "cb") { if (e.target.id === "ca") cmpA = e.target.value; else cmpB = e.target.value; if (cmpA === cmpB) { cmpB = ratedRows().find(r => r.id !== cmpA).id; } go(`compare/${cmpA}/${cmpB}`, { keepFocus: true }); return true; }
    if (e.target.id === "withTerr") { withTerr = e.target.checked; refresh(); return true; }
  },
};

/* #/compare/a/b — opens the Compare tab */
export const compareView = {
  ...rankingsView,
  render(args, opts) {
    if (args[0] && byId[args[0]]) cmpA = args[0];
    if (args[1] && byId[args[1]] && args[1] !== cmpA) cmpB = args[1]; else if (args[0] && !args[1]) cmpB = null;
    rankingsView.render(["compare"], opts);
  },
};
