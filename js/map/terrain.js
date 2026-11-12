/* ==========================================================================
   TERRAIN VIEW — an optional second look at the same map.
   The political map is not touched: this draws one extra layer (shaded relief,
   mountains, forests, rivers, lakes, cities, motorways, railways, farmland,
   airports…) that sits
   over the nation colours and is only shown while the Terrain view is on.
   Borders, labels, capitals and tapping a nation all work exactly as before.

   Where everything is comes from js/map/geography.js, which the population,
   resource and war figures read too. This file only decides how it is drawn:
   the land is painted once as a shaded-relief picture (high ground, valleys,
   dry and lush country), and the symbols are then placed to agree with it.
   The layer is built the first time the view is opened, so it costs nothing
   until then.
   ========================================================================== */
import { R, byId, owners } from "../model.js";
import { svg, el, gRegions, regionPath, borderEls, X0, X1, Y0, Y1, fmt } from "./engine.js";
import { rng, RANGES, HILLS, WOODS, LAKES, JOIN, TRUNK, STREAMS, RIVERS, borderRiverArcs, roadNetwork } from "./geography.js";

let built = false, on = false;
export const terrainOn = () => on;

/* regions that are one kind of land from edge to edge keep a flat colour of their own;
   everywhere else the land colour comes from the relief picture and ignores borders */
const BIOME = { desert: "#ecd9a6", blight: "#b3b396", jungle: "#a5c788", unknown: "#e6e2d8" };
const WILD = ["desert", "blight", "jungle", "unknown"];
const DRY = [[185, 545, 150, 62], [1470, 1255, 120, 70], [560, 480, 110, 60]];          // dry steppe
const LUSH = [[1745, 935, 150, 135], [640, 1162, 190, 42], [140, 1275, 120, 80]];        // green river country

/* Places drawn only to fill out empty country. They are decoration: geography.js (and so the
   population, resource and war figures) knows nothing about them.
     towns      [x, y, size, region]  small towns with their own farmland, joined to the road network
     the rest   a river port, a hydroelectric dam and its reservoir, an air base, a solar farm */
const TOWNS = [
  [1690, 842, 4, "fiveRivers"], [1752, 1092, 3, "fiveRivers"], [1858, 1150, 3, "fiveRivers"], [1845, 805, 2, "fiveRivers"], [1620, 860, 2, "fiveRivers"],
  [470, 92, 4, "marbonese"], [692, 82, 3, "marbonese"], [565, 200, 3, "marbonese"], [640, 244, 2, "marbonese"], [430, 160, 2, "marbonese"], [790, 175, 2, "marbonese"],
];
const PORT = [1640, 925];                       // river port where the five streams meet
const RESERVOIR = [1912, 846, 17, 9], DAM = [[1893, 834], [1893, 858]];
const AIRBASE = [862, 142], SOLAR = [415, 238];

/* switched on and off by js/map/views.js */
export function setTerrain(v) {
  on = !!v;
  if (on && !built) build();
  svg.classList.toggle("terrain", on);
}

/* ---------- repeatable noise: gives edges and slopes a natural, uneven shape ---------- */
const hash = (x, y, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) { let amp = .5, f = 1, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += amp * noise(x * f, y * f, s + i * 17); n += amp; amp *= .5; f *= 2; } return t / n; }
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const ell = (e, x, y) => Math.hypot((x - e[0]) / e[2], (y - e[1]) / e[3]);
const num = v => +v.toFixed(1);

/* ---------- the relief: a grid over the map, one cell every 2 map units ----------
   For every cell: how high the land is, and how much it is mountain, hill, woodland,
   riverside or road. Painted once into two pictures (land colour, light and shadow). */
/* box blur of a grid field, across then down (used to soften the river valleys) */
function blur(A, r) {
  const T = new Float32Array(A.length), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 2; pass++) {
    const [len, lines, step, jump] = pass ? [GH, GW, GW, 1] : [GW, GH, 1, GW], src = pass ? T : A, dst = pass ? A : T;
    for (let l = 0; l < lines; l++) {
      const o = l * jump; let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + Math.min(len - 1, Math.max(0, i)) * step];
      for (let i = 0; i < len; i++) { dst[o + i * step] = acc * k; acc += src[o + Math.min(len - 1, i + r + 1) * step] - src[o + Math.max(0, i - r) * step]; }
    }
  }
}
/* how much a point is mountain, hill and woodland (0–1 each). The zones are plain ovals in
   the data; their drawn edges wander in and out. Shared by the relief and the road builder. */
function zones(x, y) {
  let da = 9, db = 9, dw = 9;
  for (const z of RANGES) da = Math.min(da, ell(z.e, x, y));
  for (const z of HILLS) db = Math.min(db, ell(z.e, x, y));
  for (const z of WOODS) dw = Math.min(dw, ell(z.e, x, y));
  const wob = da < 1.9 || db < 1.9 ? 1 + (fbm(x / 75, y / 75, 11, 3) - .5) * .8 : 1;
  return [da < 1.9 ? sstep(1.3, .35, da * wob) : 0, db < 1.9 ? sstep(1.25, .5, db * wob) : 0,
    dw < 1.6 ? sstep(1.1, .86, dw * (1 + (fbm(x / 48, y / 48, 12, 3) - .5) * .9)) : 0];
}

/* ---------- roads that follow the land ----------
   Each road of the network is routed across a coarse grid: easy over open country, harder through
   woods and hills, very hard over mountains (so roads find the passes), a toll at every river
   (so they cross it once, on a bridge), and never through a lake or the unmapped lands. */
const RC = 10, RW = Math.ceil((X1 - X0) / RC), RH = Math.ceil((Y1 - Y0) / RC);
function roadCosts(water, region, mtW = 22) {
  const cost = new Float32Array(RW * RH);
  for (let j = 0, i = 0; j < RH; j++) for (let k = 0; k < RW; k++, i++) {
    const x = X0 + (k + .5) * RC, y = Y0 + (j + .5) * RC, [a, b, w] = zones(x, y), reg = region(x, y);
    let c = 1 + mtW * a * a + 1.4 * b + 3 * w + (reg === "blight" ? 9 : reg === "jungle" ? 2.5 : reg === "desert" ? .8 : 0);
    if (reg === "unknown" || LAKES.some(([cx, cy, rx, ry]) => ((x - cx) / (rx + 8)) ** 2 + ((y - cy) / (ry + 8)) ** 2 < 1)) c = Infinity;
    if (Math.hypot(x - 640, y - 610) < 108) c += 25;                                         // keep clear of the compass rose
    cost[i] = c;
  }
  for (const wl of water) for (let n = 1; n < wl.length; n++) {                                // rivers: thick enough that no diagonal step slips through
    const a = wl[n - 1], b = wl[n], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    for (let t = 0; t <= m; t++) {
      const k = (a[0] + (b[0] - a[0]) * t / m - X0) / RC | 0, j = (a[1] + (b[1] - a[1]) * t / m - Y0) / RC | 0;
      for (const kk of [k, k + 1]) if (kk >= 0 && kk < RW && j >= 0 && j < RH && cost[j * RW + kk] < 40) cost[j * RW + kk] += 14;
    }
  }
  return cost;
}
/* the cheapest way across the grid from one capital to another (A* search), as points to smooth */
function route(cost, a, b) {
  const cell = p => [Math.min(RW - 1, Math.max(0, (p.x - X0) / RC | 0)), Math.min(RH - 1, Math.max(0, (p.y - Y0) / RC | 0))];
  const [sk, sj] = cell(a), [gk, gj] = cell(b), S = sj * RW + sk, T = gj * RW + gk, n = RW * RH;
  const g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), shut = new Uint8Array(n), heap = [];
  const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const H = i => Math.hypot(i % RW - gk, (i / RW | 0) - gj);
  const cs = i => (i === S || i === T ? 1 : cost[i]);
  g[S] = 0; push(S, H(S));
  while (heap.length) {
    const [, i] = pop(); if (shut[i]) continue; shut[i] = 1; if (i === T) break;
    const k = i % RW, j = i / RW | 0;
    for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      if (!dk && !dj) continue; const kk = k + dk, jj = j + dj; if (kk < 0 || jj < 0 || kk >= RW || jj >= RH) continue;
      const q = jj * RW + kk, c = cs(q); if (c === Infinity || shut[q]) continue;
      const ng = g[i] + (dk && dj ? 1.414 : 1) * (c + cs(i)) / 2;
      if (ng < g[q]) { g[q] = ng; from[q] = i; push(q, ng + H(q)); }
    }
  }
  if (S !== T && from[T] < 0) return null;
  const out = []; for (let i = T; i !== -1; i = from[i]) out.push([X0 + (i % RW + .5) * RC, Y0 + ((i / RW | 0) + .5) * RC]);
  out.reverse(); out[0] = [a.x, a.y]; out[out.length - 1] = [b.x, b.y];
  return out.filter((p, i) => i === 0 || i === out.length - 1 || i % 3 === 0);             // thin the grid steps out before smoothing
}

