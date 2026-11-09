/* ==========================================================================
   BORDER EDITOR — drag any border with a soft brush; both neighbours follow.
   Behaviour is the original's; only the reset confirmation is now a dialog.
   ========================================================================== */
import { GEO, owners } from "../model.js";
import { BORDERS, persist } from "../store.js";
import { svg, vb, el, toSvg, redrawArcs, ORIG_ARCS, hideTip, X0, X1, Y0, Y1 } from "./engine.js";
import * as tl from "./timeline.js";
import { mq, setSheet, sheetPx } from "../ui/panel.js";
import { confirmDialog, toast } from "../ui/feedback.js";

export let editMode = false, brush = null;
export const arcOwners = {};
let saveT = null, bcur, ebMsg;
const undo = [];
const listeners = new Set();
export const onEditChange = fn => listeners.add(fn);

export function initEditor() {
  for (const k in owners) arcOwners[k] = [...owners[k]];
  bcur = el("circle", { class: "bcur", r: 0, cx: 0, cy: 0, visibility: "hidden" }, svg);
  ebMsg = document.getElementById("ebMsg");
  document.getElementById("ebUndo").onclick = () => {
    const u = undo.pop(); if (!u) return; for (const i in u) GEO.arcs[+i] = u[i];
    redrawArcs(Object.keys(u).map(Number)); document.getElementById("ebUndo").disabled = !undo.length; scheduleSave();
  };
  document.getElementById("ebReset").onclick = async () => {
    const ok = await confirmDialog({ title: "Reset every border?", danger: true, ok: "Reset borders",
      body: "All borders go back to the lines traced from the original sketch. You can still undo this while the editor is open." });
    if (!ok) return;
    undo.push(Object.fromEntries(GEO.arcs.map((a, i) => [i, a]))); GEO.arcs.splice(0, GEO.arcs.length, ...ORIG_ARCS.map(a => a.map(p => p.slice())));
    redrawArcs(GEO.arcs.map((_, i) => i)); document.getElementById("ebUndo").disabled = false; scheduleSave();
    toast("Borders reset to the sketch", { kind: "info", sub: "Use Undo to bring your edits back" });
  };
  document.getElementById("ebDone").onclick = () => setEdit(false);
  document.getElementById("bsize").oninput = () => { bcur.setAttribute("r", brushPx() * pxScale()); };
}

const pxScale = () => Math.max(vb.w / svg.clientWidth, vb.h / svg.clientHeight);
const brushPx = () => +document.getElementById("bsize").value;
export function brushCursor(e) {
  if (e.pointerType !== "mouse") { bcur.setAttribute("visibility", "hidden"); return; } const p = toSvg(e.clientX, e.clientY);
  bcur.setAttribute("cx", p.x); bcur.setAttribute("cy", p.y); bcur.setAttribute("r", brushPx() * pxScale()); bcur.setAttribute("visibility", "visible");
}
export function brushStart(e) {
  const p = toSvg(e.clientX, e.clientY), sc = pxScale(), grab = Math.max(14, brushPx() * .45) * sc; let best = Infinity;
  for (const i of GEO.border) { for (const q of GEO.arcs[i]) { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < best) best = d; } }
  if (best > grab) return false;
  brush = { p0: p, R0: brushPx() * sc, maxR: 0, snap: GEO.arcs.map(a => a.map(q => q.slice())), touched: new Set() }; svg.classList.add("dragging"); hideTip(); return true;
}
export function brushMove(e) {
  const p = toSvg(e.clientX, e.clientY), dx = p.x - brush.p0.x, dy = p.y - brush.p0.y, R = Math.max(brush.R0, Math.hypot(dx, dy) * 1.6), scan = Math.max(R, brush.maxR); brush.maxR = scan;
  brush.snap.forEach((sa, i) => {
    const a = GEO.arcs[i]; let hit = false;
    for (let j = 0; j < sa.length; j++) {
      const x = sa[j][0], y = sa[j][1], d = Math.hypot(x - brush.p0.x, y - brush.p0.y); if (d >= scan) continue; hit = true;
      if (d >= R) { a[j] = [x, y]; continue; } const t = 1 - (d / R) ** 2, w = t * t;
      const onV = Math.abs(x - X0) < .6 || Math.abs(x - X1) < .6, onH = Math.abs(y - Y0) < .6 || Math.abs(y - Y1) < .6;
      let nx = onV ? x : x + dx * w, ny = onH ? y : y + dy * w; nx = Math.min(X1, Math.max(X0, nx)); ny = Math.min(Y1, Math.max(Y0, ny)); a[j] = [+nx.toFixed(1), +ny.toFixed(1)];
    }
    if (hit) brush.touched.add(i);
  });
  if (!brush.raf) brush.raf = requestAnimationFrame(() => { if (!brush) return; brush.raf = 0; redrawArcs([...brush.touched]); });
}
export function brushEnd(cancel) {
  if (!brush) return; const b = brush; brush = null; cancelAnimationFrame(b.raf); const t = [...b.touched];
  if (cancel) { t.forEach(i => GEO.arcs[i] = b.snap[i]); redrawArcs(t); return; }
  const changed = t.filter(i => GEO.arcs[i].some((q, j) => q[0] !== b.snap[i][j][0] || q[1] !== b.snap[i][j][1]));
  redrawArcs(t); if (!changed.length) return;
  undo.push(Object.fromEntries(changed.map(i => [i, b.snap[i]]))); document.getElementById("ebUndo").disabled = false; scheduleSave();
}
export function syncBorders() {
  for (const k of Object.keys(BORDERS)) delete BORDERS[k];
  GEO.arcs.forEach((a, i) => { const o = ORIG_ARCS[i]; if (a.length !== o.length || a.some((q, j) => q[0] !== o[j][0] || q[1] !== o[j][1])) BORDERS[i] = a; });
}
function scheduleSave() {
  ebMsg.textContent = "Unsaved changes…"; clearTimeout(saveT);
  saveT = setTimeout(() => { syncBorders(); ebMsg.textContent = "Saving…"; ebMsg.textContent = persist("borders", { quiet: true }); }, 900);
}

export function setEdit(on) {
  if (on && tl.tlPast()) return; if (on && tl.tlOpen) tl.setTimeline(false);
  editMode = on; svg.classList.toggle("editing", on);
  document.querySelectorAll("#bEdit,[data-tool='edit']").forEach(b => b.setAttribute("aria-pressed", on));
  document.getElementById("ebar").hidden = !on; bcur.setAttribute("visibility", "hidden"); hideTip();
  if (on) { ebMsg.textContent = Object.keys(BORDERS).length ? "Your edited borders are loaded. Drag a border line to move it." : "Drag any border line to move it. Pinch or scroll to zoom."; if (mq.matches) setSheet("peek"); }
  else if (saveT) { clearTimeout(saveT); saveT = null; syncBorders(); persist("borders"); }
  document.documentElement.style.setProperty("--sheetpx", sheetPx() + "px");
  listeners.forEach(fn => fn(on));
}
/* the header / rail action: leave a past moment first, as the original did */
export function toggleEdit() {
  if (tl.tlPast()) { tl.animTo(tl.TLlen()); setTimeout(() => setEdit(true), 550); } else setEdit(!editMode);
}
