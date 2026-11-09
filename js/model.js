/* ==========================================================================
   MODEL — the world's nations and the facts derived from them.
   Preparation steps and ranking maths are carried over from the original.
   ========================================================================== */
import { DATA, EDITS, LORE, GOV, CHARS, TL } from "./store.js";

export let GEO, R, byId, owners;
export let MAX = { rate: 1, m: 1, e: 1 };

export function prepare() {
  GEO = DATA.geo; R = DATA.regions;
  // as in the original: the two parts of the Liberalist Rebels are one country
  GEO.geoms.librebels = GEO.geoms.librebels.concat(GEO.geoms.librebellion || []); delete GEO.geoms.librebellion;
  for (const r of R) { if (LORE[r.id]) r.lore = LORE[r.id]; }
  for (const r of R) { r.base = r.stats ? { ...r.stats } : null; }
  for (const r of R) {
    r.orig = r.stats ? { rate: r.stats.rate, m: r.stats.m, e: r.stats.e } : {};
    const ed = EDITS[r.id]; if (!ed) continue;
    r.stats = Object.assign({ x: r.label.x, y: r.label.y + r.label.l.length * r.label.s * .55 + 34 }, r.stats || {}, ed);
  }
  byId = Object.fromEntries(R.map(r => [r.id, r]));
  R.find(r => r.id === "marmite").extra = [GEO.feats.mr[0], GEO.feats.mrr[0], GEO.feats.ind[0]];
  owners = {};
  for (const r of R) {
    if (r.kind) continue;
    for (const ring of GEO.geoms[r.id]) for (const i of ring) { const k = i >= 0 ? i : ~i; (owners[k] = owners[k] || new Set()).add(r.id); }
  }
  calcMax();
}

export function calcMax() {
  MAX = { rate: Math.max(1, ...R.map(r => r.stats?.rate || 0)), m: Math.max(1, ...R.map(r => r.stats?.m || 0)), e: Math.max(1, ...R.map(r => r.stats?.e || 0)) };
}

export const METRICS = [
  { k: "rate", label: "Rate", long: "Overall rating", ico: "star", cls: "rate", color: "var(--c-rate)", hex: "#b98a2b" },
  { k: "m", label: "Military", long: "Military power", ico: "shield", cls: "m", color: "var(--c-mil)", hex: "#d0506a" },
  { k: "e", label: "Economy", long: "Economic power", ico: "trend", cls: "e", color: "var(--c-eco)", hex: "#3a9fd8" },
];
export const metric = k => METRICS.find(m => m.k === k);

/* ---- kinds of place ---- */
export const isTerritory = r => !!r.of && !r.kind;
export const isMovement = r => !!r.kind;
export const isTop = r => !r.of && !r.kind;               // nations and areas (incl. The Blight, Unknown Lands)
export const isRated = r => !!r.stats && (r.stats.rate != null || r.stats.m != null || r.stats.e != null);
export const terr = id => R.filter(x => x.of === id);
export const movements = id => R.filter(x => x.in === id);
export const host = r => (r.of ? byId[r.of] : r.in ? byId[r.in] : null);
export function kindLabel(r) {
  if (r.kind) return "Resistance movement";
  if (r.of) return "Territory";
  if (r.tag) return r.tag;
  if (!r.stats) return "Region";
  return "Nation";
}

/* ---- capitals ----  mark = [level, x, y, smaller, hatched/disputed, destroyed, note] */
export const caps = r => r.marks.filter(m => !m[5]);
export const infra = r => caps(r).reduce((a, m) => a + m[0], 0);
export const topLevel = r => caps(r).reduce((a, m) => Math.max(a, m[0]), 0);
export function allCapitals() {
  const out = [];
  for (const r of R) caps(r).forEach((m, i) => out.push({ r, m, i, level: m[0], x: m[1], y: m[2], small: !!m[3], disputed: !!m[4], note: m[6] || "" }));
  return out;
}

/* ---- ranking (unchanged): 1 + number of strictly greater values ---- */
export function rankOf(r, k) {
  const v = r.stats?.[k]; if (v == null) return null;
  const vals = R.map(x => x.stats?.[k]).filter(x => x != null);
  return { rank: 1 + vals.filter(x => x > v).length, of: vals.length };
}
export function avgOf(k) {
  const v = R.map(x => x.stats?.[k]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export function neighbours(id) {
  const s = new Set();
  for (const k in owners) if (owners[k].has(id)) owners[k].forEach(o => o !== id && s.add(o));
  return [...s].sort((a, b) => byId[a].name.localeCompare(byId[b].name));
}

/* ---- government & people ---- */
export const govOf = id => GOV[id] || {};
export function leaderChar(r) {
  const g = GOV[r.id]; if (!g || !g.leader) return null;
  return CHARS.find(x => x.nation === r.id && x.name.toLowerCase() === g.leader.toLowerCase()) || null;
}
export const charsOf = id => CHARS.filter(c => c.nation === id);
export const charById = id => CHARS.find(c => c.id === id);
export function isRuler(c) {
  const g = GOV[c.nation]; return !!(g && g.leader && g.leader.toLowerCase() === (c.name || "").toLowerCase());
}
export function govTypes() {
  const m = new Map();
  for (const r of R) { const g = GOV[r.id]?.gov; if (!g) continue; const k = g.trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

/* ---- relations ---- rel = {a, b, t:"war"|"ally", name?, status?:"ended", started?, ended?, outcome?, notes?} */
export const relName = id => (byId[id] ? byId[id].name : id);
export const relActive = x => x.status !== "ended";
export const otherSide = (x, id) => (x.a === id ? x.b : x.a);
export function relationsOf(id, list) {
  const mine = list.filter(x => (x.a === id || x.b === id) && byId[otherSide(x, id)]);
  return {
    wars: mine.filter(x => x.t === "war" && relActive(x)),
    allies: mine.filter(x => x.t === "ally" && relActive(x)),
    past: mine.filter(x => !relActive(x)),
  };
}
export function relTitle(x) {
  if (x.name) return x.name;
  return x.t === "war" ? `${relName(x.a)} – ${relName(x.b)} war` : `${relName(x.a)} – ${relName(x.b)} alliance`;
}

/* ---- timeline helpers ---- */
export function statsAt(r, k, edits) {
  const e = edits[r.id];
  const s = e ? Object.assign({}, r.base || {}, e) : (r.base ? { ...r.base } : null);
  return s ? s[k] ?? null : null;
}
/* the series of a nation's stat across saved moments, ending with now */
export function statHistory(r, k) {
  return [...TL.map(t => ({ label: t.name, v: statsAt(r, k, t.edits || {}) })), { label: "Now", v: statsAt(r, k, EDITS) }];
}

export function sortedByName(list) { return [...list].sort((a, b) => a.name.localeCompare(b.name)); }