const G = 2, GW = Math.ceil((X1 - X0) / G), GH = Math.ceil((Y1 - Y0) / G);
function relief(waterD, lakeD, roadD, caps) {
  const n = GW * GH, F = { h: new Float32Array(n), mt: new Float32Array(n), hill: new Float32Array(n), wood: new Float32Array(n), wet: new Float32Array(n), road: new Float32Array(n) };
  const canvas = () => { const c = document.createElement("canvas"); c.width = GW; c.height = GH; return c; };
  // closeness to water (red) and to roads and towns (green): drawn as soft lines, then read back
  try {
    const x = canvas().getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#000"; x.fillRect(0, 0, GW, GH); x.setTransform(1 / G, 0, 0, 1 / G, -X0 / G, -Y0 / G);
    x.globalCompositeOperation = "lighter"; x.lineCap = x.lineJoin = "round";
    const rivers = new Path2D(waterD), lakes = new Path2D(lakeD);
    x.strokeStyle = x.fillStyle = "rgb(40,0,0)";
    for (const w of [96, 76, 58, 42, 28, 15]) { x.lineWidth = w; x.stroke(rivers); x.stroke(lakes); x.fill(lakes); }
    x.strokeStyle = x.fillStyle = "rgb(0,255,0)"; x.lineWidth = 15; x.stroke(new Path2D(roadD));
    for (const c of caps) { x.beginPath(); x.arc(c.x, c.y, c.small ? 24 : 32, 0, 6.3); x.fill(); }
    const d = x.getImageData(0, 0, GW, GH).data;
    for (let i = 0; i < n; i++) { F.wet[i] = Math.min(1, d[i * 4] / 235); F.road[i] = d[i * 4 + 1] / 255; }
    for (let p = 0; p < 3; p++) blur(F.wet, 5);                      // smooth the steps between the soft lines
  } catch { /* no canvas: the land is still drawn, just without river valleys */ }

  const px = new Uint8ClampedArray(n * 4);
  for (let j = 0, i = 0; j < GH; j++) for (let k = 0; k < GW; k++, i++) {
    const x = X0 + (k + .5) * G, y = Y0 + (j + .5) * G, wet = F.wet[i];
    const [a, b, w] = zones(x, y);
    // height: gently rolling everywhere, hills, then ridged mountains; flat beside water
    let h = (fbm(x / 240, y / 240, 2, 4) - .4) * .25;
    if (b) h += b * (.08 + .2 * fbm(x / 52, y / 52, 4, 3));
    if (a) { const r = 1 - Math.abs(2 * fbm(x / 90, y / 90, 6, 4) - 1); h += a * (.2 + .62 * r * r); }
    h *= 1 - .8 * wet;
    F.h[i] = h; F.mt[i] = a; F.hill[i] = b; F.wood[i] = w;

    // land colour: dry / grass / lush by how much water there is, then woodland floor, then height
    let m = fbm(x / 400, y / 400, 8, 3) + wet * .35;
    for (const e of DRY) m -= .3 * sstep(1.7, .2, ell(e, x, y));
    for (const e of LUSH) m += .3 * sstep(1.7, .2, ell(e, x, y));
    let t = m < .5 ? sstep(.26, .5, m) : sstep(.5, .78, m), r, g, bl;
    if (m < .5) { r = 226 + (207 - 226) * t; g = 219 + (220 - 219) * t; bl = 166 + (171 - 166) * t; }
    else { r = 207 + (183 - 207) * t; g = 220 + (216 - 220) * t; bl = 171 + (148 - 171) * t; }
    const to = (R2, G2, B2, q) => { r += (R2 - r) * q; g += (G2 - g) * q; bl += (B2 - bl) * q; };
    to(160, 196, 134, w * .8);
    to(217, 207, 159, sstep(.1, .3, h)); to(203, 184, 141, sstep(.3, .55, h)); to(185, 170, 144, sstep(.55, .8, h) * .8); to(240, 236, 226, sstep(.82, 1.05, h) * .8);
    const grain = 1 + (noise(x / 2.3, y / 2.3, 21) - .5) * .05;
    px[i * 4] = r * grain; px[i * 4 + 1] = g * grain; px[i * 4 + 2] = bl * grain; px[i * 4 + 3] = 255;
  }
  const out = { F, colour: null, shade: null };
  try {
    const c = canvas(), x = c.getContext("2d");
    x.putImageData(new ImageData(px, GW, GH), 0, 0); out.colour = c.toDataURL("image/jpeg", .9);
    // light from the north-west: slopes facing it are lightened, the far sides fall into shadow
    const sh = new Uint8ClampedArray(n * 4);
    for (let j = 0, i = 0; j < GH; j++) for (let k = 0; k < GW; k++, i++) {
      const s = Math.max(-1, Math.min(1, ((F.h[i + (k < GW - 1 ? 1 : 0)] - F.h[i - (k ? 1 : 0)]) + (F.h[i + (j < GH - 1 ? GW : 0)] - F.h[i - (j ? GW : 0)])) * 9));
      if (s > 0) { sh[i * 4] = 255; sh[i * 4 + 1] = 250; sh[i * 4 + 2] = 232; sh[i * 4 + 3] = Math.pow(s, .85) * 135; }
      else { sh[i * 4] = 58; sh[i * 4 + 1] = 44; sh[i * 4 + 2] = 26; sh[i * 4 + 3] = Math.pow(-s, .85) * 112; }
    }
    x.clearRect(0, 0, GW, GH); x.putImageData(new ImageData(sh, GW, GH), 0, 0); out.shade = c.toDataURL("image/png");
  } catch { /* no canvas: fall back to a flat land colour */ }
  return out;
}

