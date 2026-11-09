/* Small, accessible SVG charts: thin marks, rounded data ends, recessive axes,
   text in ink colours (never the series colour). */
import { esc } from "./dom.js";

/* Bullet bar: value against the world average and the leader, on a 0–max scale. */
export function bullet(v, { max, avg, color, label }) {
  const pct = x => Math.max(0, Math.min(100, (x / max) * 100));
  return `<div class="bullet" role="img" aria-label="${esc(label)}: ${v ?? "no value"} of a maximum ${max}; world average ${avg.toFixed(0)}">
    <div class="bl-track"><i class="bl-fill" style="width:${v == null ? 0 : pct(v)}%;background:${color}"></i>
      <span class="bl-avg" style="left:${pct(avg)}%" title="World average ${avg.toFixed(1)}"></span></div></div>`;
}

/* Sparkline across timeline moments. series = [{label, v}] */
export function sparkline(series, { color = "var(--gold)", w = 260, h = 54, name = "" } = {}) {
  const pts = series.map((s, i) => ({ ...s, i })).filter(s => s.v != null);
  if (pts.length < 2) return "";
  const vals = pts.map(p => p.v), lo = Math.min(...vals), hi = Math.max(...vals), pad = 8;
  const span = hi - lo || 1, n = series.length - 1 || 1;
  const X = i => pad + (i / n) * (w - pad * 2), Y = v => h - pad - ((v - lo) / span) * (h - pad * 2);
  const d = pts.map((p, k) => (k ? "L" : "M") + X(p.i).toFixed(1) + "," + Y(p.v).toFixed(1)).join("");
  const area = d + `L${X(pts[pts.length - 1].i).toFixed(1)},${h - 2}L${X(pts[0].i).toFixed(1)},${h - 2}Z`;
  const gid = "sg" + Math.random().toString(36).slice(2, 8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)} across ${series.length} points in time: ${pts.map(p => `${p.label} ${p.v}`).join(", ")}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map(p => `<circle cx="${X(p.i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.4" fill="${color}" stroke="#0f1520" stroke-width="2"><title>${esc(p.label)}: ${p.v}</title></circle>`).join("")}
  </svg>`;
}
