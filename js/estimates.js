/* ==========================================================================
   ESTIMATES — population, economy, resources and trade, worked out from the map.
   Nothing here is stored: every number is calculated from what is drawn, so
   it changes by itself when a border is moved or a rating is edited.

     area        the region's shape on the map (1 map unit = 2 km)
     land        what the Terrain view shows inside the border: river valleys,
                 plains, hills, forest, mountains, jungle, desert, dead land
                 (js/map/geography.js samples the map to count each kind)
     population  countryside + cities
                 countryside = each kind of land x the people it can feed
                               (a river valley holds 15x more than mountains)
                               x how developed the nation is (Economy rating)
                 cities      = each capital: infrastructure level x 160,000
                               (x 50,000 for the smaller circles)
     GDP         population x income per person ($300 + $95 per Economy point)
                 + 3% for every open trade route (a road to a neighbour),
                 up to 15%. A war closes the route between the two sides.
     army        a share of the population that rises with the Military rating
     resources   grain, timber, ore, fish, spices, oil: from the land inside
                 the border, shown as a share of the whole world's supply

     world size  the raw figures above are then scaled so the whole world always
                 holds 8 billion people and a GDP of $50 trillion. Borders and
                 ratings decide each nation's share of that, not the total.

   A nation's figures include its territories. Territories use their owner's
   ratings. Resistance movements and the Unknown Lands have no figures.
   ========================================================================== */
import { GEO, R, byId, caps, terr } from "./model.js";
import { EDITS, REL, TL, BORDERS } from "./store.js";
import { landStats, LAND_TYPES, tradeRoutes } from "./map/geography.js";
import { curRel, ORIG_ARCS } from "./map/engine.js";

export const KM_PER_UNIT = 2;
/* people per km2 of countryside, by kind of land */
export const DENSITY = { valley: 46, plain: 24, hills: 14, forest: 12, mountain: 3, jungle: 9, desert: 3, blight: .2 };
const CITY = { large: 160000, small: 50000 };                                       // people per infrastructure level
export const RESOURCES = [
  { k: "grain", label: "Grain", ico: "grain", color: "#d9b84a", from: { plain: 1, valley: 2.2 }, src: "plains and river valleys" },
  { k: "timber", label: "Timber", ico: "tree", color: "#6f9a5a", from: { forest: 1.5, jungle: .8 }, src: "forest and jungle" },
  { k: "ore", label: "Ore & stone", ico: "mountain", color: "#a08c6c", from: { mountain: 3, hills: .5 }, src: "mountains and hills" },
  { k: "fish", label: "Fish", ico: "fish", color: "#5d9bc4", from: { valley: .9 }, src: "rivers and lakes" },
  { k: "spice", label: "Spices", ico: "leaf", color: "#c9703a", from: { jungle: 1.6 }, src: "jungle" },
  { k: "oil", label: "Oil", ico: "drop", color: "#6b6f7c", from: { desert: 1.1 }, src: "desert" },
];

/* ---- which moment are we measuring? ----
   live(): the map as it is shown right now (this follows the timeline slider).
   momentCtx(t): a saved timeline moment, or the present when t is null. */
const live = () => ({ key: "live", arcs: GEO.arcs, stat: r => r.stats, rel: curRel });
export function momentCtx(t) {
  const borders = t ? t.borders || {} : BORDERS, edits = t ? t.edits || {} : EDITS;
  return { key: t || "now", arcs: ORIG_ARCS.map((a, i) => borders[i] || a), rel: t ? t.rel || [] : REL,
    stat: r => { const e = edits[r.id]; return e ? Object.assign({}, r.base || {}, e) : r.base; } };
}

