/* ==========================================================================
   TERRAIN VIEW — an optional second look at the same map.
   The political map is not touched: this draws one extra layer (land colours,
   mountains, hills, forests, dunes, rivers, lakes, roads, villages…) that sits
   over the nation colours and is only shown while the Terrain view is on.
   Borders, labels, capitals and tapping a nation all work exactly as before.

   Where everything is comes from js/map/geography.js, which the population,
   resource and war figures read too. The layer is built the first time the
   view is opened, so it costs nothing until then.
   ========================================================================== */
import { R, owners } from "../model.js";
import { svg, el, gRegions, regionPath, borderEls, X0, X1, Y0, Y1, fmt } from "./engine.js";
import { rng, RANGES, HILLS, WOODS, LAKES, JOIN, TRUNK, STREAMS, RIVERS, borderRiverArcs, roadNetwork } from "./geography.js";

let built = false, on = false;
export const terrainOn = () => on;

/* land colour of each region; everything else is grassland */
const GRASS = "#cfdcab";
const BIOME = {
  desert: "#ecd9a6", blight: "#b3b396", unknown: "#e6e2d8", jungle: "#a5c788", marmite: "#d6d2a2", elarion: "#d9dba8",
  fiveRivers: "#c0dba8", rivrep: "#c0dba8", sherolean: "#c8dba6", baloonia: "#d3dfa2", maxis: "#dcd8a6", axis: "#dcd8a6",
};

/* switched on and off by js/map/views.js */
export function setTerrain(v) {
  on = !!v;
  if (on && !built) build();
  svg.classList.toggle("terrain", on);
}

