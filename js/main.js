/* ==========================================================================
   POLITICAL MAP OF THE NATIONS — application entry point.
   Loads the world, draws the map, then builds the interface around it.
   ========================================================================== */
import { load, status, onStatus, exportWorld, importWorld, revertToPublished, getPref, setPref } from "./store.js";
import { prepare } from "./model.js";
import { buildMap, setHooks, resetView, refitIfIdle, LAYERS, setLayer, svg, vb } from "./map/engine.js";
import { KM_PER_UNIT } from "./estimates.js";
import { warView } from "./views/war.js";
import { initEditor, toggleEdit, onEditChange } from "./map/editor.js";
import { VIEWS as MAP_VIEWS, initViews, setView, viewMode, refreshView } from "./map/views.js";
import { initTimeline, setTimeline, setTimelineHooks, tlOpen } from "./map/timeline.js";
import { initPanel, onPanelResize, mq, setSheet } from "./ui/panel.js";
import { register, initRouter, go, refresh, onRoute, route } from "./ui/router.js";
import { hydrateIcons, icon } from "./ui/icons.js";
import { initTooltips, toast, infoDialog } from "./ui/feedback.js";
import { initPalette, openPalette, closePalette, paletteOpen, setActions } from "./ui/palette.js";
import { esc, when } from "./ui/dom.js";
import { SECTIONS, sectionOf } from "./views/sections.js";
import { overview, overviewClick } from "./views/overview.js";
import { nationsView } from "./views/nations.js";
import { dossierView } from "./views/dossier.js";
import { rankingsView, compareView } from "./views/rankings.js";
import { charactersView, characterView } from "./views/characters.js";
import { diplomacyView } from "./views/diplomacy.js";
import { historyView } from "./views/history.js";
import { encyclopediaView } from "./views/encyclopedia.js";
import { legendHTML, terrainLegendHTML } from "./views/legend.js";

const VIEWS = {
  overview: { render: overview, click: overviewClick },
  nations: nationsView, nation: dossierView,
  rankings: rankingsView, compare: compareView,
  characters: charactersView, character: characterView,
  diplomacy: diplomacyView, history: historyView, encyclopedia: encyclopediaView, war: warView,
};
let active = VIEWS.overview;

async function boot() {
  hydrateIcons();
  try { await load(); }
  catch (err) { bootError(err); return; }
  prepare();
  initPanel();
  buildMap();
  initEditor();
  initTimeline();
  initViews();
  setHooks({ select: (id, o) => go(`nation/${id}`, o), view: drawScale });
  setTimelineHooks({ refresh: () => refresh(), archive: () => go("history") });
  onPanelResize(refitIfIdle);

  for (const [name, v] of Object.entries(VIEWS)) register(name, (args, opts) => { active = v; v.render(args, opts); });
  initShell();
  initWelcome();
  initRouter();
  requestAnimationFrame(() => { resetView(); document.body.classList.remove("booting"); });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(refitIfIdle, 150); });

  const flash = sessionStorage.getItem("nationsMap.flash");
  if (flash) { sessionStorage.removeItem("nationsMap.flash"); toast(flash); }
}