function build() {
  built = true;
  const g = el("g", { class: "terrain", "pointer-events": "none", "clip-path": "url(#frameClip)" });
  gRegions.after(g);
  const frame = { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 };

  // 1. the land. Bottom to top: relief colours, the flat-coloured regions, light and shadow,
  //    then the unmapped lands, which stay blank. (Region shapes are added to r.els so they follow border edits.)
  const land = el("image", { ...frame, preserveAspectRatio: "none" }, g);
  const flat = id => { const r = byId[id]; if (r && r.els) r.els.push(el("path", { d: r.d, fill: BIOME[id], stroke: BIOME[id], "stroke-width": 1.2 }, g)); };
  ["desert", "blight", "jungle"].forEach(flat);
  const light = el("image", { ...frame, preserveAspectRatio: "none" }, g);
  flat("unknown");
  if (byId.marmite?.extra) el("path", { d: byId.marmite.extra.map(p => "M" + p.map(fmt).join("L") + "Z").join(""), fill: "#d6d8a6" }, g);   // the Marmite islands

  const pt = svg.createSVGPoint();
  const inside = (ids, x, y) => { pt.x = x; pt.y = y; return ids.some(id => regionPath[id] && regionPath[id].isPointInFill(pt)); };
  const blocked = (x, y) => Math.hypot(x - 640, y - 610) < 112 || LAKES.some(([cx, cy, rx, ry]) => ((x - cx) / (rx + 14)) ** 2 + ((y - cy) / (ry + 14)) ** 2 < 1)
    || ell(RESERVOIR, x, y) < 1.5 || (Math.abs(x - AIRBASE[0]) < 40 && Math.abs(y - AIRBASE[1]) < 26) || (Math.abs(x - SOLAR[0]) < 30 && Math.abs(y - SOLAR[1]) < 17);
  /* a jittered grid of points over a box (the whole map unless told otherwise), nearest the top first */
  function scatter({ box = [X0, Y0, X1, Y1], step, seed, keep }) {
    const rnd = rng(seed), out = [], [x0, y0, x1, y1] = box;
    for (let y = y0, row = 0; y <= y1; y += step * .8, row++) for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) {
      const px = num(x + (rnd() - .5) * step * .8), py = num(y + (rnd() - .5) * step * .7), k = rnd();
      if (px < X0 + 8 || px > X1 - 8 || py < Y0 + 12 || py > Y1 - 6 || blocked(px, py) || (keep && !keep(px, py, k))) continue;
      out.push([px, py, k]);
    }
    return out.sort((a, b) => a[1] - b[1]);
  }
  const oval = e => ({ box: [e[0] - e[2], e[1] - e[3], e[0] + e[2], e[1] + e[3]], keep: (x, y, k) => ell(e, x, y) ** 2 < 1 - k * .3 });

  // 2. rivers and lakes. Worked out first, because the relief is flattened and greened along them.
  /* a smooth curve through the given points, as a list of closely spaced points */
  const curve = (p, per = 8) => {
    const out = [];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], d = p[i + 2] || c, n = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / per));
      for (let t = 0; t < n; t++) { const s = t / n, s2 = s * s, s3 = s2 * s, q = v => .5 * (2 * b[v] + (c[v] - a[v]) * s + (2 * a[v] - 5 * b[v] + 4 * c[v] - d[v]) * s2 + (3 * b[v] - a[v] - 3 * c[v] + d[v]) * s3); out.push([q(0), q(1)]); }
    }
    out.push(p[p.length - 1]); return out;
  };
  /* add wandering bends between the given points (the points themselves stay put, so rivers still meet) */
  const meander = (p, amp, seed) => {
    const out = [p[0]]; let run = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.round(L / 22)), k = amp * Math.min(1, L / 70);
      for (let j = 1; j < n; j++) { const t = j / n, o = (fbm((run + L * t) / 48, seed * 3.7, 31, 2) - .5) * 3.2 * k * Math.sin(Math.PI * t); out.push([a[0] + dx * t - dy / L * o, a[1] + dy * t + dx / L * o]); }
      out.push(b); run += L;
    }
    return out;
  };
  /* the outline of a river that widens from w0 at its spring to w1 at its mouth */
  const ribbon = (c, w0, w1) => {
    let len = 0; const at = [0]; for (let i = 1; i < c.length; i++) at.push(len += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const L = [], Rt = [];
    c.forEach((p, i) => { const a = c[i - 1] || p, b = c[i + 1] || p, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, hw = (w0 + (w1 - w0) * Math.pow(at[i] / (len || 1), .8)) / 2; L.push(num(p[0] - dy / d * hw) + "," + num(p[1] + dx / d * hw)); Rt.push(num(p[0] + dy / d * hw) + "," + num(p[1] - dx / d * hw)); });
    return "M" + L.concat(Rt.reverse()).join("L") + "Z";
  };
  const water = [];                                                   // every river's centre line as drawn: for bridges and the relief
  let ribs = "";
  const river = (p, w0, w1) => { const c = curve(p); water.push(c); ribs += ribbon(c, w0, w1); };
  /* move the end of a tributary onto the river it runs into */
  const join = p => {
    const e = p[p.length - 1]; let best = null, bd = 40;
    for (const w of water) for (let i = 1; i < w.length; i++) { const a = w[i - 1], b = w[i], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((e[0] - a[0]) * dx + (e[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - e[0], q[1] - e[1]); if (d < bd) { bd = d; best = q; } }
    return best ? p.slice(0, -1).concat([best]) : p;
  };
  const gWu = el("g", {}), gWf = el("g", {});                         // dark outlines underneath, then the water itself
  // the River Marbon is the Marbonese–Elarion border itself (and follows it if the border is edited)
  for (const k of borderRiverArcs()) if (borderEls[k]) {
    const d = borderEls[k][0].getAttribute("d"); water.push(d.slice(1).split("L").map(s => s.split(",").map(Number)));
    borderEls[k].push(el("path", { d, class: "t-riv-u", "stroke-width": 10.5 }, gWu), el("path", { d, class: "t-riv", "stroke-width": 7.4 }, gWf));
  }
  // the five streams, their meeting, and the Long River, which widens all the way west
  river(meander(JOIN.concat(TRUNK.slice(1)), 9, 77), 2.3, 7.6);
  STREAMS.forEach((src, i) => river(meander(src.concat([JOIN[i]]), 4, 55 + i), .6, 2.3));
  const FROM = { 1: 2.6, 4: 1.6 };                                    // rivers that begin at another river's end, or at a lake
  RIVERS.forEach(([p, w], i) => { if (i < 5) river(meander(p, 4, 300 + i), FROM[i] || .6, 1.3 + 2.2 * w); });
  RIVERS.forEach(([p, w], i) => { if (i > 4) river(meander(join(p), 6, 300 + i), .6, 1 + 2 * w); });
  let lakes = "", ripples = "";
  LAKES.forEach(([cx, cy, rx, ry], i) => {
    const p = []; for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2, k = .8 + .42 * fbm(Math.cos(t) * 1.4 + 5, Math.sin(t) * 1.4 + 5, 9 + i, 2); p.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
    const shore = (s, from = 0, to = p.length) => { const q = p.map(v => [cx + (v[0] - cx) * s, cy + (v[1] - cy) * s]); return curve([q[q.length - 1], ...q, q[0], q[1]], 6).slice(8).filter((_, j, all) => j >= all.length * from && j <= all.length * to).map(v => num(v[0]) + "," + num(v[1])).join("L"); };
    lakes += "M" + shore(1) + "Z"; ripples += "M" + shore(.72, .08, .42) + "M" + shore(.5, .55, .8);
  });
  el("path", { d: ribs, class: "t-rib-u" }, gWu); el("path", { d: lakes, class: "t-rib-u" }, gWu);
  el("path", { d: ribs, class: "t-rib" }, gWf); el("path", { d: lakes, class: "t-rib" }, gWf); el("path", { d: ripples, class: "t-ripple" }, gWf);

  // roads join every capital, winding across the land (worked out before the relief, so forests and peaks leave them a way through).
  // Highways join two big cities; the rest are country roads. A bridge wherever a road crosses a river.
  const mids = [], net = roadNetwork(), routes = [], edges = [];
  const towns = TOWNS.filter(([x, y, , id]) => inside([id], x, y)).map(([x, y, level]) => ({ x, y, level, small: true, town: true }));
  let roads = "", bridges = "";
  {
    const regionAt = (x, y) => { pt.x = x; pt.y = y; for (const id of ["unknown", "blight", "jungle", "desert"]) if (regionPath[id] && regionPath[id].isPointInFill(pt)) return id; return ""; };
    const costs = roadCosts(water, regionAt);
    const cross = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (!d) return null; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, u = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] : null; };
    const addRoad = (a, b, village) => {
      const way = route(costs, a, b), pts = way && way.length > 2 ? curve(way, 6) : [[a.x, a.y], [b.x, b.y]];
      const d = "M" + pts.map(p => num(p[0]) + "," + num(p[1])).join("L"), major = !a.small && !b.small && Math.min(a.level, b.level) >= 5;
      routes.push({ d, major, pts }); roads += d; edges.push({ a, b });
      // a small town halfway along (by distance), set beside the road rather than on it
      let len = 0; const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const mi = Math.max(1, acc.findIndex(v => v >= len / 2)), p0 = pts[mi - 1], p1 = pts[mi], dl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      if (village) mids.push([p1[0] - (p1[1] - p0[1]) / dl * 9, p1[1] + (p1[0] - p0[0]) / dl * 9, len]);
      const done = [];
      for (let i = 1; i < pts.length; i++) for (const w of water) for (let j = 1; j < w.length; j++) {
        const hit = cross(pts[i - 1], pts[i], w[j - 1], w[j]); if (!hit || done.some(d => Math.hypot(d[0] - hit[0], d[1] - hit[1]) < 34)) continue; done.push(hit);
        const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), co = Math.cos(ang), si = Math.sin(ang), bw = major ? 4.4 : 3.4;
        const P = (u, v) => `${(hit[0] + u * co - v * si).toFixed(1)},${(hit[1] + u * si + v * co).toFixed(1)}`;
        bridges += `M${P(-10, -bw)}L${P(10, -bw)}L${P(10, bw)}L${P(-10, bw)}Z`;
      }
    };
    for (const { a, b } of net.edges) addRoad(a, b, true);
    // each extra town takes a road to the nearest place already on the network
    const linked = [...net.caps];
    for (const t of towns) { const near = linked.reduce((m, c) => (Math.hypot(c.x - t.x, c.y - t.y) < Math.hypot(m.x - t.x, m.y - t.y) ? c : m)); addRoad(near, t, false); linked.push(t); }
  }

  // railways join the big cities (level 6 and up), by the shortest network, avoiding steep ground even more than roads do
  const rails = [], railPts = [];
  {
    const big = net.caps.filter(c => !c.small && c.level >= 6), inTree = big.length ? [0] : [];
    const regionAt = (x, y) => { pt.x = x; pt.y = y; for (const id of ["unknown", "blight", "jungle", "desert"]) if (regionPath[id] && regionPath[id].isPointInFill(pt)) return id; return ""; };
    const costs = roadCosts(water, regionAt, 60);
    for (const r of routes) for (const p of r.pts) { const k = (p[0] - X0) / RC | 0, j = (p[1] - Y0) / RC | 0; if (k >= 0 && k < RW && j >= 0 && j < RH) costs[j * RW + k] += 1.2; }
    while (inTree.length < big.length) {
      let best = null;
      for (const i of inTree) for (let j = 0; j < big.length; j++) { if (inTree.includes(j)) continue; const dd = Math.hypot(big[i].x - big[j].x, big[i].y - big[j].y); if (!best || dd < best[2]) best = [i, j, dd]; }
      inTree.push(best[1]);
      const way = route(costs, big[best[0]], big[best[1]]); if (!way || way.length < 3) continue;
      const c2 = curve(way, 6); railPts.push(...c2); rails.push("M" + c2.map(p => num(p[0]) + "," + num(p[1])).join("L"));
    }
  }

  // 3. paint the relief, then put the water on it
  const { F, colour, shade } = relief(water.map(w => "M" + w.map(p => num(p[0]) + "," + num(p[1])).join("L")).join(""), lakes, roads, net.caps);
  if (colour) land.setAttribute("href", colour); else land.replaceWith(el("rect", { ...frame, fill: "#cfdcab" }));
  if (shade) light.setAttribute("href", shade); else light.remove();
  const at = (A, x, y) => A[Math.min(GH - 1, Math.max(0, (y - Y0) / G | 0)) * GW + Math.min(GW - 1, Math.max(0, (x - X0) / G | 0))];
  const peak = (x, y) => at(F.mt, x, y) > .3 && at(F.h, x, y) > .24 && at(F.wood, x, y) < .5;  // high enough to draw a mountain

  // cities: a built-up area round every capital, bigger for bigger cities, with a denser, darker downtown.
  // Then farmland round that: large modern fields lined up with the road out of town, some watered by
  // centre-pivot irrigation (the green circles), with lines of trees as windbreaks here and there.
  const farm = new Set(), fkey = (x, y) => Math.floor(x / 10) + "," + Math.floor(y / 10);
  const CROPS = [["wheat", 5], ["barley", 3], ["green", 4], ["pasture", 2], ["plough", 2], ["fallow", 1]];
  const crops = Object.fromEntries(CROPS.map(([k]) => [k, ""]));
  let furrows = "", breaks = "", pivots = "", urban = "", blocks = "", downtown = "", silos = "", ruinsD = "", rubble = "", craters = "";
  for (const [cx, cy, w, h] of [[AIRBASE[0], AIRBASE[1], 40, 26], [SOLAR[0], SOLAR[1], 30, 17]]) for (let x = cx - w; x <= cx + w; x += 10) for (let y = cy - h; y <= cy + h; y += 10) farm.add(fkey(x, y));
  const cityR = c => (c.small ? 10 : 14) + (c.level || 1) * (c.small ? 1.8 : 3.2);
  {
    const tot = CROPS.reduce((a, c) => a + c[1], 0), pick = v => { let a = v * tot; for (const [k, w] of CROPS) if ((a -= w) < 0) return k; return "wheat"; };
    const nearWater = (x, y, d) => water.some(w => w.some(p => Math.abs(p[0] - x) < d && Math.abs(p[1] - y) < d && Math.hypot(p[0] - x, p[1] - y) < d));
    net.caps.concat(towns).forEach((c, n) => {
      const rf = rng(200 + n), lvl = c.level || 1, Ru = cityR(c) * (c.town ? .8 : 1), ruined = !c.town && lvl <= 2;
      const e = edges.find(e => e.a === c || e.b === c), o = e && (e.a === c ? e.b : e.a);
      const ang = o ? Math.atan2(o.y - c.y, o.x - c.x) : rf() * Math.PI, co = Math.cos(ang), si = Math.sin(ang);
      const L = (u, v) => [c.x + u * co - v * si, c.y + u * si + v * co], P = (u, v) => { const q = L(u, v); return num(q[0]) + "," + num(q[1]); };
      // the built-up area: an uneven outline, filled with blocks on a street grid
      const edge = a => Ru * (.78 + .45 * fbm(Math.cos(a) * 1.6 + n * 5, Math.sin(a) * 1.6, 51, 3));
      const ring = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ring.push(L(Math.cos(a) * edge(a), Math.sin(a) * edge(a))); }
      const outline = "M" + curve([ring[ring.length - 1], ...ring, ring[0], ring[1]], 4).slice(4).map(q => num(q[0]) + "," + num(q[1])).join("L") + "Z";
      if (ruined) ruinsD += outline; else urban += outline;
      const bs = 4.4, R2 = Ru * 1.25;
      for (let v = -R2; v <= R2; v += bs) for (let u = -R2; u <= R2; u += bs) {
        const d = Math.hypot(u, v); if (d > edge(Math.atan2(v, u)) - 2.2 || rf() < (ruined ? .5 : .12)) continue;
        if (ruined) { const q = L(u, v), r2 = 1 + rf() * 1.4; rubble += `M${num(q[0] - r2)},${num(q[1])}l${num(r2 * .6)},${num(-r2)}l${num(r2 * 1.1)},${num(r2 * .3)}l${num(r2 * .3)},${num(r2 * .8)}Z`; continue; }
        const w = bs * (.3 + rf() * .14), h = bs * (.3 + rf() * .14), sq = `M${P(u - w, v - h)}L${P(u + w, v - h)}L${P(u + w, v + h)}L${P(u - w, v + h)}Z`;
        if (d < Ru * (.22 + lvl * .025)) downtown += sq; else blocks += sq;
      }
      for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) farm.add(fkey(c.x + gx * Ru * .6, c.y + gy * Ru * .6));
      if (ruined) for (let q = 0; q < 3; q++) { const a2 = rf() * 6.28, q2 = L(Math.cos(a2) * Ru * .7, Math.sin(a2) * Ru * .7), r2 = 2 + rf() * 2; craters += `M${num(q2[0] - r2)},${num(q2[1])}a${num(r2)},${num(r2 * .8)} 0 1,0 ${num(2 * r2)},0a${num(r2)},${num(r2 * .8)} 0 1,0 ${num(-2 * r2)},0`; }
      if (c.town) for (let q = 0; q < 3; q++) { const s2 = L(Ru + 2 + q * 3.4, Ru * .5); silos += `M${num(s2[0] - 1.6)},${num(s2[1])}a1.6,1.6 0 1,0 3.2,0a1.6,1.6 0 1,0 -3.2,0`; }
      // farmland beyond the city's edge
      if (inside(["desert", "blight", "unknown"], c.x, c.y)) return;
      const R0 = Ru + 4, R1 = R0 + (c.town ? 22 + lvl * 6 : 14 + lvl * (c.small ? 3 : 5));
      const cw = 17 + rf() * 4, ch = 12.5 + rf() * 3, nu = Math.ceil(R1 / cw) + 1, nv = Math.ceil(R1 / ch) + 1;
      for (let j = -nv; j <= nv; j++) {
        const shift = (rf() - .5) * cw * .5;
        for (let i = -nu; i <= nu; i++) {
          const u = i * cw + shift, v = j * ch, [x, y] = L(u, v), d = Math.hypot(u, v), a = Math.atan2(v, u);
          if (d < R0 || d > R1 * (.72 + .5 * fbm(Math.cos(a) * 1.3 + n * 7, Math.sin(a) * 1.3, 41, 2)) || rf() < (ruined ? .45 : .06)) continue;
          if (x < X0 + 10 || x > X1 - 10 || y < Y0 + 10 || y > Y1 - 10 || blocked(x, y) || farm.has(fkey(x, y))) continue;
          if (at(F.wood, x, y) > .3 || at(F.mt, x, y) > .3 || peak(x, y) || inside(WILD, x, y) || nearWater(x, y, 10)) continue;
          farm.add(fkey(x, y));
          const w = cw / 2 - .7, h = ch / 2 - .7, J = () => (rf() - .5) * .8;
          const sq = "M" + [[-w, -h], [w, -h], [w, h], [-w, h]].map(([p, q]) => P(u + p + J(), v + q + J())).join("L") + "Z";
          if (ruined) { crops[rf() < .75 ? "fallow" : "plough"] += sq; continue; }   // abandoned fields round a ruined city
          if (rf() < .2) {                                                          // centre-pivot irrigation: a green circle on dry ground
            crops.fallow += sq; const q = L(u, v), r = Math.min(w, h) - .3;
            pivots += `M${num(q[0] - r)},${num(q[1])}a${num(r)},${num(r)} 0 1,0 ${num(2 * r)},0a${num(r)},${num(r)} 0 1,0 ${num(-2 * r)},0`;
            furrows += `M${P(u, v)}L${P(u + r * .9, v)}`;
            continue;
          }
          const k = pick(rf()); crops[k] += sq;
          if (k !== "fallow" && k !== "pasture") {
            if ((i + j) & 1) for (let q = -h + 1.8; q < h - .8; q += 2.4) furrows += `M${P(u - w + .8, v + q)}L${P(u + w - .8, v + q)}`;
            else for (let q = -w + 1.8; q < w - .8; q += 2.6) furrows += `M${P(u + q, v - h + .8)}L${P(u + q, v + h - .8)}`;
          }
          if (rf() < .1) breaks += `M${P(u - cw / 2, v + ch / 2)}L${P(u + cw / 2, v + ch / 2)}`;   // a windbreak of trees
        }
      }
    });
  }

  // grass tufts give the open plains some texture (none on sand, dead ground, jungle, forest, farmland or high ground)
  { let t = ""; for (const [x, y] of scatter({ step: 58, seed: 7, keep: (x, y) => at(F.wood, x, y) < .2 && at(F.mt, x, y) < .15 && at(F.road, x, y) < .4 && !farm.has(fkey(x, y)) && !inside(WILD, x, y) })) t += `M${x - 3},${y}l1.5,-4M${x},${y}v-5.5M${x + 3},${y}l-1.5,-4`; el("path", { d: t, class: "t-tuft" }, g); }
  for (const [k] of CROPS) el("path", { d: crops[k], class: "t-f t-f-" + k }, g);
  el("path", { d: pivots, class: "t-pivot" }, g); el("path", { d: furrows, class: "t-furrow" }, g); el("path", { d: breaks, class: "t-hedge" }, g);
  g.append(gWu, gWf);
  el("path", { d: urban, class: "t-urban" }, g); el("path", { d: blocks, class: "t-block" }, g); el("path", { d: downtown, class: "t-block down" }, g); el("path", { d: silos, class: "t-silo" }, g);
  el("path", { d: ruinsD, class: "t-urban ruin" }, g); el("path", { d: craters, class: "t-crater" }, g); el("path", { d: rubble, class: "t-rubble" }, g);

  // the hydroelectric dam: a reservoir held back by a concrete wall, and a power station below it
  {
    const [cx, cy, rx, ry] = RESERVOIR, p = [];
    for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2, k = .82 + .35 * fbm(Math.cos(t) * 1.4 + 2, Math.sin(t) * 1.4, 61, 2); p.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
    el("path", { d: "M" + curve([p[p.length - 1], ...p, p[0], p[1]], 4).slice(4).map(q => num(q[0]) + "," + num(q[1])).join("L") + "Z", class: "t-lake" }, g);
    el("path", { d: `M${DAM[0]}L${DAM[1]}`, class: "t-dam" }, g);
    el("path", { d: `M${DAM[0][0] - 9},${DAM[1][1] - 2}h6v5h-6Z`, class: "t-town" }, g);
  }
  // the air base on the plains facing the Blight: a fenced field, a long runway, hangars and an apron
  {
    const [x, y] = AIRBASE;
    el("path", { d: `M${x - 36},${y - 22}h72v44h-72Z`, class: "t-base" }, g);
    el("path", { d: `M${x - 30},${y + 6}h60v6h-60Z`, class: "t-runway" }, g); el("path", { d: `M${x - 27},${y + 9}h54`, class: "t-runway-line" }, g);
    el("path", { d: `M${x - 26},${y - 16}h10v8h-10ZM${x - 12},${y - 16}h10v8h-10ZM${x + 2},${y - 16}h10v8h-10Z`, class: "t-hangar" }, g);
    el("path", { d: `M${x + 16},${y - 16}h14v14h-14Z`, class: "t-apron" }, g);
  }
  // the solar farm: rows of panels
  { const [x, y] = SOLAR; let d = ""; for (let r = -3; r <= 3; r++) for (let c = -5; c <= 5; c++) d += `M${x + c * 5 - 2},${y + r * 4.2 - 1.2}h4v2.4h-4Z`; el("path", { d, class: "t-solar" }, g); }
  // the river port where the five streams meet: quays and cranes
  { const [x, y] = PORT; el("path", { d: `M${x - 14},${y + 9}h28M${x - 10},${y + 9}v-4M${x},${y + 9}v-4M${x + 10},${y + 9}v-4`, class: "t-quay" }, g); el("path", { d: `M${x - 6},${y + 7}v-12h9M${x + 1},${y - 5}v4M${x + 8},${y + 7}v-10h-7`, class: "t-crane" }, g); }

  // railways, then roads (under the trees and mountains) and bridges: paved roads are white, motorways amber with a centre line
  const rail = rails.join("");
  el("path", { d: rail, class: "t-rail-u" }, g); el("path", { d: rail, class: "t-rail" }, g);
  const byKind = m => routes.filter(r => r.major === m).map(r => r.d).join("");
  el("path", { d: byKind(false), class: "t-road-edge" }, g); el("path", { d: byKind(true), class: "t-road-edge major" }, g);
  el("path", { d: byKind(false), class: "t-road" }, g); el("path", { d: byKind(true), class: "t-road major" }, g);
  el("path", { d: byKind(true), class: "t-road-line" }, g); el("path", { d: bridges, class: "t-bridge" }, g);

  // 4. symbols — each kind is a single path (or one per row), so the layer stays light to draw
  let d = "", d2 = "";
  // dunes over the whole desert: crescents with a shaded lee side, and a little blown sand between them
  for (const [x, y, k] of scatter({ box: [30, 30, 380, 320], step: 27, seed: 3, keep: (x, y) => inside(["desert"], x, y) && !peak(x, y) })) {
    const s = num(5 + k * 6);
    if (k < .22) { d2 += `M${x},${y}h.1M${x + 4},${y + 2.5}h.1M${x - 3.5},${y + 3}h.1`; continue; }
    d += `M${x - s},${y}Q${x},${num(y - s * .95)} ${x + s},${y}Q${num(x + s * .25)},${num(y - s * .3)} ${x - s},${y}Z`;
  }
  el("path", { d, class: "t-dune" }, g); el("path", { d: d2, class: "t-sand" }, g);
  // dead ground in the Blight
  d = ""; for (const [x, y, k] of scatter({ box: [927, 30, 1683, 280], step: 34, seed: 5, keep: (x, y) => inside(["blight"], x, y) && !peak(x, y) })) { if (Math.hypot(x - 1215, y - 110) < 46) continue; d += k > .5 ? `M${x},${y}v-8M${x},${y - 4}l-3.5,-3.5M${x},${y - 5.5}l3.5,-3` : `M${x - 3},${y - 3}l6,6M${x + 3},${y - 3}l-6,6`; }
  el("path", { d, class: "t-dead" }, g);
  // hills: low rounded rises wherever the ground is high but not mountain, hatched on the shadow side
  d = ""; for (const [x, y, k] of scatter({ step: 38, seed: 20, keep: (x, y) => (at(F.hill, x, y) > .35 || at(F.mt, x, y) > .05) && !peak(x, y) && at(F.wood, x, y) < .3 && at(F.wet, x, y) < .5 && at(F.road, x, y) < .5 && !inside(WILD, x, y) })) {
    const s = num(6 + k * 6); d += `M${x - s},${y}Q${x},${num(y - s * 1.25)} ${x + s},${y}M${num(x + s * .3)},${num(y - s * .5)}l${num(s * .2)},${num(s * .3)}M${num(x + s * .55)},${num(y - s * .26)}l${num(s * .13)},${num(s * .2)}`;
  }
  el("path", { d, class: "t-hill" }, g);

  // woods (leafy crowns), pine forest (pointed) and jungle. Trees thin out towards the edge of a wood, keep
  // clear of rivers, roads and towns, and are drawn row by row from the back so nearer trees overlap those behind.
  {
    const rows = {}, add = (y, kind, s) => { const r = rows[Math.round(y / 8)] || (rows[Math.round(y / 8)] = {}); r[kind] = (r[kind] || "") + s; };
    let shadow = "", glint = "", dark = "";
    const leafy = (x, y, r, kind) => {
      r = num(r); const a = num(r * .6);
      add(y, kind, `M${num(x - r)},${y}a${a},${a} 0 0 1 ${num(r * .55)},${num(-r * .95)}a${num(r * .62)},${num(r * .62)} 0 0 1 ${num(r * .95)},${num(r * .05)}a${a},${a} 0 0 1 ${num(r * .5)},${num(r * .9)}Z`);
      shadow += `M${num(x - r * .7)},${num(y + .4)}a${r},${num(r * .42)} 0 1 0 ${num(r * 2)},0a${r},${num(r * .42)} 0 1 0 ${num(-r * 2)},0`;
      glint += `M${num(x - r * .62)},${num(y - r * .5)}a${num(r * .5)},${num(r * .5)} 0 0 1 ${num(r * .55)},${num(-r * .42)}`;
    };
    const pine = (x, y, s) => {
      s = num(s); const top = num(y - s * 2.3), mid = num(y - s * .9);
      add(y, "t-pine", `M${num(x - s)},${num(y + 2)}L${num(x - s * .22)},${mid}L${num(x - s * .68)},${mid}L${x},${top}L${num(x + s * .68)},${mid}L${num(x + s * .22)},${mid}L${num(x + s)},${num(y + 2)}Z`);
      shadow += `M${num(x - s * .5)},${num(y + 2.2)}a${s},${num(s * .4)} 0 1 0 ${num(s * 2)},0a${s},${num(s * .4)} 0 1 0 ${num(-s * 2)},0`;
      dark += `M${x},${top}L${num(x + s * .68)},${mid}L${x},${mid}Z`;
    };
    for (const [x, y, k] of scatter({ step: 13, seed: 40, keep: (x, y, k) => at(F.wood, x, y) > .22 + k * .5 && at(F.wet, x, y) < .55 && at(F.road, x, y) < .5 && !peak(x, y) && !inside(WILD, x, y) })) {
      const z = WOODS.reduce((m, w) => (ell(w.e, x, y) < ell(m.e, x, y) ? w : m)), odd = hash(x | 0, y | 0, 5) < .09;      // a few of the other kind mixed in
      if (!!z.pine !== odd) pine(x, y, 3.3 + k * 1.9); else leafy(x, y, 3.9 + k * 2.5, "t-wood");
    }
    for (const [x, y, k] of scatter({ box: [1632, 433, 1970, 728], step: 13.5, seed: 60, keep: (x, y) => inside(["jungle"], x, y) && at(F.road, x, y) < .5 && at(F.wet, x, y) < .6 })) leafy(x, y, 4.6 + k * 3, "t-jungle");
    // trees along the banks of the Five Rivers
    for (const [x, y, k] of scatter({ box: [1579, 674, 1970, 1190], step: 11, seed: 66, keep: (x, y, k) => k < .55 && at(F.wet, x, y) > .5 && at(F.wet, x, y) < .86 && !farm.has(fkey(x, y)) && at(F.road, x, y) < .4 && !peak(x, y) && inside(["fiveRivers"], x, y) })) leafy(x, y, 3.4 + k * 2, "t-wood");
    el("path", { d: shadow, class: "t-shadow" }, g);
    Object.keys(rows).sort((p, q) => p - q).forEach(k => { for (const kind in rows[k]) el("path", { d: rows[k][kind], class: kind }, g); });
    el("path", { d: glint, class: "t-glint" }, g); el("path", { d: dark, class: "t-pine-dark" }, g);
  }

  // mountains: peaks stand where the relief is highest, so they run along the ridges, big in the heart of a
  // range and small at its edges, and leave the passes open for roads. Drawn row by row from the back.
  {
    const rows = {};
    for (const [x, y, k] of scatter({ step: 25, seed: 80, keep: (x, y) => peak(x, y) && at(F.road, x, y) < .5 && !inside(["unknown"], x, y) })) {
      const q = rng((x * 131 + y * 71) | 0), sz = 7 + k * 4 + Math.min(1, (at(F.h, x, y) - .24) / .55) * 13, H = sz * (1.2 + q() * .35);
      const r = rows[Math.round(y / 9)] || (rows[Math.round(y / 9)] = { face: "", shadow: "", snow: "", snowSh: "", line: "" });
      const ax = num(x + (q() - .5) * sz * .5), ay = num(y - H), lx = num(x - sz), rx = num(x + sz);                    // summit and the two feet
      const s1 = `${num(ax + sz * .16)},${num(y - H * .58)}`, s2 = `${num(ax - sz * .04)},${num(y - H * .3)}`, s3 = `${num(x + sz * .2)},${y}`;   // the crooked spur between light and shadow
      r.face += `M${lx},${y}L${ax},${ay}L${s1}L${s2}L${s3}Z`;
      r.shadow += `M${ax},${ay}L${rx},${y}L${s3}L${s2}L${s1}Z`;
      r.line += `M${lx},${y}L${ax},${ay}L${rx},${y}M${ax},${ay}L${s1}L${s2}M${num(x - sz * .52)},${num(y - H * .2)}L${num(x - sz * .3)},${num(y - H * .42)}`;
      if (sz > 15) {
        const sl = `${num(ax + (lx - ax) * .36)},${num(ay + H * .36)}`, sr = `${num(ax + (rx - ax) * .36)},${num(ay + H * .36)}`, m = `${num(ax + sz * .11)},${num(ay + H * .27)}`;
        r.snow += `M${sl}L${ax},${ay}L${sr}L${m}L${num(ax + sz * .02)},${num(ay + H * .41)}L${num(ax - sz * .13)},${num(ay + H * .28)}Z`;
        r.snowSh += `M${ax},${ay}L${sr}L${m}Z`;
      }
    }
    Object.keys(rows).sort((p, q) => p - q).forEach(k => { const r = rows[k]; el("path", { d: r.face, class: "t-mt-face" }, g); el("path", { d: r.shadow, class: "t-mt-shadow" }, g); if (r.snow) { el("path", { d: r.snow, class: "t-snow" }, g); el("path", { d: r.snowSh, class: "t-snow-sh" }, g); } el("path", { d: r.line, class: "t-mt-line" }, g); });
  }

  // 5. small details that make the land feel lived in
  // power lines from the dam to the capital, the port and the river towns: a line of pylons
  {
    let line = "", pyl = "";
    const ends = [DAM[0], [1942, 727], PORT, ...towns.filter(t => t.x > 1500).map(t => [t.x, t.y])], from = [DAM[0][0] - 6, DAM[0][1] + 8];
    for (const e2 of ends.slice(1)) {
      const L2 = Math.hypot(e2[0] - from[0], e2[1] - from[1]), n2 = Math.max(1, Math.round(L2 / 16));
      line += `M${num(from[0])},${num(from[1])}L${num(e2[0])},${num(e2[1])}`;
      for (let i = 1; i < n2; i++) { const x = from[0] + (e2[0] - from[0]) * i / n2, y = from[1] + (e2[1] - from[1]) * i / n2; pyl += `M${num(x - 1.8)},${num(y + 2)}L${num(x)},${num(y - 2.6)}L${num(x + 1.8)},${num(y + 2)}M${num(x - 2.2)},${num(y - 1.2)}h4.4`; }
    }
    el("path", { d: line, class: "t-power" }, g); el("path", { d: pyl, class: "t-pylon" }, g);
  }
  { let d3 = ""; for (const t of towns) d3 += `M${t.x - 3.2},${t.y}a3.2,3.2 0 1,0 6.4,0a3.2,3.2 0 1,0 -6.4,0`; el("path", { d: d3, class: "t-town-dot" }, g); }

  // small towns: a cluster of buildings beside each longer road, halfway along
  { let t = ""; for (let [x, y, L] of mids) { if (L < 90 || blocked(x, y)) continue; x = num(x); y = num(y); t += `M${x - 5},${y - 1}h4v4h-4ZM${x},${y - 4}h4.5v7h-4.5ZM${x + 5.5},${y}h3.5v3h-3.5ZM${x - 2},${y + 4}h5v3h-5Z`; } el("path", { d: t, class: "t-town" }, g); }
  // airports beside the metropolises: two crossing runways, set just outside the city
  {
    let rw = "", line = "";
    net.caps.filter(c => !c.small && c.level >= 9).forEach((c, n) => {
      const Ru = cityR(c);
      for (let k = 0; k < 16; k++) {
        const a = n * 1.3 + k * Math.PI / 8, x = c.x + Math.cos(a) * (Ru + 15), y = c.y + Math.sin(a) * (Ru + 15);
        if (x < X0 + 20 || x > X1 - 20 || y < Y0 + 20 || y > Y1 - 20 || blocked(x, y) || at(F.wet, x, y) > .85 || at(F.mt, x, y) > .2 || inside(["unknown", "blight"], x, y)) continue;
        if (routes.some(r => r.pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 15)) || railPts.some(p => Math.hypot(p[0] - x, p[1] - y) < 15)) continue;
        const strip = (ang, len, wd) => { const co = Math.cos(ang), si = Math.sin(ang), P = (u, v) => `${num(x + u * co - v * si)},${num(y + u * si + v * co)}`; rw += `M${P(-len, -wd)}L${P(len, -wd)}L${P(len, wd)}L${P(-len, wd)}Z`; line += `M${P(-len + 2, 0)}L${P(len - 2, 0)}`; };
        strip(a + .5, 13, 1.8); strip(a - .45, 9.5, 1.5);
        break;
      }
    });
    el("path", { d: rw, class: "t-runway" }, g); el("path", { d: line, class: "t-runway-line" }, g);
  }
  // wind farms on the open hills
  {
    let d3 = "";
    for (const [x, y] of scatter({ step: 64, seed: 91, keep: (x, y, k) => k < .45 && at(F.hill, x, y) > .5 && at(F.mt, x, y) < .1 && at(F.wood, x, y) < .2 && at(F.road, x, y) < .4 && !farm.has(fkey(x, y)) && !inside(WILD, x, y) }))
      for (const [ox, oy] of [[0, 0], [8, 3], [-7, 4]]) { const X = num(x + ox), Y = num(y + oy); d3 += `M${X},${Y}v-11M${X},${num(Y - 11)}l0,-6M${X},${num(Y - 11)}l5.2,3M${X},${num(Y - 11)}l-5.2,3`; }
    el("path", { d: d3, class: "t-wind" }, g);
  }
  // mines: dark tunnel mouths in the mountains (this is where the ore comes from)
  d = ""; [[1180, 322], [1405, 304], [250, 334], [472, 1080], [1212, 1322], [1926, 885]].forEach(([x, y]) => { d += `M${x - 5},${y}v-5a5,5 0 0 1 10,0v5Z`; });
  el("path", { d, class: "t-mine" }, g);
  // marsh: reeds in a ring around each lake and where the Long River leaves the map
  d = ""; [[300, 1180, 88, 42], [1040, 655, 84, 38], [705, 285, 90, 40], [95, 1305, 62, 40]].forEach((e, i) => { for (const [x, y] of scatter({ ...oval(e), step: 21, seed: 120 + i })) d += `M${x - 5},${y}h10M${x - 3},${y}v-4M${x},${y}v-6.5M${x + 3},${y}v-4`; });
  el("path", { d, class: "t-marsh" }, g);
  // the desert: cacti, one oasis with palm trees, and the oil fields (where the world's oil comes from)
  d = ""; for (const [x, y] of scatter({ box: [30, 30, 380, 320], step: 66, seed: 9, keep: (x, y) => inside(["desert"], x, y) && !peak(x, y) })) { if (Math.hypot(x - 255, y - 172) < 40) continue; d += `M${x},${y}v-10M${x - 3.5},${y - 3}v-3.5M${x - 3.5},${y - 3}h3.5M${x + 3.5},${y - 5}v-3M${x + 3.5},${y - 5}h-3.5`; }
  el("path", { d, class: "t-cactus" }, g);
  d = ""; for (const [x, y] of scatter({ box: [30, 30, 380, 320], step: 58, seed: 17, keep: (x, y, k) => k < .5 && inside(["desert"], x, y) && !peak(x, y) && Math.hypot(x - 255, y - 172) > 50 && at(F.road, x, y) < .4 && !farm.has(fkey(x, y)) })) {
    d += `M${x - 7},${y}h14M${x - 4},${y}L${x},${y - 8}L${x + 4},${y}M${x - 8},${y - 9}L${x + 7},${y - 7}M${x + 7},${y - 7}q2.5,2 0,5M${x - 7},${y - 9}v4`;
  }
  el("path", { d, class: "t-pump" }, g);
  el("ellipse", { cx: 255, cy: 172, rx: 17, ry: 8, class: "t-lake" }, g);
  d = ""; [[234, 170], [276, 168], [262, 186]].forEach(([x, y]) => { d += `M${x},${y}q1.5,-6 0,-11M${x},${y - 11}q-6,-3 -9,2M${x},${y - 11}q6,-3 9,2M${x},${y - 11}q-3,-6 -8,-5M${x},${y - 11}q3,-6 8,-5`; });
  el("path", { d, class: "t-palm" }, g);
  // the Blight: toxic pools, the ruins of what stood there before, and a smoking volcano
  [[1100, 112, 20, 9], [1300, 152, 16, 7], [1490, 96, 22, 9], [1010, 70, 15, 6], [1570, 190, 14, 6]].forEach(([x, y, rx, ry]) => { if (inside(["blight"], x, y)) el("ellipse", { cx: x, cy: y, rx, ry, class: "t-toxic" }, g); });
  d = ""; [[1045, 172], [1420, 178], [1560, 120]].forEach(([x, y]) => { if (inside(["blight"], x, y)) d += `M${x - 8},${y}h16M${x - 5},${y}v-9M${x},${y}v-5.5M${x + 5},${y}v-11M${x + 3},${y - 11}h4`; });
  el("path", { d, class: "t-ruin" }, g);
  const name = (t, x, y, cls = "", anchor = "middle") => { el("text", { x, y, class: "t-name " + cls, "text-anchor": anchor }, g).textContent = t; };
  if (inside(["blight"], 1215, 128)) {
    const x = 1215, y = 128;
    [[x + 2, y - 38, 5], [x + 8, y - 47, 6.5], [x + 3, y - 58, 8.5]].forEach(([cx, cy, r]) => el("circle", { cx, cy, r, class: "t-smoke" }, g));
    el("path", { d: `M${x - 27},${y}L${x - 7},${y - 30}L${x + 7},${y - 30}L${x + 27},${y}Z`, class: "t-volcano" }, g);
    el("path", { d: `M${x - 6},${y - 30}L${x - 3},${y - 17}L${x + 1},${y - 23}L${x + 4},${y - 12}L${x + 6},${y - 30}Z`, class: "t-lava" }, g);
    name("Mount Cinder", x, y + 13);
  }
  // watchtowers: the neighbours keep a line of towers along the edge of the Blight
  {
    let towers = "";
    for (const k in owners) {
      if (!owners[k].has("blight") || owners[k].has("unknown") || owners[k].size < 2 || !borderEls[k]) continue;
      const pts = borderEls[k][0].getAttribute("d").slice(1).split("L").map(s => s.split(",").map(Number)); let run = 40;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); run += L; if (run < 88 || !L) continue; run = 0;
        const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, s = inside(["blight"], b[0] + nx * 10, b[1] + ny * 10) ? -1 : 1, x = +(b[0] + nx * 10 * s).toFixed(1), y = +(b[1] + ny * 10 * s + 4).toFixed(1);
        towers += `M${x - 2.5},${y}v-8h5v8ZM${x - 4},${y - 8}h8v-3h-2v1.2h-1.4v-1.2h-1.2v1.2h-1.4v-1.2h-2Z`;
      }
    }
    el("path", { d: towers, class: "t-tower" }, g);
  }

  // 6. names of the landscape (the same names are used in each nation's dossier)
  name("Marbon Plains", 350, 585, "land"); name("Elar Downs", 1335, 652, "land");
  name("Blightwall Mountains", 1310, 388); name("Dune Rim", 300, 372); name("Shero Peaks", 430, 1132); name("Axis Ridge", 1335, 1334);
  name("Sunrise Mts", 1962, 1152, "", "end");
  name("Greatwood", 850, 262, "wood"); name("Teddy Woods", 385, 868, "wood");
  name("River Marbon", 832, 592, "water", "end"); name("The Long River", 610, 1141, "water");
  name("Oasis", 255, 198, "water"); name("Sunrise Dam", 1885, 880, "water", "end"); name("River Port", PORT[0] - 4, PORT[1] - 12, "water");
  name("Northern Wheatlands", 600, 140, "land");
  name("Northern Air Base", AIRBASE[0], AIRBASE[1] + 38); name("Solar farm", SOLAR[0], SOLAR[1] + 30); name("Lake Marbon", 705, 322, "water"); name("Elar Mere", 1040, 690, "water"); name("Lake Baloon", 300, 1213, "water");
}
