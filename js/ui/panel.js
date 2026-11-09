/* The information panel: docked on the right on desktop, a draggable bottom
   sheet on phones. Sheet snap points and drag behaviour are unchanged. */
import { getPref, setPref } from "../store.js";

export const mq = matchMedia("(max-width:760px)");
const SHEET = { min: .07, mini: .16, peek: .42, half: .62, full: .94 };
export let sheet = "peek";
let panel, onResize = () => {};
export const onPanelResize = fn => { onResize = fn; };

export function sheetPx() { return mq.matches ? panel.parentElement.clientHeight * SHEET[sheet] : 0; }
export function setSheet(s) {
  sheet = s;
  panel.style.setProperty("--sheet", Math.round(SHEET[s] * 100) + "%");
  document.documentElement.style.setProperty("--sheetpx", sheetPx() + "px");
}

export function setPanel(show) {
  document.body.classList.toggle("nopanel", !show);
  const t = document.getElementById("pToggle");
  t.setAttribute("aria-label", show ? "Hide panel" : "Show panel");
  t.dataset.tip = show ? "Hide panel" : "Show panel";
  setPref("panel", !!show);
  requestAnimationFrame(() => onResize());
}
export const panelShown = () => !document.body.classList.contains("nopanel");
export function ensurePanel() { if (!panelShown()) setPanel(true); }

export function setPanelSize(size) {
  if (panel.dataset.size === size) return;
  panel.dataset.size = size;
  if (!mq.matches) requestAnimationFrame(() => onResize());
}

export function initPanel() {
  panel = document.getElementById("panel");
  setSheet("peek");
  // drag the grab handle to resize the sheet; tap to step through sizes
  const g = document.getElementById("grab"); let y0 = null, h0 = 0, moved = 0;
  g.addEventListener("pointerdown", e => { y0 = e.clientY; h0 = panel.getBoundingClientRect().height; moved = 0; g.setPointerCapture(e.pointerId); panel.classList.add("drag"); });
  g.addEventListener("pointermove", e => {
    if (y0 == null) return; const H = panel.parentElement.clientHeight; moved = Math.max(moved, Math.abs(e.clientY - y0));
    panel.style.setProperty("--sheet", Math.min(.96, Math.max(.18, (h0 - (e.clientY - y0)) / H)) * 100 + "%");
  });
  const end = () => {
    if (y0 == null) return; panel.classList.remove("drag"); const H = panel.parentElement.clientHeight, f = panel.getBoundingClientRect().height / H; y0 = null;
    if (moved < 6) { setSheet({ min: "peek", mini: "peek", peek: "half", half: "full", full: "min" }[sheet]); return; }
    setSheet(Object.keys(SHEET).reduce((a, b) => Math.abs(SHEET[b] - f) < Math.abs(SHEET[a] - f) ? b : a));
  };
  g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);

  const t = document.getElementById("pToggle");
  t.onclick = () => setPanel(!panelShown());
  t.dataset.tip = "Hide panel";
  if (getPref("panel", true) === false && !mq.matches) setPanel(false);
  mq.addEventListener("change", () => setSheet(sheet));
}