function build() {
  built = true;
  const grad = (id, c0, c1, o = .9) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c0}" stop-opacity="${o}"/><stop offset=".62" stop-color="${c1}" stop-opacity="${o * .6}"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>`;
  el("defs", {}, svg).innerHTML = grad("tHigh", "#cdb98c", "#d8c99c", .95) + grad("tWood", "#9cc083", "#a9c98e") + grad("tDry", "#e3d49a", "#e0d5a2", .8) + grad("tLush", "#b0d98c", "#b9dc96", .8);
  const g = el("g", { class: "terrain", "pointer-events": "none", "clip-path": "url(#frameClip)" });
  gRegions.after(g);

  // 1. land colours, region by region (added to r.els so they follow border edits)
  const order = R.filter(r => !r.kind && r.id !== "marmite").concat(R.filter(r => r.id === "marmite"));
  for (const r of order) { const c = BIOME[r.id] || GRASS; r.els.push(el("path", { d: r.d, fill: c, stroke: c, "stroke-width": 1.2 }, g)); }

  const pt = svg.createSVGPoint();
  const inside = (ids, x, y) => { pt.x = x; pt.y = y; return ids.some(id => regionPath[id] && regionPath[id].isPointInFill(pt)); };
  const blocked = (x, y) => Math.hypot(x - 640, y - 610) < 112 || LAKES.some(([cx, cy, rx, ry]) => ((x - cx) / (rx + 14)) ** 2 + ((y - cy) / (ry + 14)) ** 2 < 1);
  /* jittered grid of points inside an ellipse and/or a set of regions */
  function scatter({ e, box, ids, step, seed }) {
    const rnd = rng(seed), out = [];
    const [x0, y0, x1, y1] = box || [e[0] - e[2], e[1] - e[3], e[0] + e[2], e[1] + e[3]];
    for (let y = y0, row = 0; y <= y1; y += step * .8, row++) for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1; x += step) {
      const px = x + (rnd() - .5) * step * .7, py = y + (rnd() - .5) * step * .6, k = rnd();
      if (px < X0 + 8 || px > X1 - 8 || py < Y0 + 12 || py > Y1 - 6 || blocked(px, py)) continue;
      if (e && ((px - e[0]) / e[2]) ** 2 + ((py - e[1]) / e[3]) ** 2 > 1 - k * .3) continue;
      if (ids && !inside(ids, px, py)) continue;
      out.push([+px.toFixed(1), +py.toFixed(1), k]);
    }
    return out.sort((a, b) => a[1] - b[1]);
  }
  const blob = (e, fill, grow = 1.25) => el("ellipse", { cx: e[0], cy: e[1], rx: e[2] * grow, ry: e[3] * grow * 1.15, fill: `url(#${fill})` }, g);

  // grass tufts give the open plains some texture (none on sand, dead ground, jungle or unmapped land)
  { let t = ""; for (const [x, y] of scatter({ box: [X0, Y0, X1, Y1], step: 62, seed: 7 })) { if (inside(["desert", "blight", "unknown", "jungle"], x, y)) continue; t += `M${x - 3},${y}l1.5,-4M${x},${y}v-5.5M${x + 3},${y}l-1.5,-4`; } el("path", { d: t, class: "t-tuft" }, g); }

  // 2. soft colour washes: dry steppe, lush river country, high ground, woodland
  [[185, 545, 150, 62], [1470, 1255, 120, 70], [560, 480, 110, 60]].forEach(e => blob(e, "tDry", 1));
  [[1745, 935, 150, 135], [640, 1162, 190, 42], [140, 1275, 120, 80]].forEach(e => blob(e, "tLush", 1));
  RANGES.forEach(z => blob(z.e, "tHigh"));
  WOODS.forEach(z => blob(z.e, "tWood", 1.1));

  // 3. rivers and lakes
  const smooth = p => { let d = "M" + fmt(p[0]); for (let i = 0; i < p.length - 1; i++) { const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e2 = p[i + 2] || c; d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e2[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e2[1] - b[1]) / 6).toFixed(1)} ${fmt(c)}`; } return d; };
  const gW = el("g", { class: "t-water" }, g), water = [];            // water: every river as drawn, for placing bridges
  const river = (p, w = 1) => { const d = smooth(p); water.push(p); el("path", { d, class: "t-riv-u", "stroke-width": 5 * w }, gW); el("path", { d, class: "t-riv", "stroke-width": 2.6 * w }, gW); };
  // the River Marbon is the Marbonese–Elarion border itself (and follows it if the border is edited)
  for (const k of borderRiverArcs()) if (borderEls[k]) {
    const d = borderEls[k][0].getAttribute("d"); water.push(d.slice(1).split("L").map(s => s.split(",").map(Number)));
    borderEls[k].push(el("path", { d, class: "t-riv-u", "stroke-width": 9 }, gW), el("path", { d, class: "t-riv", "stroke-width": 5.5 }, gW));
  }
  /* add gentle bends between the given points so a river doesn't look ruled */
  const meander = (p, amp, seed) => {
    const rnd = rng(seed), out = [p[0]];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.round(L / 55));
      for (let j = 1; j < n; j++) { const t = j / n, o = (rnd() - .5) * 2 * amp * (j % 2 ? 1 : -1); out.push([+(a[0] + dx * t - dy / L * o).toFixed(1), +(a[1] + dy * t + dx / L * o).toFixed(1)]); }
      out.push(b);
    }
    return out;
  };
  // the five streams, their meeting, and the Long River, which widens as it goes west
  STREAMS.forEach((src, i) => river(meander(src.concat([JOIN[i]]), 7, 55 + i), .7));
  river(JOIN, .9);
  const trunk = meander(TRUNK, 9, 77), cut = n => trunk.slice(Math.floor(trunk.length * n));
  gW.insertBefore(el("path", { d: smooth(trunk), class: "t-bank" }), gW.firstChild);   // green, fertile banks
  river(trunk, 1.15); [[.3, 1.45], [.6, 1.75], [.82, 2]].forEach(([n, w]) => { const d = smooth(cut(n)); el("path", { d, class: "t-riv-u", "stroke-width": 5 * w }, gW); el("path", { d, class: "t-riv", "stroke-width": 2.6 * w }, gW); });
  RIVERS.forEach(([p, w], i) => river(i > 4 ? meander(p, 5, 300 + i) : p, w));
  LAKES.forEach(([cx, cy, rx, ry], i) => { const r2 = rng(9 + i), p = []; for (let a = 0; a < 10; a++) { const t = a / 10 * Math.PI * 2, k = .8 + r2() * .4; p.push([+(cx + Math.cos(t) * rx * k).toFixed(1), +(cy + Math.sin(t) * ry * k).toFixed(1)]); } p.push(p[0]); el("path", { d: smooth(p) + "Z", class: "t-lake" }, gW); });

  // roads join every capital (drawn under the trees and mountains), with a bridge wherever one crosses a river
  const mids = [], net = roadNetwork();
  {
    let roads = "", bridges = "";
    const cross = (p, q, a, b) => { const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]); if (!d) return null; const t = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d, u = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] : null; };
    for (const { a, b, L, bow } of net.edges) {
      const cx = (a.x + b.x) / 2 - (b.y - a.y) / L * bow, cy = (a.y + b.y) / 2 + (b.x - a.x) / L * bow;
      roads += `M${a.x},${a.y}Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x},${b.y}`;
      mids.push([(a.x + b.x) / 2 - (b.y - a.y) / L * bow * .5, (a.y + b.y) / 2 + (b.x - a.x) / L * bow * .5, L]);
      const pts = []; for (let t = 0; t <= 24; t++) { const s = t / 24; pts.push([(1 - s) * (1 - s) * a.x + 2 * s * (1 - s) * cx + s * s * b.x, (1 - s) * (1 - s) * a.y + 2 * s * (1 - s) * cy + s * s * b.y]); }
      const done = [];
      for (let i = 1; i < pts.length; i++) for (const w of water) for (let j = 1; j < w.length; j++) {
        const hit = cross(pts[i - 1], pts[i], w[j - 1], w[j]); if (!hit || done.some(d => Math.hypot(d[0] - hit[0], d[1] - hit[1]) < 34)) continue; done.push(hit);
        const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), co = Math.cos(ang), si = Math.sin(ang), P = (u, v) => `${(hit[0] + u * co - v * si).toFixed(1)},${(hit[1] + u * si + v * co).toFixed(1)}`;
        bridges += `M${P(-8, -3)}L${P(8, -3)}L${P(8, 3)}L${P(-8, 3)}Z`;
      }
    }
    el("path", { d: roads, class: "t-road-u" }, g); el("path", { d: roads, class: "t-road" }, g); el("path", { d: bridges, class: "t-bridge" }, g);
    // farmland: small ploughed fields around every capital (more around the big ones)
    let fields = "", furrows = "";
    net.caps.forEach((c, n) => {
      const rf = rng(200 + n);
      for (let q = 0; q < (c.small ? 3 : 6); q++) {
        const ang = rf() * 6.283, dist = 27 + rf() * 22, fx = c.x + Math.cos(ang) * dist, fy = c.y + Math.sin(ang) * dist * .8, w = 7 + rf() * 4, h = 4 + rf() * 2.5, rot = (rf() - .5) * 1.2;
        if (fx < X0 + 14 || fx > X1 - 14 || fy < Y0 + 14 || fy > Y1 - 14 || blocked(fx, fy) || inside(["desert", "blight", "unknown"], fx, fy)) continue;
        const co = Math.cos(rot), si = Math.sin(rot), P = (u, v) => `${(fx + u * co - v * si).toFixed(1)},${(fy + u * si + v * co).toFixed(1)}`;
        fields += `M${P(-w, -h)}L${P(w, -h)}L${P(w, h)}L${P(-w, h)}Z`;
        for (const v of [-h / 3, h / 3]) furrows += `M${P(-w, v)}L${P(w, v)}`;
      }
    });
    el("path", { d: fields, class: "t-field" }, g); el("path", { d: furrows, class: "t-furrow" }, g);
  }

  // 4. symbols — each kind is a single path, so the layer stays light to draw
  let d = "";
  // dunes over the whole desert
  for (const [x, y, k] of scatter({ box: [30, 30, 380, 320], ids: ["desert"], step: 30, seed: 3 })) { const s = 6 + k * 4; d += `M${x - s},${y}q${s / 2},${-s * .7} ${s},0t${s},0`; }
  el("path", { d, class: "t-dune" }, g);
  // dead ground in the Blight
  d = ""; for (const [x, y, k] of scatter({ box: [927, 30, 1683, 280], ids: ["blight"], step: 34, seed: 5 })) { if (Math.hypot(x - 1215, y - 110) < 46) continue; d += k > .5 ? `M${x},${y}v-8M${x},${y - 4}l-3.5,-3.5M${x},${y - 5.5}l3.5,-3` : `M${x - 3},${y - 3}l6,6M${x + 3},${y - 3}l-6,6`; }
  el("path", { d, class: "t-dead" }, g);
  // hills
  d = ""; HILLS.forEach((z, i) => { for (const [x, y, k] of scatter({ ...z, step: 46, seed: 20 + i })) { const s = 7 + k * 5; d += `M${x - s},${y}Q${x},${(y - s * 1.2).toFixed(1)} ${x + s},${y}`; } });
  el("path", { d, class: "t-hill" }, g);
  // woods (round crowns), pine forest (pointed) and jungle
  const crown = (x, y, r) => `M${(x - r).toFixed(1)},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  let pines = "";
  d = ""; WOODS.forEach((z, i) => { for (const [x, y, k] of scatter({ ...z, step: 19, seed: 40 + i })) { if (z.pine) { const s = 3.4 + k * 1.6; pines += `M${(x - s).toFixed(1)},${y + 3}L${x},${(y - s * 2).toFixed(1)}L${(x + s).toFixed(1)},${y + 3}Z`; } else d += crown(x, y, 4 + k * 2); } });
  el("path", { d, class: "t-wood" }, g); el("path", { d: pines, class: "t-pine" }, g);
  d = ""; for (const [x, y, k] of scatter({ box: [1632, 433, 1970, 728], ids: ["jungle"], step: 15, seed: 60 })) d += crown(x, y, 4.5 + k * 2.5);
  el("path", { d, class: "t-jungle" }, g);
  // mountains: tall in the heart of a range and lower at its edges. Drawn row by row
  // from the back, so nearer peaks overlap the ones behind and it reads as a range.
  RANGES.forEach((z, i) => {
    const rows = {};
    for (const [x, y, k] of scatter({ ...z, step: 29, seed: 80 + i })) {
      const c = 1 - Math.min(1, Math.hypot((x - z.e[0]) / z.e[2], (y - z.e[1]) / z.e[3]));     // 1 in the middle of the range
      const sz = 8 + k * 5 + c * 12, h = +(sz * 1.35).toFixed(1), key = Math.round(y / 8), r = rows[key] || (rows[key] = { face: "", shadow: "", snow: "", line: "" });
      const X = v => (x + sz * v).toFixed(1), Y = v => (y - h * v).toFixed(1);
      r.face += `M${X(-1)},${y}L${x},${Y(1)}L${X(1)},${y}Z`;
      r.shadow += `M${x},${Y(1)}L${X(1)},${y}L${X(.2)},${y}L${X(.18)},${Y(.45)}Z`;
      r.line += `M${X(-1)},${y}L${x},${Y(1)}L${X(1)},${y}M${X(-.45)},${Y(.2)}L${X(-.25)},${Y(.42)}`;
      if (sz > 16.5) r.snow += `M${X(-.34)},${Y(.66)}L${x},${Y(1)}L${X(.34)},${Y(.66)}L${X(.13)},${Y(.56)}L${x},${Y(.68)}L${X(-.15)},${Y(.55)}Z`;
    }
    Object.keys(rows).sort((p, q) => p - q).forEach(k => { const r = rows[k]; el("path", { d: r.face, class: "t-mt-face" }, g); el("path", { d: r.shadow, class: "t-mt-shadow" }, g); if (r.snow) el("path", { d: r.snow, class: "t-snow" }, g); el("path", { d: r.line, class: "t-mt-line" }, g); });
  });

  // 5. small details that make the land feel lived in
  // villages: a little house halfway along each longer road
  { let walls = "", roofs = ""; for (let [x, y, L] of mids) { if (L < 90 || blocked(x, y)) continue; x = +x.toFixed(1); y = +y.toFixed(1); walls += `M${x - 4},${y + 3}v-6h8v6Z`; roofs += `M${x - 5.5},${y - 3}L${x},${y - 8}L${x + 5.5},${y - 3}Z`; } el("path", { d: walls, class: "t-house" }, g); el("path", { d: roofs, class: "t-roof" }, g); }
  // mines: dark tunnel mouths in the mountains (this is where the ore comes from)
  d = ""; [[1180, 322], [1405, 304], [250, 334], [472, 1080], [1212, 1322], [1926, 885]].forEach(([x, y]) => { d += `M${x - 5},${y}v-5a5,5 0 0 1 10,0v5Z`; });
  el("path", { d, class: "t-mine" }, g);
  // marsh: reeds in a ring around each lake and where the Long River leaves the map
  d = ""; [[300, 1180, 88, 42], [1040, 655, 84, 38], [705, 285, 90, 40], [95, 1305, 62, 40]].forEach((e, i) => { for (const [x, y] of scatter({ e, step: 21, seed: 120 + i })) d += `M${x - 5},${y}h10M${x - 3},${y}v-4M${x},${y}v-6.5M${x + 3},${y}v-4`; });
  el("path", { d, class: "t-marsh" }, g);
  // the desert: cacti, and one oasis with palm trees
  d = ""; for (const [x, y] of scatter({ box: [30, 30, 380, 320], ids: ["desert"], step: 66, seed: 9 })) { if (Math.hypot(x - 255, y - 172) < 40) continue; d += `M${x},${y}v-10M${x - 3.5},${y - 3}v-3.5M${x - 3.5},${y - 3}h3.5M${x + 3.5},${y - 5}v-3M${x + 3.5},${y - 5}h-3.5`; }
  el("path", { d, class: "t-cactus" }, g);
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
  name("Oasis", 255, 198, "water"); name("Lake Marbon", 705, 322, "water"); name("Elar Mere", 1040, 690, "water"); name("Lake Baloon", 300, 1213, "water");
}