const shoelace = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
function ringPts(ring, arcs) { let pts = []; for (const i of ring) { const a = i >= 0 ? arcs[i] : [...arcs[~i]].reverse(); pts = pts.length ? pts.concat(a.slice(1)) : a.slice(); } return pts; }
/* land area in km2, straight from the drawn shape */
export function areaKm2(r, arcs = GEO.arcs) {
  if (r.kind || !GEO.geoms[r.id]) return 0;
  const units = GEO.geoms[r.id].reduce((s, g) => s + shoelace(ringPts(g, arcs)), 0) + (r.extra || []).reduce((s, p) => s + shoelace(p), 0);
  return units * KM_PER_UNIT * KM_PER_UNIT;
}

function own(r, ctx) {
  const km2 = areaKm2(r, ctx.arcs), owner = r.of ? byId[r.of] : r;
  const e = ctx.stat(r)?.e ?? ctx.stat(owner)?.e ?? null;
  const counts = landStats(ctx.arcs)[r.id], land = {};
  let capacity = 0;                                                                  // people the countryside can hold
  for (const [k] of LAND_TYPES) { land[k] = counts && counts.n ? km2 * counts[k] / counts.n : 0; capacity += land[k] * DENSITY[k]; }
  if (!counts || !counts.n) { land.plain = km2; capacity = km2 * DENSITY.plain; }
  const rural = capacity * (e == null ? .8 : .5 + e / 100);
  const urban = caps(r).reduce((s, m) => s + m[0] * (m[3] ? CITY.small : CITY.large), 0);
  const pop = rural + urban;
  return { km2, pop, urban, land, gdp: e == null ? null : pop * (300 + e * 95) };
}

let ROUTES = null;
const routes = () => ROUTES || (ROUTES = tradeRoutes());
const atWar = (rel, a, b) => rel.some(x => x.t === "war" && x.status !== "ended" && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));

/* ---- the size of the whole world ---- */
export const WORLD = { pop: 8e9, gdp: 50e12 };
/* how much to scale the raw figures by so the world adds up to WORLD. Worked out once
   per moment and remembered until the current task ends (by then a border or rating may have changed). */
const scales = new Map();
function scaleFor(ctx) {
  if (scales.has(ctx.key)) return scales.get(ctx.key);
  let pop = 0, gdp = 0;
  for (const r of R) { if (r.of) continue; const x = raw(r, ctx); if (x) { pop += x.pop; gdp += x.gdp || 0; } }
  const k = { pop: pop ? WORLD.pop / pop : 1, gdp: gdp ? WORLD.gdp / gdp : 1 };
  if (!scales.size) setTimeout(() => scales.clear());
  scales.set(ctx.key, k);
  return k;
}

/* figures for one place; a nation's totals include its territories */
export function estimate(r, ctx = live()) {
  const x = raw(r, ctx); if (!x) return null;
  const k = scaleFor(ctx), pop = x.pop * k.pop, gdp = x.gdp == null ? null : x.gdp * k.gdp;
  return { ...x, pop, urban: x.urban * k.pop, density: x.km2 ? pop / x.km2 : 0, gdp, perHead: gdp == null || !pop ? null : gdp / pop,
    troops: x.troops == null ? null : x.troops * k.pop, tradeValue: x.tradeValue * k.gdp };
}
function raw(r, ctx) {
  if (!r || r.kind || !GEO.geoms[r.id] || r.id === "unknown") return null;
  const parts = [r, ...terr(r.id)].map(x => own(x, ctx));
  const sum = k => parts.reduce((s, p) => s + (p[k] || 0), 0);
  const km2 = sum("km2"), pop = sum("pop"), land = {};
  for (const [k] of LAND_TYPES) land[k] = parts.reduce((s, p) => s + p.land[k], 0);
  // trade: every road that leads straight to a neighbour's capital is a route; war closes it
  const partners = r.of ? [] : routes().filter(p => p.includes(r.id)).map(p => { const id = p[0] === r.id ? p[1] : p[0]; return { id, open: !atWar(ctx.rel, r.id, id) }; });
  const bonus = Math.min(.15, .03 * partners.filter(p => p.open).length);
  const base = parts[0].gdp == null ? null : sum("gdp"), gdp = base == null ? null : base * (1 + bonus);
  // soldiers: a bigger share of the people serve where the Military rating is higher (0.4% up to about 2%)
  const m = ctx.stat(r)?.m ?? (r.of ? ctx.stat(byId[r.of])?.m : null) ?? null;
  return { km2, pop, urban: sum("urban"), density: km2 ? pop / km2 : 0, gdp, perHead: gdp == null || !pop ? null : gdp / pop, terr: parts.length - 1,
    troops: m == null ? null : pop * (.004 + m / 100 * .016), land, partners, tradeBonus: bonus, tradeValue: base == null ? 0 : base * bonus };
}
export function worldTotals(ctx = live()) {
  let pop = 0, gdp = 0, km2 = 0;
  for (const r of R) { if (r.of) continue; const x = estimate(r, ctx); if (x) { pop += x.pop; gdp += x.gdp || 0; km2 += x.km2; } }
  return { pop, gdp, km2 };
}

