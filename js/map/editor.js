/* ==========================================================================
   BORDER EDITOR — drag one border line with a soft brush; the two nations it
   separates follow, nothing else moves.
   Behaviour is the original's; only the reset confirmation is now a dialog.
   ========================================================================== */
import { GEO, owners } from "../model.js";
import { BORDERS, persist } from "../store.js";
import { svg, vb, el, toSvg, redrawArcs, borderEls, ORIG_ARCS, hideTip, X0, X1, Y0, Y1 } from "./engine.js";
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
/* distance from point p to segment ab */
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L)) : 0;
  return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);
}
const same = (a, b) => Math.abs(a[0] - b[0]) < .05 && Math.abs(a[1] - b[1]) < .05;
/* Grab the single border line nearest the finger. Only that line bends; other
   lines move only where they meet it at a junction, so the junction stays joined. */
export function brushStart(e) {
  const p = toSvg(e.clientX, e.clientY), sc = pxScale(), grab = Math.max(e.pointerType === "mouse" ? 14 : 26, brushPx() * .45) * sc;
  let best = Infinity, arc = -1;
  for (const i of GEO.border) { const A = GEO.arcs[i]; for (let j = 1; j < A.length; j++) { const d = segDist(p, A[j - 1], A[j]); if (d < best) { best = d; arc = i; } } }
  if (best > grab) return false;
  const snap = GEO.arcs.map(a => a.map(q => q.slice())), S = snap[arc];
  // arcs that share an end point (junction) with the grabbed line
  const ends = [S[0], S[S.length - 1]], linked = [];
  snap.forEach((a, i) => { if (i !== arc && a.length && (ends.some(E => same(E, a[0]) || same(E, a[a.length - 1])))) linked.push(i); });
  brush = { p0: p, R0: brushPx() * sc, arc, ends, linked, snap, touched: new Set([arc]) };
  (borderEls[arc] || []).forEach(el => el.classList.add("grab"));
  svg.classList.add("dragging"); hideTip(); return true;
}
function bend(i, dx, dy, R) {
  const sa = brush.snap[i], a = GEO.arcs[i]; let hit = false;
  for (let j = 0; j < sa.length; j++) {
    const x = sa[j][0], y = sa[j][1], d = Math.hypot(x - brush.p0.x, y - brush.p0.y);
    if (d >= R) { if (a[j][0] !== x || a[j][1] !== y) { a[j] = [x, y]; hit = true; } continue; }
    const t = 1 - (d / R) ** 2, w = t * t; hit = true;
    const onV = Math.abs(x - X0) < .6 || Math.abs(x - X1) < .6, onH = Math.abs(y - Y0) < .6 || Math.abs(y - Y1) < .6;
    let nx = onV ? x : x + dx * w, ny = onH ? y : y + dy * w; nx = Math.min(X1, Math.max(X0, nx)); ny = Math.min(Y1, Math.max(Y0, ny)); a[j] = [+nx.toFixed(1), +ny.toFixed(1)];
  }
  if (hit) brush.touched.add(i);
}
export function brushMove(e) {
  const p = toSvg(e.clientX, e.clientY), dx = p.x - brush.p0.x, dy = p.y - brush.p0.y;
  // the bend widens a little on long drags so the line stays smooth, but never past 2.5x the brush
  const R = Math.min(brush.R0 * 2.5, Math.max(brush.R0, Math.hypot(dx, dy) * 1.2));
  bend(brush.arc, dx, dy, R);
  // neighbours follow only if a junction of the grabbed line is inside the brush
  const jMoves = brush.ends.some(E => Math.hypot(E[0] - brush.p0.x, E[1] - brush.p0.y) < R);
  for (const i of brush.linked) { if (jMoves) bend(i, dx, dy, R); else if (brush.touched.has(i)) GEO.arcs[i] = brush.snap[i].map(q => q.slice()); }
  if (!brush.raf) brush.raf = requestAnimationFrame(() => { if (!brush) return; brush.raf = 0; redrawArcs([...brush.touched]); });
}
export function brushEnd(cancel) {
  if (!brush) return; const b = brush; brush = null; cancelAnimationFrame(b.raf); const t = [...b.touched];
  (borderEls[b.arc] || []).forEach(el => el.classList.remove("grab"));
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
