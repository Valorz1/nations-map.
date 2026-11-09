/* HISTORY — the archive of saved moments: snapshots, what changed, who ruled. */
import { R, byId, owners, METRICS, statsAt, relName, relActive, relTitle, isTop } from "../model.js";
import { TL, REL, EDITS, GOV, BORDERS, persist } from "../store.js";
import { ORIG_ARCS, regionPathsFor, X0, Y0, X1, Y1, PAD } from "../map/engine.js";
import { tlOpen, setTimeline, viewMoment, saveMoment, deleteMoment, tlIdx, tlPast } from "../map/timeline.js";
import { esc, viewHead, secHead, emptyState, plural, when, signed, dot } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href, refresh } from "../ui/router.js";
import { mount, listMode } from "./common.js";
import { syncBorders } from "../map/editor.js";

let editing = null, adding = false;
const thumbCache = new Map();
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

/* a small, flat rendering of the map with a moment's borders */
function thumb(borders, key) {
  if (thumbCache.has(key)) return thumbCache.get(key);
  const arcs = ORIG_ARCS.map((a, i) => (borders || {})[i] || a);
  const paths = regionPathsFor(arcs).map(({ r, d }) => `<path d="${d}" fill="${r.fill}" stroke="#3b4252" stroke-width="3" stroke-linejoin="round"/>`).join("");
  const svg = `<svg class="thumb" viewBox="${X0 - PAD} ${Y0 - PAD} ${X1 - X0 + PAD * 2} ${Y1 - Y0 + PAD * 2}" aria-hidden="true"><rect x="${X0 - PAD}" y="${Y0 - PAD}" width="${X1 - X0 + PAD * 2}" height="${Y1 - Y0 + PAD * 2}" fill="#f1efe8" rx="10"/>${paths}<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="none" stroke="#2c3240" stroke-width="5"/></svg>`;
  thumbCache.set(key, svg); return svg;
}

