/* Shared view plumbing: mounting into the panel, map focus, sheet behaviour. */
import { ensurePanel, setPanelSize, setSheet, mq, sheet } from "../ui/panel.js";
import { highlight, highlightedId, fitAll } from "../map/engine.js";
import { hydrateIcons } from "../ui/icons.js";

const pb = () => document.getElementById("pb");
const panelEl = () => document.getElementById("panel");

/* Render a view's HTML into the panel. */
export function mount(html, opts = {}, { size = "std", sheetTo } = {}) {
  ensurePanel(); setPanelSize(size);
  const p = panelEl(), b = pb(), st = p.scrollTop;
  b.innerHTML = html; hydrateIcons(b);
  if (opts.same) { p.scrollTop = st; }
  else {
    p.scrollTop = 0;
    b.classList.remove("enter"); void b.offsetWidth; b.classList.add("enter");
    if (!opts.initial && !opts.keepFocus) { const h = b.querySelector(".vh-title"); if (h && !mq.matches) h.focus({ preventScroll: true }); }
  }
  if (mq.matches && sheetTo && !opts.same && !opts.initial) setSheet(sheetTo);
}

/* List-style views clear the map selection; leaving a focused nation zooms back out. */
export function listMode(opts) {
  const was = highlightedId(); highlight(null);
  if (was && !opts.same && !opts.initial) fitAll();
}

/* Keep a mobile sheet sensible after selecting from a list (original behaviour). */
export function nationSheet(opts) { if (mq.matches && (opts.fromList || sheet === "full")) setSheet("peek"); }

/* Common keyboard support inside the panel: Enter/Space activates [data-key-activate] rows */
export function activateOnKey(e) {
  if (e.key !== "Enter" && e.key !== " ") return false;
  const row = e.target.closest("[data-href]");
  if (!row || e.target.closest("a,button,input,select,textarea")) return false;
  e.preventDefault(); location.hash = row.dataset.href.replace(/^#/, ""); return true;
}
