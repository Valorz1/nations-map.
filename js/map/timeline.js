/* ==========================================================================
   TIMELINE — saved moments of the map; slide between them to watch borders,
   ratings and wars change. Interpolation and snapshot logic are the original;
   moments may now also carry a date, a description and the governments of
   the day.
   ========================================================================== */
import { GEO, R, calcMax } from "../model.js";
import { TL, EDITS, REL, GOV, BORDERS, persist } from "../store.js";
import { ORIG_ARCS, redrawArcs, drawTags, drawRel } from "./engine.js";
import * as ed from "./editor.js";
import { mq, setSheet } from "../ui/panel.js";
import { esc, plural } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog, toast } from "../ui/feedback.js";

let LIVE_ARCS, allArcIdx, tb, tr;
export let tlPos = 0, tlOpen = false;
let playing = null;
const hooks = { refresh: () => {}, archive: () => {} };
export const setTimelineHooks = h => Object.assign(hooks, h);
export const TLlen = () => TL.length;
export const tlPast = () => tlPos < TL.length - .001;
export const tlIdx = () => Math.max(0, Math.min(TL.length - 1, Math.round(tlPos)));
const stopArcs = k => k >= TL.length ? LIVE_ARCS : ORIG_ARCS.map((a, i) => (TL[k].borders || {})[i] || a);

function applyEdits(edits) {
  for (const r of R) { const e = edits[r.id]; r.stats = e ? Object.assign({ x: r.label.x, y: r.label.y + r.label.l.length * r.label.s * .55 + 34 }, r.base || {}, e) : (r.base ? { ...r.base } : null); }
}

export function showState(pos, final) {
  const n = TL.length; pos = Math.max(0, Math.min(n, pos)); tlPos = pos; const k = Math.floor(pos), f = pos - k;
  if (f < .001 || k >= n) GEO.arcs = stopArcs(Math.round(pos));
  else { const A = stopArcs(k), B = stopArcs(k + 1); GEO.arcs = A.map((a, i) => { const b = B[i]; if (a === b || a.length !== b.length) return f < .5 ? a : b; return a.map((p, j) => [p[0] + (b[j][0] - p[0]) * f, p[1] + (b[j][1] - p[1]) * f]); }); }
  redrawArcs(allArcIdx); const near = Math.round(pos), st = near >= n ? { edits: EDITS, rel: REL } : TL[near];
  applyEdits(st.edits || {}); calcMax(); drawTags(); drawRel(st.rel || []);
  if (!tlPast()) GEO.arcs = LIVE_ARCS;
  document.body.classList.toggle("past", tlPast()); tbUI();
  if (final) hooks.refresh();
}

/* the moment currently shown, for views that respect the timeline */
export const viewedMoment = () => (tlPast() ? TL[tlIdx()] : null);

function tbUI() {
  const n = TL.length, atNow = !tlPast(), near = atNow ? n : tlIdx(); tr.max = n;
  const m = TL[near];
  document.getElementById("tbName").textContent = atNow ? "Now" : m ? m.name : "";
  document.getElementById("tbSub").textContent = n ? (atNow ? `Live map · ${plural(n, "saved moment")}` : `${m && m.date ? m.date + " · " : ""}Moment ${near + 1} of ${n} · editing is off`) : "No saved moments yet";
  document.getElementById("tbTicks").innerHTML = [...TL.map(t => t.name), "Now"].map((t, i) => `<button type="button" data-tick="${i}" style="left:${n ? i / n * 100 : 100}%" class="${Math.abs(i - tlPos) < .5 ? "on" : ""}">${esc(t)}</button>`).join("");
  document.getElementById("tbAct").innerHTML = atNow
    ? `<input id="tbNew" class="input" type="text" placeholder="Name this moment, e.g. Before the Great War" aria-label="Moment name"><input id="tbDate" class="input date" type="text" placeholder="Date or era (optional)" aria-label="Date or era"><button type="button" id="tbSave" class="btn btn-primary">${icon("camera")}Save moment</button>`
    : `<input id="tbRen" class="input" type="text" value="${esc(TL[near].name)}" aria-label="Rename moment"><button type="button" id="tbRename" class="btn">Rename</button><button type="button" id="tbDel" class="btn btn-danger-ghost">${icon("trash")}Delete</button><button type="button" id="tbNow" class="btn btn-primary">Back to Now</button>`;
  if (document.activeElement !== tr) tr.value = tlPos; tr.disabled = !n; tr.style.opacity = n ? 1 : .4; document.getElementById("tbPlay").disabled = !n;
}

