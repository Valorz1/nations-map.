/* ==========================================================================
   GEOGRAPHY — where the invented landscape is, as plain data.
   The Terrain view draws from this, and the population, resources, trade and
   war figures are calculated from the very same shapes, so what you see on the
   terrain map is what the numbers are counting.

   Nothing here touches the political map.
   ========================================================================== */
import { GEO, R, byId, owners, allCapitals } from "../model.js";

/* small repeatable random generator, so the landscape is the same on every visit */
export const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

/* zones are ellipses: e = [centre x, centre y, radius x, radius y] */
export const RANGES = [
  { e: [1255, 300, 330, 62], ids: ["marmite", "elarion", "blight"], name: "Blightwall Mountains" },
  { e: [285, 318, 215, 44], ids: ["marbonese", "desert"], name: "Dune Rim" },
  { e: [430, 1050, 190, 74], ids: ["sherolean"], name: "Shero Peaks" },
  { e: [1936, 925, 30, 215], name: "Sunrise Mountains" },                    // where the five rivers rise
  { e: [1200, 1305, 170, 46], ids: ["maxis", "axis"], name: "Axis Ridge" },
];
export const HILLS = [
  { e: [1160, 590, 250, 80], ids: ["elarion"] }, { e: [1255, 330, 420, 110], ids: ["marmite", "elarion"] },
  { e: [285, 350, 290, 90], ids: ["marbonese"] }, { e: [430, 1060, 280, 120], ids: ["sherolean"] },
  { e: [1380, 950, 120, 80] }, { e: [1200, 1290, 250, 80] }, { e: [1560, 560, 110, 80], ids: ["elarion"] },
];
export const WOODS = [
  { e: [300, 800, 200, 90], ids: ["sherolean", "marbonese"] }, { e: [190, 1285, 150, 70], ids: ["baloonia"] },
  { e: [850, 400, 120, 130], ids: ["marbonese"], pine: true }, { e: [850, 960, 130, 100], ids: ["fuc"] },
  { e: [1100, 1085, 130, 60], ids: ["mallies"] }, { e: [1690, 1290, 110, 70], ids: ["allies", "rivrep"] },
  { e: [740, 1280, 80, 80], ids: ["librebels", "fucex"], pine: true },
];
export const LAKES = [[705, 285, 44, 20], [1040, 655, 36, 17], [300, 1180, 30, 15]];

/* The Five Rivers: five streams rise in the far-eastern mountains, join one by
   one, and the Long River then crosses the whole south to Baloonia. */
export const JOIN = [[1795, 905], [1740, 930], [1690, 950], [1655, 962], [1625, 968]];
export const TRUNK = [[1625, 968], [1585, 962], [1530, 968], [1470, 990], [1400, 1012], [1330, 1000], [1255, 1022], [1180, 1000], [1110, 1018],
  [1040, 1050], [975, 1095], [900, 1128], [820, 1152], [740, 1140], [660, 1158], [580, 1178], [500, 1168], [420, 1182], [345, 1178], [300, 1180],
  [255, 1196], [205, 1228], [150, 1250], [100, 1290], [58, 1322], [18, 1348]];
export const STREAMS = [[[1925, 742], [1870, 790], [1830, 850]], [[1930, 835], [1880, 862], [1820, 880]], [[1932, 925], [1880, 925], [1800, 925]],
  [[1930, 1015], [1870, 990], [1790, 962]], [[1925, 1105], [1850, 1060], [1760, 1010], [1700, 985]]];
/* the smaller rivers: [points, width] */
export const RIVERS = [
  [[[480, 1010], [400, 985], [330, 1000], [250, 965], [170, 985], [95, 950], [20, 962]], 1],        // Sherolean river
  [[[330, 340], [300, 400], [235, 440], [200, 505], [120, 540], [20, 548]], .9],                    // off the desert rim
  [[[1180, 345], [1150, 430], [1085, 500], [1075, 580], [1040, 655]], .9],                          // down to Elar Mere
  [[[1215, 1318], [1180, 1340], [1175, 1370], [1150, 1400]], .8],
  [[[705, 285], [640, 330], [560, 345], [470, 330], [390, 345], [330, 340]], .8],
  // tributaries (drawn with gentle bends)
  [[[470, 1085], [492, 1120], [520, 1150], [538, 1172]], .7],                                      // Shero Peaks -> Long River
  [[[1330, 1280], [1350, 1200], [1372, 1110], [1388, 1014]], .7],                                  // Axis Ridge -> Long River
  [[[1090, 330], [1060, 370], [1020, 410], [990, 440]], .7],                                       // Blightwall -> River Marbon
  [[[330, 830], [300, 880], [288, 930], [300, 975], [330, 1000]], .7],                             // Teddy Woods -> Sherolean river
];
/* the border arcs that the River Marbon follows */
export const borderRiverArcs = () => Object.keys(owners).filter(k => owners[k].has("marbonese") && owners[k].has("elarion")).map(Number);

