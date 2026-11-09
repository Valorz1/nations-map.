/* ==========================================================================
   STORE — loads the world from /data, keeps edits in this browser.

   data/geo.json      map geometry traced from the sketch (never edited here)
   data/nations.json  every nation, territory and movement as drawn on the sketch
   data/world.json    the editable world: ratings, borders, lore, governments,
                      wars & alliances, timeline moments and characters

   Edits are saved to localStorage straight away. "Export world" downloads a
   world.json that can replace data/world.json to publish the changes.
   ========================================================================== */
import { toast, confirmDialog } from "./ui/feedback.js";

const KEY = "nationsMap.world.v1";
const PREFS = "nationsMap.prefs.v1";

/* The editable state, using the same names as the original page. Each is
   mutated in place, never reassigned, so every module shares one copy. */
export let EDITS, BORDERS, LORE, GOV, REL, TL, CHARS;
export const DATA = { geo: null, regions: null };
export const status = { source: "published", savedAt: null, storage: true };
const listeners = new Set();
export const onStatus = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn(status));

async function getJSON(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`data/${name}.json → ${res.status}`);
  return res.json();
}

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.data && typeof o.data === "object" ? o : null;
  } catch (e) { status.storage = false; return null; }
}

function apply(w) {
  EDITS = obj(w.ratings); BORDERS = obj(w.borders); LORE = obj(w.lore); GOV = obj(w.governments);
  REL = arr(w.relations); TL = arr(w.timeline); CHARS = arr(w.characters);
}
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = v => (Array.isArray(v) ? v : []);

export async function load() {
  const [geo, regions, world] = await Promise.all([getJSON("geo"), getJSON("nations"), getJSON("world")]);
  DATA.geo = geo; DATA.regions = regions;
  const local = readLocal();
  if (local) { apply(local.data); status.source = "local"; status.savedAt = local.savedAt || null; }
  else apply(world);
}

export function snapshot() {
  return { ratings: EDITS, borders: BORDERS, lore: LORE, governments: GOV, relations: REL, timeline: TL, characters: CHARS };
}

/* Save everything to this browser. Returns a short status line (as the
   original persist() did) and, unless quiet, confirms with a toast. */
export function persist(what, { quiet = false } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), data: snapshot() }));
    status.source = "local"; status.savedAt = Date.now(); status.storage = true; emit();
    if (!quiet) toast(`${cap(what)} saved`, { sub: "Stored in this browser · export to publish" });
    return "Saved in this browser.";
  } catch (e) {
    const full = e && (e.name === "QuotaExceededError" || e.code === 22);
    const msg = full ? "Browser storage is full. Export your world to keep these changes."
                     : "This browser is blocking storage, so changes last for this visit only.";
    status.storage = false; emit();
    toast(`Couldn't save ${what}`, { sub: msg, kind: "err", ms: 7000 });
    return msg;
  }
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* world.json, formatted so that each item sits on its own line (readable diffs) */
export function worldJSON() {
  const w = snapshot();
  return "{\n" + Object.keys(w).map(k => {
    const v = w[k];
    const inner = Array.isArray(v)
      ? (v.length ? "[\n" + v.map(x => "    " + JSON.stringify(x)).join(",\n") + "\n  ]" : "[]")
      : (Object.keys(v).length ? "{\n" + Object.keys(v).map(i => "    " + JSON.stringify(i) + ": " + JSON.stringify(v[i])).join(",\n") + "\n  }" : "{}");
    return "  " + JSON.stringify(k) + ": " + inner;
  }).join(",\n") + "\n}\n";
}

export function exportWorld() {
  const blob = new Blob([worldJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "world.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("World exported", { sub: "Replace data/world.json with this file to publish it" });
}

const KEYS = ["ratings", "borders", "lore", "governments", "relations", "timeline", "characters"];
export async function importWorld(file) {
  let w;
  try { w = JSON.parse(await file.text()); } catch (e) { toast("That file isn't valid JSON", { kind: "err" }); return; }
  if (!w || typeof w !== "object" || !KEYS.some(k => k in w)) { toast("That doesn't look like a world.json file", { kind: "err", sub: "Expected ratings, borders, characters…" }); return; }
  const ok = await confirmDialog({
    title: "Replace your world?", danger: true, ok: "Import and replace",
    body: `This replaces the ratings, borders, lore, governments, wars, timeline and characters in this browser with “${file.name}”.`,
  });
  if (!ok) return;
  const data = {}; KEYS.forEach(k => { data[k] = w[k] ?? (["relations", "timeline", "characters"].includes(k) ? [] : {}); });
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), data })); }
  catch (e) { toast("Couldn't import", { kind: "err", sub: "This browser is blocking storage or it is full." }); return; }
  sessionStorage.setItem("nationsMap.flash", "World imported");
  location.reload();
}

export async function revertToPublished() {
  const ok = await confirmDialog({
    title: "Discard your changes?", danger: true, ok: "Discard changes",
    body: "Everything you've changed in this browser goes back to the published world. Export first if you want to keep a copy.",
  });
  if (!ok) return;
  try { localStorage.removeItem(KEY); } catch (e) {}
  sessionStorage.setItem("nationsMap.flash", "Back to the published world");
  location.reload();
}

/* ---- preferences (panel, layers, remembered tabs) ---- */
let prefs = null;
function loadPrefs() {
  if (prefs) return prefs;
  try { prefs = JSON.parse(localStorage.getItem(PREFS) || "{}") || {}; } catch (e) { prefs = {}; }
  // carry over the original page's panel setting
  try { if (!("panel" in prefs) && localStorage.getItem("mapPanel") != null) prefs.panel = localStorage.getItem("mapPanel") !== "0"; } catch (e) {}
  return prefs;
}
export const getPref = (k, d) => (k in loadPrefs() ? prefs[k] : d);
export function setPref(k, v) {
  loadPrefs()[k] = v;
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch (e) {}
}