function bootError(err) {
  const b = document.getElementById("boot");
  const fileProto = location.protocol === "file:";
  b.classList.add("err");
  b.innerHTML = `<div class="boot-mark"><img src="assets/emblem.svg" alt="" width="56" height="56"></div>
    <div><b>The map couldn't be loaded</b>${fileProto
      ? `<p>Browsers don't let a page opened straight from a folder read its data files.<br>Open it through a small local server instead, for example run <code>python -m http.server</code> in this folder and visit <code>http://localhost:8000</code>.</p>`
      : `<p>${esc(err.message || err)}. Check your connection and reload the page.</p>`}</div>`;
  console.error(err);
}

/* ---------------- interface shell ---------------- */
function initShell() {
  // navigation (desktop bar + mobile drawer)
  document.getElementById("mainNav").innerHTML = SECTIONS.map(s => `<a class="nav-item" href="#/${s.k}" data-sec="${s.k}">${icon(s.ico)}<span>${s.label}</span></a>`).join("");
  document.getElementById("drawerNav").innerHTML = SECTIONS.map(s => `<a class="dnav" href="#/${s.k}" data-sec="${s.k}"><span class="dn-ic">${icon(s.ico)}</span><span><b>${s.label}</b><small>${s.desc}</small></span></a>`).join("");
  document.getElementById("drawerTools").innerHTML = [["views", "globe", "Map views"], ["time", "history", "Timeline"], ["edit", "pen", "Edit borders"], ["layers", "layers", "Layers"], ["key", "legend", "Map key"], ["search", "search", "Search"], ["data", "database", "Your data"]]
    .map(([k, ic, l]) => `<button type="button" data-tool="${k}" ${k === "time" || k === "edit" ? 'aria-pressed="false"' : ""}>${icon(ic)}${l}</button>`).join("");
  onRoute(r => {
    const sec = sectionOf(r.name);
    document.querySelectorAll("[data-sec]").forEach(a => { if (a.dataset.sec === sec) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const titles = { overview: "", nation: "Nation", character: "Character", compare: "Compare" };
    const s = SECTIONS.find(x => x.k === sec);
    document.title = (s && sec !== "overview" ? s.label + " · " : "") + "Political Map of the Nations";
    closeDrawer(false);
  });

  // drawer
  const drawer = document.getElementById("drawer"), navT = document.getElementById("navToggle");
  navT.onclick = () => { drawer.hidden = false; navT.setAttribute("aria-expanded", "true"); requestAnimationFrame(() => drawer.querySelector("[aria-current]")?.focus() || drawer.querySelector("a")?.focus()); };
  drawer.addEventListener("click", e => {
    if (e.target.closest("[data-close-drawer]")) { closeDrawer(); return; }
    const t = e.target.closest("[data-tool]"); if (!t) return;
    const k = t.dataset.tool;
    closeDrawer(false);
    if (k === "views") togglePop("views", true);
    if (k === "time") setTimeline(!tlOpen);
    if (k === "edit") toggleEdit();
    if (k === "layers") togglePop("layers", true);
    if (k === "key") togglePop("mapKey", true);
    if (k === "search") openPalette();
    if (k === "data") togglePop("dataPop", true);
  });

  // map rail
  document.getElementById("bView").onclick = e => { e.stopPropagation(); togglePop("views"); };
  const drawViews = () => { document.getElementById("views").innerHTML = `<p class="pop-title">Map view</p>${MAP_VIEWS.map(v => `<button type="button" class="view-opt" role="radio" aria-checked="${viewMode() === v.k}" data-view="${v.k}"><span class="vo-ic">${icon(v.ico)}</span><span><b>${v.label}</b><small>${v.desc}</small></span>${icon("check", "i-sm vo-ok")}</button>`).join("")}<p class="pop-note">The political map never changes. The other views are extra layers on top of it.</p>`; };
  drawViews();
  document.getElementById("views").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (!b) return; pickView(b.dataset.view); drawViews(); closePops(); });
  onRoute(() => refreshView());
  document.getElementById("bTime").onclick = () => setTimeline(!tlOpen);
  document.getElementById("bEdit").onclick = () => toggleEdit();
  document.getElementById("bLayers").onclick = e => { e.stopPropagation(); togglePop("layers"); };
  document.getElementById("bKey").onclick = e => { e.stopPropagation(); togglePop("mapKey"); };
  document.getElementById("mapKey").innerHTML = `<p class="pop-title">Map key</p>${legendHTML()}<p class="pop-title">Terrain view</p>${terrainLegendHTML()}`;
  onEditChange(() => { if (route.name === "history") refresh(); });

  // layers (remembered in this browser)
  const saved = getPref("layers", {});
  LAYERS.forEach(([id, cls]) => {
    const c = document.getElementById(id);
    if (saved[id] === false) { c.checked = false; setLayer(cls, false); }
    c.onchange = () => { setLayer(cls, c.checked); const l = getPref("layers", {}); l[id] = c.checked; setPref("layers", l); };
  });

  // data menu
  document.getElementById("dataBtn").onclick = e => { e.stopPropagation(); togglePop("dataPop"); };
  const imp = document.getElementById("importFile");
  imp.onchange = () => { if (imp.files[0]) importWorld(imp.files[0]); imp.value = ""; };
  document.getElementById("dataPop").addEventListener("click", e => {
    const a = e.target.closest("[data-data]")?.dataset.data; if (!a) return;
    closePops();
    if (a === "export") exportWorld();
    if (a === "import") imp.click();
    if (a === "revert") revertToPublished();
  });
  const drawData = () => {
    const local = status.source === "local";
    document.querySelector(".data-dot").hidden = !local;
    document.getElementById("dataPop").innerHTML = `<p class="pop-title">Your data</p>
      <div class="data-status ${local ? "local" : ""}">${icon(status.storage ? (local ? "check" : "globe") : "alert")}<div><b>${!status.storage ? "Changes can't be saved in this browser" : local ? "Your changes are saved in this browser" : "Showing the published world"}</b>
        <small>${!status.storage ? "Storage is blocked or full. Export to keep your work." : local ? `Last saved ${esc(when(status.savedAt))}. Export to publish them.` : "Edits you make are saved automatically in this browser."}</small></div></div>
      <div class="data-acts">
        <button type="button" class="btn btn-sm" data-data="export">${icon("download")}Export world.json</button>
        <button type="button" class="btn btn-sm" data-data="import">${icon("upload")}Import…</button>
        ${local ? `<button type="button" class="btn btn-sm btn-danger-ghost" data-data="revert">${icon("undo")}Discard my changes</button>` : ""}
      </div>
      <p class="data-help">To publish, replace <code>data/world.json</code> in the project with the exported file.</p>`;
  };
  drawData(); onStatus(drawData);

  // search
  initPalette();
  document.getElementById("searchBtn").onclick = () => openPalette();
  setActions([
    { title: "Open the timeline", sub: "Slide between saved moments", ico: "history", run: () => setTimeline(true) },
    { title: "Edit borders", sub: "Drag any border to reshape nations", ico: "pen", run: () => toggleEdit() },
    ...MAP_VIEWS.map(v => ({ title: `Map view: ${v.label}`, sub: v.desc, ico: v.ico, run: () => { pickView(v.k); drawViews(); } })),
    { title: "Show the whole map", sub: "Zoom out to fit", ico: "maximize", run: () => document.getElementById("zFit").click() },
    { title: "Map layers", sub: "Ratings, capitals, notes, wars, grid", ico: "layers", run: () => togglePop("layers", true) },
    { title: "Map key", sub: "What the symbols mean", ico: "legend", run: () => togglePop("mapKey", true) },
    { title: "Compare two nations", sub: "Side by side", ico: "scale", run: () => go("rankings/compare") },
    { title: "War simulator", sub: "Who would win? A what-if that changes nothing", ico: "swords", run: () => go("war") },
    { title: "Population & GDP table", sub: "Estimated from the map", ico: "users", run: () => go("rankings/people") },
    { title: "Add a character", sub: "With a portrait and biography", ico: "users", run: () => go("character/new") },
    { title: "Export world.json", sub: "Download your world to publish it", ico: "download", run: () => exportWorld() },
    { title: "Keyboard shortcuts", sub: "Move around faster", ico: "keyboard", run: () => shortcuts() },
  ]);

  // close popovers on outside click / Escape
  document.addEventListener("click", e => { if (!e.target.closest(".pop,#bLayers,#bKey,#bView,#dataBtn,[data-tool]")) closePops(); });

  // keyboard shortcuts
  document.addEventListener("keydown", e => {
    const typing = e.target.closest("input,textarea,select,[contenteditable]");
    if (e.key === "Escape") {
      if (paletteOpen()) return;
      if (!document.getElementById("drawer").hidden) { closeDrawer(); return; }
      if (document.querySelector(".pop:not([hidden])")) { closePops(true); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); paletteOpen() ? closePalette() : openPalette(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); return; }
    if (e.key === "?") { e.preventDefault(); shortcuts(); return; }
    const s = SECTIONS.find(x => x.key === e.key); if (s) { go(s.k); return; }
    if (e.key === "t") { setTimeline(!tlOpen); return; }
    if (e.key === "l") { togglePop("layers"); return; }
  });

  // panel event delegation → the active view
  const pb = document.getElementById("pb");
  for (const type of ["click", "input", "change", "submit", "keydown"]) {
    pb.addEventListener(type, e => {
      if (type === "submit") e.preventDefault();
      const h = active[type]; if (h && h(e)) return;
      if (type === "keydown" && (e.key === "Enter" || e.key === " ")) {
        const row = e.target.closest("[data-href]"); if (row && !e.target.closest("a,button,input,select,textarea")) { e.preventDefault(); location.hash = row.dataset.href.slice(1); }
      }
    });
  }
  initTooltips();
}

/* the scale bar under the map: 1 map unit = 2 km */
function drawScale() {
  const bar = document.getElementById("scaleBar"); if (!bar || !svg.clientWidth) return;
  const kmPerPx = KM_PER_UNIT / Math.min(svg.clientWidth / vb.w, svg.clientHeight / vb.h);
  const km = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(k => k / kmPerPx >= 64) || 5000;
  bar.firstElementChild.style.width = Math.round(km / kmPerPx) + "px"; bar.lastElementChild.textContent = km.toLocaleString("en-US") + " km";
}

/* switch the map view (political, terrain, population, wealth, military) */
function pickView(k) {
  if (k === viewMode()) return;
  setView(k);
  const v = MAP_VIEWS.find(x => x.k === k);
  toast(v.label + " view", { kind: "info", sub: k === "political" ? "The original map." : v.desc + ". Open Views to switch back." });
}

/* welcome page: shown once per visit, when the site is opened at its front page */
function initWelcome() {
  const w = document.getElementById("welcome"), front = !location.hash || /^#\/?(overview)?$/.test(location.hash);
  let seen = false; try { seen = sessionStorage.getItem("nationsMap.welcomed") === "1"; } catch {}
  if (!front || seen) return;
  hydrateIcons(w);
  w.hidden = false; document.body.classList.add("welcoming");
  const close = () => {
    if (w.hidden) return;
    try { sessionStorage.setItem("nationsMap.welcomed", "1"); } catch {}
    w.classList.add("out"); document.body.classList.remove("welcoming");
    setTimeout(() => { w.hidden = true; }, 420);
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = e => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);
  document.getElementById("wcEnter").onclick = close;
  document.getElementById("wcNations").onclick = close;
  requestAnimationFrame(() => document.getElementById("wcEnter").focus({ preventScroll: true }));
}

function togglePop(id, forceOpen) {
  const pop = document.getElementById(id), open = forceOpen || pop.hidden;
  closePops();
  if (!open) return;
  pop.hidden = false;
  const btn = { layers: "bLayers", mapKey: "bKey", views: "bView", dataPop: "dataBtn" }[id];
  document.getElementById(btn)?.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => pop.querySelector("input,button,a")?.focus({ preventScroll: true }));
}
function closePops(restore) {
  document.querySelectorAll(".pop:not([hidden])").forEach(p => {
    p.hidden = true;
    const btn = document.getElementById({ layers: "bLayers", mapKey: "bKey", views: "bView", dataPop: "dataBtn" }[p.id]);
    btn?.setAttribute("aria-expanded", "false"); if (restore) btn?.focus();
  });
}
function closeDrawer(restore = true) {
  const d = document.getElementById("drawer"); if (d.hidden) return;
  d.hidden = true; const t = document.getElementById("navToggle"); t.setAttribute("aria-expanded", "false"); if (restore) t.focus();
}
function shortcuts() {
  const rows = [["/", "Search everything"], ["Ctrl K", "Search everything"], ["1 – 7", "Go to a section"], ["T", "Open or close the timeline"], ["L", "Map layers"], ["Esc", "Close menus and dialogs"], ["Enter", "Open the focused nation on the map"], ["?", "Show this list"]];
  infoDialog("Keyboard shortcuts", `<div class="kbd-list">${rows.map(([k, d]) => `<span>${k.split(" ").map(x => `<kbd>${x}</kbd>`).join("")}</span><span>${d}</span>`).join("")}</div>`, "keyboard");
}

boot();
