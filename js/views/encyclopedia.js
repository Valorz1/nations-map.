/* ENCYCLOPEDIA — browse everything in the world by category, or search it all. */
import { byId } from "../model.js";
import { GOV } from "../store.js";
import { flyToPoint } from "../map/engine.js";
import { CATS, buildIndex, search } from "../search.js";
import { esc, emblem, viewHead, emptyState } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href, go } from "../ui/router.js";
import { mount, listMode } from "./common.js";

let cat = "all", q = "", focus = "";

function render(args, opts) {
  listMode(opts);
  if (args[0] && CATS.some(c => c.k === args[0])) cat = args[0];
  else if (!args[0]) cat = "all";
  focus = args[1] || "";
  const idx = buildIndex();
  const counts = Object.fromEntries(CATS.map(c => [c.k, c.k === "all" ? idx.length : idx.filter(e => e.cat === c.k).length]));
  const html = viewHead({
    eyebrow: "Encyclopedia", ico: "book", title: "Encyclopedia of the World",
    sub: `<span>${idx.length} entries across ${CATS.length - 1} categories</span>`,
    tools: `<div class="searchbox">${icon("search")}<input id="eq" class="input" type="search" placeholder="Search every entry: nations, people, wars, governments…" value="${esc(q)}" aria-label="Search the encyclopedia"></div>`,
  }) + `<div class="vb enc">
      <nav class="enc-cats" aria-label="Categories">${CATS.map(c => `<a href="${href("encyclopedia", c.k === "all" ? "" : c.k)}" class="enc-cat" ${cat === c.k ? 'aria-current="page"' : ""}>${icon(c.ico, "i-sm")}<span>${c.label}</span><em>${counts[c.k]}</em></a>`).join("")}</nav>
      <div class="enc-main" id="encMain">${results(idx)}</div></div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
  if (focus) document.getElementById("enc-focus")?.scrollIntoView({ block: "center" });
}

function entryCard(e) {
  const attrs = e.cap ? `data-capfly="${e.r.id},${e.cap[0]},${e.cap[1]}"` : "";
  return `<li><a class="enc-card" href="${e.href}" ${attrs}><span class="enc-art">${e.art}</span><span class="enc-t"><small>${esc(e.type)}</small><b>${esc(e.title)}</b><span>${esc(e.sub)}</span></span>${icon(e.cap ? "pin" : "chev-right", "i-sm enc-go")}</a></li>`;
}

function govArticle(e) {
  const isF = focus && focus.toLowerCase() === e.title.toLowerCase();
  return `<li><article class="enc-art-card card${isF ? " focused" : ""}" ${isF ? 'id="enc-focus"' : ""}><header>${icon("landmark")}<h3>${esc(e.title)}</h3><span class="muted">${e.list.length} ${e.list.length === 1 ? "nation" : "nations"}</span></header>
    <ul class="gov-list">${e.list.map(r => { const g = GOV[r.id]; return `<li><a href="${href("nation", r.id, "government")}">${emblem(r, 22)}<span><b>${esc(r.name)}</b><small>${g.leader ? "Ruled by " + esc(g.leader) : "Ruler not recorded"}</small></span></a></li>`; }).join("")}</ul></article></li>`;
}

function results(idx) {
  let list = q ? search(q, idx) : idx;
  if (cat !== "all") list = list.filter(e => e.cat === cat);
  if (!list.length) return emptyState(q ? `Nothing in ${cat === "all" ? "the encyclopedia" : CATS.find(c => c.k === cat).label.toLowerCase()} matches “${esc(q)}”.` : emptyHint(cat), { center: true, ico: q ? "search" : CATS.find(c => c.k === cat).ico, action: q ? `<button type="button" class="btn btn-sm" data-act="clear">Clear search</button>` : emptyAction(cat) });
  if (cat === "governments") return `<ul class="enc-articles">${list.map(govArticle).join("")}</ul>`;
  if (cat === "events") list = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (q || cat !== "all") return `<p class="enc-count">${list.length} ${list.length === 1 ? "entry" : "entries"}</p><ul class="enc-grid">${list.map(entryCard).join("")}</ul>`;
  // "Everything", browsing: A–Z with letter headings
  const groups = new Map();
  [...list].sort((a, b) => a.title.localeCompare(b.title)).forEach(e => { const L = /[a-z]/i.test(e.title[0]) ? e.title[0].toUpperCase() : "#"; if (!groups.has(L)) groups.set(L, []); groups.get(L).push(e); });
  const letters = [...groups.keys()];
  return `<nav class="az" aria-label="Jump to letter">${letters.map(L => `<a href="#" data-az="${L}">${L}</a>`).join("")}</nav>
    ${letters.map(L => `<section class="az-g" id="az-${L === "#" ? "num" : L}"><h3 class="az-h">${L}</h3><ul class="enc-grid">${groups.get(L).map(entryCard).join("")}</ul></section>`).join("")}`;
}
const emptyHint = c => ({ wars: "No wars have been recorded yet.", alliances: "No alliances have been recorded yet.", events: "No historical events yet. Save timeline moments, or add dates to wars and governments.", characters: "No characters yet.", governments: "No governments recorded yet." }[c] || "Nothing here yet.");
const emptyAction = c => ({ wars: `<a class="btn btn-sm" href="${href("diplomacy")}">Go to Diplomacy</a>`, alliances: `<a class="btn btn-sm" href="${href("diplomacy")}">Go to Diplomacy</a>`, events: `<a class="btn btn-sm" href="${href("history")}">Open the archive</a>`, characters: `<a class="btn btn-sm" href="${href("character", "new")}">Add a character</a>` }[c] || "");

export function openEntry(e, el) {
  if (el?.dataset.capfly) { e.preventDefault(); const [id, x, y] = el.dataset.capfly.split(","); go(`nation/${id}`, { fly: false }); flyToPoint(+x, +y); return true; }
  return false;
}

export const encyclopediaView = {
  render,
  input(e) { if (e.target.id === "eq") { q = e.target.value.trim(); document.getElementById("encMain").innerHTML = results(buildIndex()); return true; } },
  click(e) {
    const cf = e.target.closest("[data-capfly]"); if (cf) return openEntry(e, cf);
    const az = e.target.closest("[data-az]"); if (az) { e.preventDefault(); const L = az.dataset.az; document.getElementById("az-" + (L === "#" ? "num" : L))?.scrollIntoView({ block: "start", behavior: "smooth" }); return true; }
    if (e.target.closest('[data-act="clear"]')) { q = ""; const i = document.getElementById("eq"); i.value = ""; document.getElementById("encMain").innerHTML = results(buildIndex()); i.focus(); return true; }
  },
};