/* ---- resources ---- */
const producers = () => R.filter(r => !r.of && !r.kind && r.id !== "unknown" && r.id !== "blight" && GEO.geoms[r.id]);
/* -> { byId: { nationId: { grain, timber, … } }, total: { grain, … } } in arbitrary units */
export function resourceTable(ctx = live()) {
  const table = { byId: {}, total: {} };
  for (const res of RESOURCES) table.total[res.k] = 0;
  for (const r of producers()) {
    const land = estimate(r, ctx).land, row = table.byId[r.id] = {};
    for (const res of RESOURCES) { let v = 0; for (const t in res.from) v += (land[t] || 0) * res.from[t]; row[res.k] = v; table.total[res.k] += v; }
  }
  return table;
}
/* a nation's resources, biggest world share first: [{ res, amount, share }] */
export function resourcesOf(r, table = resourceTable()) {
  const row = table.byId[r.of || r.id]; if (!row || r.of) return [];
  return RESOURCES.map(res => ({ res, amount: row[res.k], share: table.total[res.k] ? row[res.k] / table.total[res.k] : 0 })).filter(x => x.share > .004).sort((a, b) => b.share - a.share);
}
/* who a nation trades with, and what goes each way: [{ id, open, sells, buys }] */
export function tradeDeals(r, ctx = live(), table = resourceTable(ctx)) {
  const est = estimate(r, ctx); if (!est) return [];
  const share = (id, k) => (table.byId[id] && table.total[k] ? table.byId[id][k] / table.total[k] : 0);
  return est.partners.map(p => {
    let sells = null, buys = null, bs = .002, bb = .002;
    for (const res of RESOURCES) { const d = share(r.id, res.k) - share(p.id, res.k); if (d > bs) { bs = d; sells = res; } if (-d > bb) { bb = -d; buys = res; } }
    return { ...p, sells, buys };
  });
}

/* ---- history: the same figures at every saved moment, ending with now ---- */
export function estimateHistory(r) {
  const at = (label, t) => { const x = estimate(r, momentCtx(t)); return { label, pop: x ? Math.round(x.pop) : null, gdp: x && x.gdp != null ? Math.round(x.gdp) : null }; };
  return [...TL.map(t => at(t.name, t)), at("Now", null)];
}

/* ---- short, readable numbers: 55.3M, 1.2B, 840K ---- */
export function short(n) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n), f = (v, u) => (v >= 100 ? Math.round(v) : +v.toFixed(1)) + u;
  if (a >= 1e12) return f(n / 1e12, "T"); if (a >= 1e9) return f(n / 1e9, "B"); if (a >= 1e6) return f(n / 1e6, "M"); if (a >= 1e3) return f(n / 1e3, "K");
  return String(Math.round(n));
}
export const money = n => (n == null ? "—" : "$" + short(n));
export const whole = n => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
export const pct = n => (n * 100 >= 10 ? Math.round(n * 100) : +(n * 100).toFixed(1)) + "%";