/* nations whose borders differ between two border sets */
function borderChanges(b1, b2) {
  const changed = new Set();
  const keys = new Set([...Object.keys(b1 || {}), ...Object.keys(b2 || {})]);
  for (const k of keys) {
    const a = (b1 || {})[k] || ORIG_ARCS[k], b = (b2 || {})[k] || ORIG_ARCS[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) (owners[k] || []).forEach(id => changed.add(id));
  }
  return [...changed].map(id => byId[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}
function powerChanges(e1, e2) {
  const out = [];
  for (const r of R) {
    if (!r.base && !e1[r.id] && !e2[r.id]) continue;
    for (const m of METRICS) { const a = statsAt(r, m.k, e1), b = statsAt(r, m.k, e2); if (a != null && b != null && a !== b) out.push({ r, m, a, b }); }
  }
  return out;
}
function relChanges(l1, l2) {
  const key = x => [x.a, x.b].sort().join("|") + "|" + x.t, A = new Map(l1.map(x => [key(x), x])), B = new Map(l2.map(x => [key(x), x])), ev = [];
  for (const [k, x] of B) { const o = A.get(k); if (!o && relActive(x)) ev.push({ k: "add", x }); else if (o && relActive(o) && !relActive(x)) ev.push({ k: "end", x }); }
  for (const [k, o] of A) if (!B.has(k) && relActive(o)) ev.push({ k: "drop", x: o });
  return ev.filter(e => byId[e.x.a] && byId[e.x.b]);
}
function govChanges(g1, g2) {
  if (!g1 || !g2) return [];
  const out = [];
  for (const id of new Set([...Object.keys(g1), ...Object.keys(g2)])) {
    const a = g1[id] || {}, b = g2[id] || {};
    if ((a.leader || "") !== (b.leader || "") && b.leader) out.push({ r: byId[id], k: "leader", from: a.leader, to: b.leader });
    if ((a.gov || "") !== (b.gov || "") && b.gov) out.push({ r: byId[id], k: "gov", from: a.gov, to: b.gov });
  }
  return out.filter(x => x.r);
}

function changeList(prev, cur) {
  if (!prev) return `<p class="inline-empty">The first moment in the archive.</p>`;
  const bc = borderChanges(prev.borders, cur.borders), pc = powerChanges(prev.edits || {}, cur.edits || {}), rc = relChanges(prev.rel || [], cur.rel || []), gc = govChanges(prev.gov, cur.gov);
  if (!bc.length && !pc.length && !rc.length && !gc.length) return `<p class="inline-empty">No recorded changes since “${esc(prev.name)}”.</p>`;
  const verb = e => e.x.t === "war" ? { add: "War declared", end: "War ended", drop: "War over" }[e.k] : { add: "Alliance formed", end: "Alliance ended", drop: "Alliance dissolved" }[e.k];
  return `<ul class="mchg">
    ${bc.length ? `<li><span class="mc-ic">${icon("pen", "i-xs")}</span><span><b>Territorial changes</b>: ${bc.map(r => `<a href="${href("nation", r.id)}">${esc(r.name)}</a>`).join(", ")}</span></li>` : ""}
    ${pc.map(c => `<li><span class="mc-ic">${icon(c.m.ico, "i-xs")}</span><span><a href="${href("nation", c.r.id)}">${esc(c.r.name)}</a> ${c.m.label.toLowerCase()} ${c.a} → <b>${c.b}</b> <em class="${c.b > c.a ? "up" : "dn"}">${signed(c.b - c.a)}</em></span></li>`).join("")}
    ${rc.map(e => `<li class="${e.x.t}"><span class="mc-ic">${icon(e.x.t === "war" ? "swords" : "link", "i-xs")}</span><span><b>${verb(e)}</b>: ${esc(relName(e.x.a))} and ${esc(relName(e.x.b))}${e.x.name ? ` (${esc(e.x.name)})` : ""}</span></li>`).join("")}
    ${gc.map(g => `<li><span class="mc-ic">${icon(g.k === "leader" ? "crown" : "landmark", "i-xs")}</span><span><a href="${href("nation", g.r.id)}">${esc(g.r.name)}</a>: ${g.k === "leader" ? "new ruler" : "government became"} <b>${esc(g.to)}</b>${g.from ? ` <span class="muted">(was ${esc(g.from)})</span>` : ""}</span></li>`).join("")}
  </ul>`;
}

function leaders(gov) {
  if (!gov) return "";
  const list = R.filter(r => isTop(r) && gov[r.id]?.leader);
  if (!list.length) return "";
  return `<details class="m-leaders"><summary>${icon("crown", "i-xs")}Rulers at this moment (${list.length})</summary><ul>${list.map(r => `<li>${dot(r)}<span>${esc(r.name)}</span><b>${esc(gov[r.id].leader)}</b>${gov[r.id].gov ? `<small>${esc(gov[r.id].gov)}</small>` : ""}</li>`).join("")}</ul></details>`;
}

function render(args, opts) {
  listMode(opts);
  if (!tlPast()) syncBorders();   // never while a past moment's borders are on the map
  const now = { name: "Now", borders: BORDERS, edits: EDITS, rel: REL, gov: GOV };
  const viewing = tlPast() ? tlIdx() : TL.length;
  const wars = REL.filter(x => x.t === "war" && byId[x.a] && byId[x.b]);
  const addForm = adding ? `<form id="momentForm" class="form"><div class="form-title">${icon("camera")}Save this moment</div>
      <p class="hint">Captures the current borders, ratings, wars, alliances and governments so you can return to them later.</p>
      <div class="field-row"><label class="field"><span>Title</span><input class="input" id="mf-name" placeholder="e.g. Before the Great War" required></label>
        <label class="field"><span>Date or era <em class="opt">optional</em></span><input class="input" id="mf-date" placeholder="e.g. Year 412"></label></div>
      <label class="field"><span>Description <em class="opt">optional</em></span><textarea class="textarea" id="mf-desc" rows="3" placeholder="What was happening in the world?"></textarea></label>
      <div class="form-acts"><button class="btn btn-primary" type="submit">${icon("check")}Save moment</button><button class="btn" type="button" data-act="add-cancel">Cancel</button></div></form>` : "";

  const card = (m, i) => {
    const prev = i > 0 ? TL[i - 1] : null, isNow = i === TL.length;
    if (editing === i && !isNow) return `<li class="moment"><span class="m-node"></span><form id="momentEdit" class="form" data-i="${i}"><div class="form-title">${icon("edit")}Edit moment</div>
      <div class="field-row"><label class="field"><span>Title</span><input class="input" id="me-name" value="${esc(m.name)}" required></label>
        <label class="field"><span>Date or era</span><input class="input" id="me-date" value="${esc(m.date || "")}" placeholder="e.g. Year 412"></label></div>
      <label class="field"><span>Description</span><textarea class="textarea" id="me-desc" rows="3">${esc(m.description || "")}</textarea></label>
      <div class="form-acts"><button class="btn btn-primary" type="submit">${icon("check")}Save</button><button class="btn" type="button" data-act="edit-cancel">Cancel</button></div></form></li>`;
    return `<li class="moment${isNow ? " now" : ""}${viewing === i ? " viewing" : ""}"><span class="m-node">${isNow ? icon("dot") : i + 1}</span>
      <article class="m-card card">
        <div class="m-thumb">${thumb(m.borders, isNow ? "now:" + hash(JSON.stringify(BORDERS)) : "tl:" + i + ":" + (m.savedAt || m.name))}</div>
        <div class="m-body">
          <div class="m-meta">${isNow ? `<span class="pill gold">${icon("dot")}Present day</span>` : `<span class="pill">Moment ${i + 1}</span>`}${m.date ? `<span class="pill">${icon("calendar")}${esc(m.date)}</span>` : ""}${m.savedAt ? `<span class="muted">saved ${esc(when(m.savedAt))}</span>` : ""}${viewing === i && tlOpen ? `<span class="pill ok">On the map</span>` : ""}</div>
          <h3 class="m-title">${isNow ? "The world today" : esc(m.name)}</h3>
          ${m.description ? `<p class="m-desc">${esc(m.description)}</p>` : ""}
          ${secHead(isNow && prev ? `Since “${esc(prev.name)}”` : "Changes")}${changeList(prev, m)}
          ${leaders(m.gov)}
          <div class="btn-row m-acts">${isNow ? (TL.length ? `<button type="button" class="btn btn-sm" data-view="${i}">${icon("history")}Show on map</button>` : "") : `<button type="button" class="btn btn-sm" data-view="${i}">${icon("history")}View on map</button>
            <button type="button" class="btn btn-sm btn-ghost" data-edit-m="${i}">${icon("edit")}Edit</button><button type="button" class="btn btn-sm btn-danger-ghost" data-del-m="${i}">${icon("trash")}Delete</button>`}</div>
        </div></article></li>`;
  };

  const html = viewHead({
    eyebrow: "History", ico: "history", title: "Historical Archive",
    sub: `<span>${plural(TL.length, "saved moment")}${TL.length ? ` · from “${esc(TL[0].name)}” to the present` : ""}</span>`,
    acts: `<button type="button" class="btn btn-sm" data-act="timeline">${icon("history")}${tlOpen ? "Close timeline" : "Open timeline"}</button>${!tlPast() && !adding ? `<button type="button" class="btn btn-sm btn-primary" data-act="add">${icon("camera")}Save moment</button>` : ""}`,
  }) + `<div class="vb">
    ${tlPast() ? `<div class="callout">${icon("history")}<span>The map is showing “${esc(TL[tlIdx()].name)}”. Saving new moments works from <b>Now</b>.</span><button type="button" class="btn btn-xs" data-view="${TL.length}">Back to Now</button></div>` : ""}
    ${addForm}
    ${TL.length ? "" : emptyState("Save a moment, then change borders, ratings, wars or rulers. Every moment keeps a snapshot of the map, so you can slide back and watch the world change.", { title: "The archive is empty", ico: "scroll", center: true, action: tlPast() || adding ? "" : `<button type="button" class="btn btn-primary" data-act="add">${icon("camera")}Save the first moment</button>` })}
    <ol class="chron" aria-label="Timeline, oldest first">${TL.map(card).join("")}${card(now, TL.length)}</ol>
    ${wars.length ? `<section class="sec">${secHead("Important wars", String(wars.length))}<ul class="wars-mini">${wars.map(x => `<li class="${relActive(x) ? "war" : "ended"}"><a href="${href("diplomacy")}">${icon("swords", "i-sm")}<span><b>${esc(relTitle(x))}</b><small>${relActive(x) ? "Ongoing" : "Ended"}${x.started ? " · since " + esc(x.started) : ""}${x.outcome ? " · " + esc(x.outcome) : ""}</small></span></a></li>`).join("")}</ul></section>` : ""}
  </div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}

export const historyView = {
  render,
  click(e) {
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "timeline") { setTimeline(!tlOpen); refresh(); return true; }
    if (a === "add") { adding = true; refresh(); document.getElementById("mf-name")?.focus(); return true; }
    if (a === "add-cancel") { adding = false; refresh(); return true; }
    if (a === "edit-cancel") { editing = null; refresh(); return true; }
    const v = e.target.closest("[data-view]"); if (v) { viewMoment(+v.dataset.view); return true; }
    const ed = e.target.closest("[data-edit-m]"); if (ed) { editing = +ed.dataset.editM; refresh(); document.getElementById("me-name")?.focus(); return true; }
    const del = e.target.closest("[data-del-m]"); if (del) { const i = +del.dataset.delM; deleteMoment(i).then(ok => { if (ok) { thumbCache.clear(); editing = null; refresh(); } }); return true; }
  },
  submit(e) {
    if (e.target.id === "momentForm") {
      const name = document.getElementById("mf-name").value.trim(); if (!name) { document.getElementById("mf-name").focus(); return true; }
      saveMoment({ name, date: document.getElementById("mf-date").value, description: document.getElementById("mf-desc").value });
      adding = false; refresh(); return true;
    }
    if (e.target.id === "momentEdit") {
      const i = +e.target.dataset.i, m = TL[i], name = document.getElementById("me-name").value.trim(); if (!name) return true;
      m.name = name; const d = document.getElementById("me-date").value.trim(), ds = document.getElementById("me-desc").value.trim();
      if (d) m.date = d; else delete m.date; if (ds) m.description = ds; else delete m.description;
      editing = null; persist("moment"); refresh(); return true;
    }
  },
};