/* ---- roads: the shortest network that joins every capital ---- */
export const nationOf = r => (r.of ? byId[r.of] : r);
export function roadNetwork() {
  const C = allCapitals(), inTree = [0], rd = rng(31), edges = [];
  while (C.length && inTree.length < C.length) {
    let best = null;
    for (const i of inTree) for (let j = 0; j < C.length; j++) { if (inTree.includes(j)) continue; const dd = Math.hypot(C[i].x - C[j].x, C[i].y - C[j].y); if (!best || dd < best[2]) best = [i, j, dd]; }
    const [i, j, L] = best;
    edges.push({ a: C[i], b: C[j], L, bow: (rd() - .5) * L * .22 });
    inTree.push(j);
  }
  return { caps: C, edges };
}
/* pairs of nations joined directly by a road: these are the trade routes */
export function tradeRoutes() {
  const seen = new Set(), out = [];
  for (const e of roadNetwork().edges) {
    const A = nationOf(e.a.r), B = nationOf(e.b.r); if (!A || !B || A === B) continue;
    const key = [A.id, B.id].sort().join("|"); if (seen.has(key)) continue; seen.add(key); out.push([A.id, B.id]);
  }
  return out;
}

/* ---- what kind of land is where ----
   The map is sampled on a fine grid. Each sample belongs to one region and is
   one kind of land. Results are remembered until a border actually moves. */
export const LAND_TYPES = [
  ["valley", "River valley", "#7fb7d6"], ["plain", "Plains", "#cfdcab"], ["hills", "Hills", "#d4c796"], ["forest", "Forest", "#7fa868"],
  ["mountain", "Mountains", "#a39474"], ["jungle", "Jungle", "#5c9552"], ["desert", "Desert", "#ecd9a6"], ["blight", "Dead land", "#9c9c80"],
];
const STEP = 16, NEAR_RIVER = 36;
const inEll = (e, x, y, k = 1) => ((x - e[0]) / (e[2] * k)) ** 2 + ((y - e[1]) / (e[3] * k)) ** 2 < 1;
const ringPts = (ring, arcs) => { let pts = []; for (const i of ring) { const a = i >= 0 ? arcs[i] : [...arcs[~i]].reverse(); pts = pts.length ? pts.concat(a.slice(1)) : a.slice(); } return pts; };
function pip(p, x, y) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function signature(arcs) { let s = arcs.length; for (const a of arcs) { s = (s * 31 + a.length) % 1e9; for (const p of a) s = (s + p[0] * 7 + p[1] * 13) % 1e9; } return s; }

const cache = new Map();
/* -> { regionId: { n, valley, plain, hills, forest, mountain, jungle, desert, blight } } counted in samples */
export function landStats(arcs = GEO.arcs) {
  const sig = signature(arcs); if (cache.has(sig)) return cache.get(sig);
  // region outlines (Marmite first: its islands sit on top of its neighbours)
  const regs = R.filter(r => !r.kind && GEO.geoms[r.id]).sort((a, b) => (b.id === "marmite") - (a.id === "marmite")).map(r => {
    const polys = GEO.geoms[r.id].map(g => ringPts(g, arcs)).concat(r.extra || []);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return { id: r.id, polys, x0, y0, x1, y1 };
  });
  // cells close to running water or a lake
  const wet = new Set(), mark = (x, y) => { const cx = Math.round(x / STEP), cy = Math.round(y / STEP), k = Math.ceil(NEAR_RIVER / STEP); for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) if (Math.hypot(i, j) * STEP <= NEAR_RIVER) wet.add((cx + i) + "," + (cy + j)); };
  const line = pts => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10)); for (let t = 0; t <= n; t++) mark(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n); } };
  line(JOIN); line(TRUNK); STREAMS.forEach((s, i) => line(s.concat([JOIN[i]]))); RIVERS.forEach(([p]) => line(p)); borderRiverArcs().forEach(k => line(arcs[k]));
  LAKES.forEach(([cx, cy, rx, ry]) => { for (let a = 0; a < 16; a++) mark(cx + Math.cos(a / 16 * 6.283) * rx, cy + Math.sin(a / 16 * 6.283) * ry); });

  const out = {};
  for (const r of regs) out[r.id] = { n: 0, valley: 0, plain: 0, hills: 0, forest: 0, mountain: 0, jungle: 0, desert: 0, blight: 0 };
  for (let y = 30 + STEP / 2; y < 1384; y += STEP) for (let x = 30 + STEP / 2; x < 1970; x += STEP) {
    const reg = regs.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && r.polys.some(p => pip(p, x, y))); if (!reg) continue;
    const id = reg.id; let t;
    if (id === "desert") t = "desert"; else if (id === "blight") t = "blight"; else if (id === "jungle") t = "jungle";
    else if (RANGES.some(z => inEll(z.e, x, y, .92))) t = "mountain";
    else if (LAKES.some(l => inEll(l, x, y))) continue;                                         // open water is not land
    else if (wet.has(Math.round(x / STEP) + "," + Math.round(y / STEP))) t = "valley";
    else if (WOODS.some(z => inEll(z.e, x, y))) t = "forest";
    else if (HILLS.some(z => inEll(z.e, x, y))) t = "hills";
    else t = "plain";
    out[id].n++; out[id][t]++;
  }
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(sig, out);
  return out;
}
/* does the border between two regions run along a river? (used by the war simulator) */
export function riverBorder(a, b) {
  const pair = new Set([a, b]);
  return pair.has("marbonese") && pair.has("elarion");
}
