/* ==========================================================================
   MAP VIEWS — other ways to look at the same map.
   "political" is the original hand-drawn map, exactly as it always was.
   Every other view is one extra layer laid over the nation colours and removed
   again when you switch back, so the political map itself is never changed.

     terrain   mountains, forests, rivers (js/map/terrain.js)
     people    how crowded each land is        (people per km2)
     wealth    how rich its people are         (income per person)
     military  how strong its army is          (the Military rating)
   ========================================================================== */
import { R, byId } from "../model.js";
import { getPref, setPref } from "../store.js";
import { estimate, short, whole } from "../estimates.js";
import { svg, el, gRegions } from "./engine.js";
import { setTerrain } from "./terrain.js";

export const VIEWS = [
  { k: "political", label: "Political", desc: "The original map: nations and their colours", ico: "flag" },
  { k: "terrain", label: "Terrain", desc: "Mountains, forests, deserts, rivers and lakes", ico: "mountain" },
  { k: "people", label: "Population", desc: "How crowded each land is", ico: "users", lo: "#f6efd2", hi: "#b5482a", unit: "people per km²",
    val: r => estimate(r)?.density ?? null, fmt: v => (v < 10 ? v.toFixed(1) : whole(v)) },
  { k: "wealth", label: "Wealth", desc: "Income per person", ico: "trend", lo: "#eef3d6", hi: "#1f7a6a", unit: "income per person",
    val: r => estimate(r)?.perHead ?? null, fmt: v => "$" + short(v) },
  { k: "military", label: "Military", desc: "Strength of each army", ico: "shield", lo: "#f3e6dc", hi: "#8e2740", unit: "Military rating",
    val: r => r.stats?.m ?? (r.of ? byId[r.of]?.stats?.m : null) ?? null, fmt: v => String(v) },
];
let mode = "political", gData = null, paths = null, keyEl = null;
export const viewMode = () => mode;
const NONE = "#e4e1d9";

const mix = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"; };

function paint(v) {
  if (!gData) {
    gData = el("g", { class: "dataview", "pointer-events": "none", "clip-path": "url(#frameClip)" });
    (svg.querySelector("g.terrain") || gRegions).after(gData);
    paths = {};
    const order = R.filter(r => !r.kind && r.id !== "marmite").concat(R.filter(r => r.id === "marmite"));
    for (const r of order) { paths[r.id] = el("path", { d: r.d }, gData); r.els.push(paths[r.id]); }   // r.els: follows border edits
  }
  const vals = {}; let max = 0;
  for (const id in paths) { const x = v.val(byId[id]); vals[id] = x; if (x != null && x > max) max = x; }
  // five even steps from light to dark, so lands are easy to tell apart
  for (const id in paths) { const x = vals[id], c = x == null ? NONE : mix(v.lo, v.hi, Math.min(4, Math.floor(x / (max || 1) * 5)) / 4); paths[id].setAttribute("fill", c); paths[id].setAttribute("stroke", c); }
  keyEl.innerHTML = `<b>${v.label}</b><span class="vk-scale"><i>${v.fmt(0)}</i>${[0, 1, 2, 3, 4].map(i => `<s style="background:${mix(v.lo, v.hi, i / 4)}"></s>`).join("")}<i>${v.fmt(max)}</i></span><small>${v.unit} · darker = more · grey = not known</small>`;
}

export function setView(k, { save = true } = {}) {
  const v = VIEWS.find(x => x.k === k) || VIEWS[0];
  mode = v.k; keyEl = keyEl || document.getElementById("viewKey");
  setTerrain(mode === "terrain");
  if (v.val) paint(v);
  svg.classList.toggle("dataview-on", !!v.val);
  keyEl.hidden = !v.val;
  svg.setAttribute("aria-label", v.label + " map");
  if (save) setPref("mapView", mode);
}
/* repaint the open data view after ratings or borders change */
export const refreshView = () => { const v = VIEWS.find(x => x.k === mode); if (v && v.val && gData) paint(v); };
export const initViews = () => { const k = getPref("mapView", "political"); if (k !== "political") setView(k, { save: false }); };