export function animTo(t) {
  const s = tlPos, t0 = performance.now(), D = matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 500;
  const step = n => { const k = D ? Math.min(1, (n - t0) / D) : 1; showState(s + (t - s) * (1 - Math.pow(1 - k, 3)), k >= 1); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
}
function setPlayLabel(on) { const b = document.getElementById("tbPlay"); b.innerHTML = `${icon(on ? "pause" : "play")}<span class="btn-l">${on ? "Pause" : "Play"}</span>`; }
function stopPlay() { if (playing) { cancelAnimationFrame(playing); playing = null; setPlayLabel(false); } }

/* Save the live map as a new moment. Returns the new moment. */
export function saveMoment({ name, date = "", description = "" } = {}) {
  ed.syncBorders();
  const nm = (name || "").trim() || `Moment ${TL.length + 1}`;
  const m = { name: nm, borders: JSON.parse(JSON.stringify(BORDERS)), edits: JSON.parse(JSON.stringify(EDITS)), rel: JSON.parse(JSON.stringify(REL)),
    gov: JSON.parse(JSON.stringify(GOV)), savedAt: Date.now() };
  if (date.trim()) m.date = date.trim();
  if (description.trim()) m.description = description.trim();
  TL.push(m); tlPos = TL.length; tbUI();
  persist("timeline", { quiet: true });
  toast(`Saved “${nm}”`, { sub: "Added to the historical archive" });
  return m;
}
export async function deleteMoment(i) {
  const m = TL[i]; if (!m) return false;
  const ok = await confirmDialog({ title: `Delete “${m.name}”?`, body: "This moment and its map snapshot will be removed from the archive. This can't be undone.", ok: "Delete moment", danger: true });
  if (!ok) return false;
  TL.splice(i, 1); showState(Math.min(tlPos, TL.length), true);
  persist("timeline", { quiet: true }); toast("Moment deleted", { kind: "info" });
  return true;
}

export function setTimeline(on) {
  tlOpen = on; tb.hidden = !on;
  document.querySelectorAll("#bTime,[data-tool='time']").forEach(b => b.setAttribute("aria-pressed", on));
  if (on) { if (ed.editMode) ed.setEdit(false); tbUI(); if (mq.matches) setSheet("mini"); }
  else { stopPlay(); if (tlPast()) animTo(TL.length); }
}
/* open the timeline at a given moment */
export function viewMoment(i) { if (!tlOpen) setTimeline(true); stopPlay(); animTo(i); }

export function initTimeline() {
  LIVE_ARCS = GEO.arcs; allArcIdx = GEO.arcs.map((_, i) => i); tlPos = TL.length;
  tb = document.getElementById("tbar"); tr = document.getElementById("tbRange");
  tr.addEventListener("input", () => { stopPlay(); showState(+tr.value, false); });
  tr.addEventListener("change", () => { const t = Math.round(+tr.value); animTo(t); });
  document.getElementById("tbPlay").onclick = () => {
    if (playing) { stopPlay(); return; } const n = TL.length; if (!n) return; const s = tlPos >= n - .01 ? 0 : tlPos; const t0 = performance.now() - s * 1600;
    setPlayLabel(true);
    const step = now => { const p = Math.min(n, (now - t0) / 1600); showState(p, false); if (Math.abs(p - Math.round(p)) < .02) tbUI(); if (p < n) playing = requestAnimationFrame(step); else { playing = null; setPlayLabel(false); showState(n, true); } };
    playing = requestAnimationFrame(step);
  };
  document.getElementById("tbClose").onclick = () => setTimeline(false);
  document.getElementById("tbArchive").onclick = () => hooks.archive();
  tb.addEventListener("click", async e => {
    const t = e.target.closest("[data-tick]"); if (t) { stopPlay(); animTo(+t.dataset.tick); return; }
    const id = e.target.closest("button")?.id;
    if (id === "tbSave") {
      saveMoment({ name: document.getElementById("tbNew").value, date: document.getElementById("tbDate").value });
      hooks.refresh(); return;
    }
    const near = tlIdx();
    if (id === "tbNow") { animTo(TL.length); return; }
    if (id === "tbRename") { const v = (document.getElementById("tbRen").value || "").trim(); if (!v) return; TL[near].name = v; tbUI(); persist("moment name"); hooks.refresh(); return; }
    if (id === "tbDel") { await deleteMoment(near); }
  });
  tb.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "tbNew") document.getElementById("tbSave").click(); if (e.key === "Enter" && e.target.id === "tbRen") document.getElementById("tbRename").click(); });
  setPlayLabel(false);
  drawRel(REL);
}
