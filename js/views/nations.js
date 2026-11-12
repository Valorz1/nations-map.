/* NATIONS — the searchable, sortable index of every place on the map. */
import { R, MAX, caps, terr, isTop, isTerritory, isMovement } from "../model.js";
import { GOV, getPref, setPref } from "../store.js";
import { viewedMoment } from "../map/timeline.js";
import { esc, emblem, viewHead, flagHTML } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href } from "../ui/router.js";
import { mount, listMode } from "./common.js";

let sortKey = getPref("nationSort", "rate"), query = "", filter = "all";
const SORTS = [["rate", "Rate"], ["m", "Military"], ["e", "Economy"], ["caps", "Capitals"], ["name", "A–Z"]];
const FILTERS = [["all", "All"], ["nations", "Nations"], ["territories", "Territories"], ["movements", "Movements"]];

function sval(r) { return sortKey === "name" ? r.name : sortKey === "caps" ? caps(r).length : (r.stats?.[sortKey] ?? -1); }
const cmp = (a, b) => sortKey === "name" ? a.name.localeCompare(b.name) : (sval(b) - sval(a)) || a.name.localeCompare(b.name);

function rowHTML(r, lvl = 0) {
  const key = sortKey === "name" || sortKey === "caps" ? "rate" : sortKey, st = r.stats || {};
  const v = sortKey === "caps" ? (caps(r).length || null) : st[key];
  const mx = sortKey === "caps" ? Math.max(1, ...R.map(x => caps(x).length)) : MAX[key];
  const lbl = { rate: "R", m: "M", e: "E" }, others = ["rate", "m", "e"].filter(k => k !== key && st[k] != null).map(k => `${lbl[k]} ${st[k]}`).join(" · ");
  const nc = caps(r).length, tags = [GOV[r.id]?.gov, nc ? `${nc} capital${nc > 1 ? "s" : ""}` : null, r.tag, r.kind ? "Resistance" : null, r.of && !r.kind ? "Part of nation" : null].filter(Boolean);
  const unit = sortKey === "caps" ? "capitals" : { rate: "Rate", m: "Military", e: "Economy" }[key];
  return `<li><a class="lrow lv${lvl}" href="${href("nation", r.id)}" aria-label="${esc(r.name)}${v != null ? `, ${unit} ${v}` : ""}">
    ${emblem(r, lvl ? 22 : 28)}
    <div class="nm"><div class="t1"><span>${esc(r.name)}</span>${flagHTML(GOV[r.id]?.flag)}</div>${tags.length ? `<div class="t2">${tags.map(t => `<span class="tag-s">${esc(t)}</span>`).join("")}</div>` : ""}</div>
    <div class="rv${v == null ? " na" : ""}"><b>${v ?? "—"}</b>${others && sortKey !== "caps" ? `<small>${others}</small>` : ""}<div class="hbar"><i style="width:${v == null ? 0 : Math.round(v / mx * 100)}%"></i></div></div></a></li>`;
}

function listHTML() {
  const pass = r => filter === "all" || (filter === "nations" && isTop(r)) || (filter === "territories" && isTerritory(r)) || (filter === "movements" && isMovement(r));
  if (query || filter !== "all") {
    const q = query.toLowerCase();
    const hits = R.filter(r => pass(r) && (!q || r.name.toLowerCase().includes(q) || r.asWritten.toLowerCase().includes(q) || (GOV[r.id]?.leader || "").toLowerCase().includes(q) || (GOV[r.id]?.gov || "").toLowerCase().includes(q))).sort(cmp);
    return hits.length ? hits.map(r => rowHTML(r)).join("")
      : `<li class="noresult">${icon("search")}<span>No place matches “${esc(query)}”${filter !== "all" ? ` in ${filter}` : ""}.</span><button type="button" class="btn btn-sm" data-act="clear">Clear search</button></li>`;
  }
  const res = (id, l) => R.filter(x => x.in === id).map(x => rowHTML(x, l)).join("");
  return R.filter(r => !r.of && !r.kind).sort(cmp).map(r => rowHTML(r, 0) + res(r.id, 1) + terr(r.id).sort(cmp).map(t => rowHTML(t, 1) + res(t.id, 2)).join("")).join("");
}

function render(args, opts) {
  listMode(opts);
  const nations = R.filter(r => !r.of && !r.kind).length, nRes = R.filter(r => r.kind).length, past = viewedMoment();
  const html = viewHead({
    eyebrow: "Nations", ico: "flag", title: "All Nations",
    sub: `<span>${nations} nations and areas · ${R.length - nations - nRes} territories · ${nRes} resistance movements</span>${past ? `<span class="pill gold">${icon("history")}${esc(past.name)}</span>` : ""}`,
    tools: `<div class="searchbox">${icon("search")}<input id="q" class="input" type="search" placeholder="Find a nation, ruler or government" value="${esc(query)}" autocomplete="off" aria-label="Find a nation, ruler or government"></div>
      <div class="tools-row"><div class="seg" role="group" aria-label="Show">${FILTERS.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}</div>
      <div class="seg" role="group" aria-label="Sort by">${SORTS.map(([k, l]) => `<button type="button" data-sort="${k}" aria-pressed="${sortKey === k}" class="gold">${l}</button>`).join("")}</div></div>`,
  }) + `<div class="vb vb-tight"><ul class="rows" id="list">${listHTML()}</ul>
    <p class="foot-note">${icon("info", "i-xs")}Parts of a nation (like RUC or Shero U.) and resistance movements are listed under the nation they belong to. Tapping a part opens its nation's dossier.</p></div>`;
  mount(html, opts, { size: "std", sheetTo: "full" });
}

const relist = () => { document.getElementById("list").innerHTML = listHTML(); };
export const nationsView = {
  render,
  input(e) { if (e.target.id === "q") { query = e.target.value.trim(); relist(); return true; } },
  click(e) {
    const s = e.target.closest("[data-sort]"); if (s) { sortKey = s.dataset.sort; setPref("nationSort", sortKey); document.querySelectorAll("[data-sort]").forEach(b => b.setAttribute("aria-pressed", b === s)); relist(); return true; }
    const f = e.target.closest("[data-filter]"); if (f) { filter = f.dataset.filter; document.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", b === f)); relist(); return true; }
    if (e.target.closest('[data-act="clear"]')) { query = ""; filter = "all"; const q = document.getElementById("q"); q.value = ""; document.querySelectorAll("[data-filter]").forEach(b => b.setAttribute("aria-pressed", b.dataset.filter === "all")); relist(); q.focus(); return true; }
  },
};
