/* DIPLOMACY — wars, alliances and how relations change over time. */
import { R, byId, isTop, relName, relActive, relTitle, sortedByName, isTerritory, isMovement } from "../model.js";
import { REL, TL, persist } from "../store.js";
import { drawRel, curRel } from "../map/engine.js";
import { tlPast, viewedMoment } from "../map/timeline.js";
import { esc, emblem, viewHead, secHead, emptyState, plural } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog, toast } from "../ui/feedback.js";
import { href, refresh } from "../ui/router.js";
import { mount, listMode } from "./common.js";

let relType = "war", editIdx = null, pre = { a: null, b: null };

function options(sel) {
  const grp = (label, list) => list.length ? `<optgroup label="${label}">${sortedByName(list).map(r => `<option value="${r.id}"${sel === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</optgroup>` : "";
  return grp("Nations & areas", R.filter(isTop)) + grp("Territories", R.filter(isTerritory)) + grp("Resistance movements", R.filter(isMovement));
}

const pairKey = x => [x.a, x.b].sort().join("|");

function render(args, opts) {
  listMode(opts);
  if (args[0] && byId[args[0]] && !opts.same) { pre = { a: args[0], b: null }; }
  const list = curRel, past = viewedMoment(), editable = !tlPast();
  const idx = list.map((x, i) => [x, i]).filter(([x]) => byId[x.a] && byId[x.b]);
  const wars = idx.filter(([x]) => x.t === "war" && relActive(x)), als = idx.filter(([x]) => x.t === "ally" && relActive(x)), ended = idx.filter(([x]) => !relActive(x));
  const involved = new Set(idx.filter(([x]) => relActive(x)).flatMap(([x]) => [x.a, x.b]));

  const a0 = pre.a || "elarion", b0 = pre.b || R.find(x => x.id !== a0 && isTop(x) && x.stats)?.id;
  const form = editable ? `<form id="relForm" class="form rel-form" aria-label="Record a war or alliance">
      <div class="form-title">${icon("plus")}Record a relationship</div>
      <div class="seg" role="group" aria-label="Type"><button type="button" data-rt="war" aria-pressed="${relType === "war"}">${icon("swords")}War</button><button type="button" data-rt="ally" aria-pressed="${relType === "ally"}">${icon("link")}Alliance</button></div>
      <div class="relpick"><select id="ra" class="select" aria-label="First nation">${options(a0)}</select><span class="rp-verb">${relType === "war" ? "at war with" : "allied with"}</span><select id="rb" class="select" aria-label="Second nation">${options(b0)}</select></div>
      <div class="field-row"><label class="field"><span>Name <em class="opt">optional</em></span><input class="input" id="rn" type="text" placeholder="${relType === "war" ? "e.g. The Great Northern War" : "e.g. The Southern Pact"}"></label>
        <label class="field"><span>Since <em class="opt">optional</em></span><input class="input" id="rs" type="text" placeholder="e.g. Year 412"></label></div>
      <div class="form-acts"><button type="submit" class="btn btn-primary">${relType === "war" ? `${icon("swords")}Declare war` : `${icon("link")}Form alliance`}</button></div></form>`
    : `<div class="callout">${icon("history")}<span>You're viewing “${esc(past.name)}”. Slide the timeline to <b>Now</b> to add, edit or remove wars and alliances.</span></div>`;

  const html = viewHead({
    eyebrow: "Diplomacy", ico: "swords", title: "Wars &amp; Alliances",
    sub: `<span>${plural(wars.length, "war")} · ${plural(als.length, "alliance")} · ${ended.length} ended</span>${past ? `<span class="pill gold">${icon("history")}${esc(past.name)}</span>` : ""}`,
  }) + `<div class="vb">
    <div class="tiles">
      <div class="tile t-war"><span class="ti">${icon("swords", "i-sm")}</span><span class="tv">${wars.length}</span><span class="tk">Active wars</span></div>
      <div class="tile t-ally"><span class="ti">${icon("link", "i-sm")}</span><span class="tv">${als.length}</span><span class="tk">Alliances</span></div>
      <div class="tile"><span class="ti">${icon("scroll", "i-sm")}</span><span class="tv">${ended.length}</span><span class="tk">Ended</span></div>
      <div class="tile"><span class="ti">${icon("flag", "i-sm")}</span><span class="tv">${involved.size}</span><span class="tk">Nations involved</span></div>
    </div>
    ${form}
    <section class="sec">${secHead("Relations matrix")}${matrix(idx)}</section>
    <section class="sec" id="sec-war">${secHead("Current wars", wars.length ? String(wars.length) : "")}${wars.length ? `<ul class="rels">${wars.map(r => relCard(r, editable)).join("")}</ul>` : `<p class="inline-empty">No wars are being fought.</p>`}</section>
    <section class="sec">${secHead("Alliances", als.length ? String(als.length) : "")}${als.length ? `<ul class="rels">${als.map(r => relCard(r, editable)).join("")}</ul>` : `<p class="inline-empty">No alliances have been formed.</p>`}</section>
    <section class="sec">${secHead("Historical wars & ended alliances", ended.length ? String(ended.length) : "")}${ended.length ? `<ul class="rels">${ended.map(r => relCard(r, editable)).join("")}</ul>` : `<p class="inline-empty">Nothing yet. Mark a war as ended to record its outcome here.</p>`}</section>
    <section class="sec">${secHead("Changes over time")}${changes()}</section>
    <p class="foot-note">${icon("info", "i-xs")}On the map, active wars are red dashed lines and alliances solid blue lines. Toggle them in Layers.</p>
  </div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}

function matrix(idx) {
  const ents = sortedByName(R.filter(r => (isTop(r) && r.stats) || idx.some(([x]) => x.a === r.id || x.b === r.id)));
  const cell = (a, b) => {
    if (a.id === b.id) return `<td class="mx-self" aria-hidden="true"></td>`;
    const hits = idx.filter(([x]) => pairKey(x) === [a.id, b.id].sort().join("|"));
    const act = hits.find(([x]) => relActive(x)), x = act ? act[0] : hits[0]?.[0], i = act ? act[1] : hits[0]?.[1];
    const st = !x ? "none" : !relActive(x) ? "ended" : x.t;
    const lbl = `${a.name} and ${b.name}: ${st === "none" ? "neutral" : st === "ended" ? "past " + (x.t === "war" ? "war" : "alliance") : st === "war" ? "at war" : "allied"}`;
    return `<td><button type="button" class="mx mx-${st}" ${i != null ? `data-edit-rel="${i}"` : `data-pair="${a.id},${b.id}"`} aria-label="${esc(lbl)}" title="${esc(lbl)}">${st === "war" ? icon("x", "i-xs") : st === "ally" ? icon("plus", "i-xs") : st === "ended" ? "" : ""}</button></td>`;
  };
  return `<div class="mx-wrap"><table class="mx-table"><caption class="sr-only">Relations between every pair of nations</caption>
    <thead><tr><th scope="col"><span class="sr-only">Nation</span></th>${ents.map(r => `<th scope="col" title="${esc(r.name)}"><span class="mx-col">${emblem(r, 18)}</span><span class="sr-only">${esc(r.name)}</span></th>`).join("")}</tr></thead>
    <tbody>${ents.map(a => `<tr><th scope="row"><a href="${href("nation", a.id)}">${emblem(a, 16)}<span>${esc(a.name)}</span></a></th>${ents.map(b => cell(a, b)).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="mx-legend"><span><i class="mx mx-war">${icon("x", "i-xs")}</i>At war</span><span><i class="mx mx-ally">${icon("plus", "i-xs")}</i>Allied</span><span><i class="mx mx-ended"></i>Past relation</span><span><i class="mx mx-none"></i>Neutral</span><span class="muted">Select a square to edit or record that pair.</span></div>`;
}

function relCard([x, i], editable) {
  const A = byId[x.a], B = byId[x.b], war = x.t === "war", ended = !relActive(x);
  if (editIdx === i && editable) return `<li class="relc editing"><form class="form" id="relEdit" data-i="${i}">
      <div class="form-title">${icon("edit")}Edit ${war ? "war" : "alliance"}: ${esc(A.name)} ${war ? "vs" : "&amp;"} ${esc(B.name)}</div>
      <div class="field-row"><label class="field"><span>Name</span><input class="input" id="re-name" value="${esc(x.name || "")}" placeholder="${esc(relTitle({ ...x, name: "" }))}"></label>
        <label class="field"><span>Type</span><select class="select" id="re-t"><option value="war"${war ? " selected" : ""}>War</option><option value="ally"${!war ? " selected" : ""}>Alliance</option></select></label></div>
      <div class="field-row"><label class="field"><span>Status</span><select class="select" id="re-status"><option value="active"${!ended ? " selected" : ""}>${war ? "Ongoing" : "Active"}</option><option value="ended"${ended ? " selected" : ""}>Ended</option></select></label>
        <label class="field"><span>Since</span><input class="input" id="re-started" value="${esc(x.started || "")}" placeholder="e.g. Year 412"></label></div>
      <div class="field-row"><label class="field"><span>Ended</span><input class="input" id="re-ended" value="${esc(x.ended || "")}" placeholder="e.g. Year 418"></label>
        <label class="field"><span>Outcome</span><input class="input" id="re-outcome" value="${esc(x.outcome || "")}" placeholder="${war ? "e.g. Elarion victory, Treaty of …" : "e.g. Dissolved peacefully"}"></label></div>
      <label class="field"><span>Notes</span><textarea class="textarea" id="re-notes" rows="3" placeholder="What happened?">${esc(x.notes || "")}</textarea></label>
      <div class="form-acts"><button type="submit" class="btn btn-primary">${icon("check")}Save</button><button type="button" class="btn" data-act="edit-cancel">Cancel</button></div></form></li>`;
  const meta = [x.started && `Since ${esc(x.started)}`, x.ended && `Ended ${esc(x.ended)}`].filter(Boolean).join(" · ");
  return `<li class="relc ${ended ? "ended" : x.t}" id="rel-${i}">
    <div class="rc-side"><a href="${href("nation", A.id)}">${emblem(A, 30)}<span>${esc(A.name)}</span></a></div>
    <div class="rc-mid"><span class="rc-badge">${icon(war ? "swords" : "link", "i-sm")}</span><b>${esc(relTitle(x))}</b>
      <small>${ended ? (war ? "War ended" : "Alliance ended") : war ? "At war" : "Allied"}${meta ? " · " + meta : ""}</small>
      ${x.outcome ? `<span class="rc-out">${icon("flag", "i-xs")}${esc(x.outcome)}</span>` : ""}${x.notes ? `<p class="rc-notes">${esc(x.notes)}</p>` : ""}</div>
    <div class="rc-side right"><a href="${href("nation", B.id)}"><span>${esc(B.name)}</span>${emblem(B, 30)}</a></div>
    ${editable ? `<div class="rc-acts"><button type="button" class="btn btn-xs btn-ghost" data-edit-rel="${i}">${icon("edit")}Edit</button>
      ${!ended ? `<button type="button" class="btn btn-xs btn-ghost" data-end-rel="${i}">${icon("flag")}${war ? "End war" : "Dissolve"}</button>` : ""}
      <button type="button" class="btn btn-xs btn-danger-ghost" data-delrel="${i}" aria-label="Remove ${esc(relTitle(x))}">${icon("trash")}Remove</button></div>` : ""}
  </li>`;
}

/* relation changes between consecutive saved moments, and since the last one */
function changes() {
  if (!TL.length) return `<p class="inline-empty">Save moments on the <a class="link-btn" href="${href("history")}">timeline</a> to see how relations change between them.</p>`;
  const states = [...TL.map(t => ({ name: t.name, date: t.date, rel: t.rel || [] })), { name: "Now", rel: REL }];
  const keyed = list => new Map(list.filter(x => byId[x.a] && byId[x.b]).map(x => [pairKey(x) + "|" + x.t, x]));
  const out = [];
  for (let i = 1; i < states.length; i++) {
    const A = keyed(states[i - 1].rel), B = keyed(states[i].rel), ev = [];
    for (const [k, x] of B) {
      const o = A.get(k);
      if (!o && relActive(x)) ev.push(["add", x]);
      else if (o && relActive(o) && !relActive(x)) ev.push(["end", x]);
    }
    for (const [k, o] of A) if (!B.has(k) && relActive(o)) ev.push(["drop", o]);
    if (ev.length) out.push({ from: states[i - 1], to: states[i], ev });
  }
  if (!out.length) return `<p class="inline-empty">No changes in wars or alliances between the saved moments.</p>`;
  const verb = (k, x) => x.t === "war" ? { add: "War declared", end: "War ended", drop: "War no longer recorded" }[k] : { add: "Alliance formed", end: "Alliance ended", drop: "Alliance dissolved" }[k];
  return `<ol class="chlog">${out.map(o => `<li><div class="chl-h"><b>${esc(o.from.name)}</b>${icon("arrow-right", "i-xs")}<b>${esc(o.to.name)}</b>${o.to.date ? `<span class="muted">${esc(o.to.date)}</span>` : ""}</div>
    <ul>${o.ev.map(([k, x]) => `<li class="chl-${x.t}">${icon(x.t === "war" ? "swords" : "link", "i-xs")}<span><b>${verb(k, x)}</b>: ${esc(relName(x.a))} and ${esc(relName(x.b))}${x.outcome && k === "end" ? ` (${esc(x.outcome)})` : ""}</span></li>`).join("")}</ul></li>`).join("")}</ol>`;
}

function save(what) { drawRel(REL); persist(what); refresh(); }

export const diplomacyView = {
  render,
  click(e) {
    const rt = e.target.closest("[data-rt]");
    if (rt) { relType = rt.dataset.rt; pre = { a: document.getElementById("ra")?.value, b: document.getElementById("rb")?.value }; refresh(); return true; }
    const pr = e.target.closest("[data-pair]");
    if (pr) {
      if (tlPast()) return true;
      const [a, b] = pr.dataset.pair.split(","); pre = { a, b }; refresh();
      const f = document.getElementById("relForm"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); document.getElementById("rn")?.focus({ preventScroll: true });
      return true;
    }
    const ed = e.target.closest("[data-edit-rel]");
    if (ed) {
      if (tlPast()) return true; editIdx = +ed.dataset.editRel; refresh();
      const f = document.getElementById("relEdit"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); document.getElementById("re-name")?.focus({ preventScroll: true }); return true;
    }
    if (e.target.closest('[data-act="edit-cancel"]')) { editIdx = null; refresh(); return true; }
    const en = e.target.closest("[data-end-rel]");
    if (en) { const x = REL[+en.dataset.endRel]; x.status = "ended"; editIdx = +en.dataset.endRel; save(x.t === "war" ? "war" : "alliance"); toast(x.t === "war" ? "War marked as ended" : "Alliance dissolved", { kind: "info", sub: "Add an outcome and date if you like" }); return true; }
    const dr = e.target.closest("[data-delrel]");
    if (dr) {
      const i = +dr.dataset.delrel, x = REL[i];
      confirmDialog({ title: `Remove “${relTitle(x)}”?`, body: "It will disappear from the map and from this list. Saved timeline moments keep their own copy.", ok: "Remove", danger: true }).then(ok => {
        if (!ok) return; REL.splice(i, 1); editIdx = null; save("wars and alliances");
      });
      return true;
    }
  },
  submit(e) {
    if (e.target.id === "relForm") {
      const a = document.getElementById("ra").value, b = document.getElementById("rb").value;
      pre = { a, b };
      if (a === b) { toast("Pick two different nations", { kind: "err" }); return true; }
      const i = REL.findIndex(x => relActive(x) && pairKey(x) === [a, b].sort().join("|"));
      if (i >= 0 && REL[i].t === relType) { toast("That's already on the list", { kind: "info", sub: relTitle(REL[i]) }); return true; }
      const extra = {}; const nm = document.getElementById("rn").value.trim(), st = document.getElementById("rs").value.trim();
      if (nm) extra.name = nm; if (st) extra.started = st;
      if (i >= 0) Object.assign(REL[i], { t: relType }, extra); else REL.push({ a, b, t: relType, ...extra });
      save(relType === "war" ? "war declaration" : "alliance");
      return true;
    }
    if (e.target.id === "relEdit") {
      const i = +e.target.dataset.i, x = REL[i], v = id => document.getElementById(id).value.trim();
      const upd = { t: document.getElementById("re-t").value, name: v("re-name"), started: v("re-started"), ended: v("re-ended"), outcome: v("re-outcome"), notes: v("re-notes") };
      for (const k of ["name", "started", "ended", "outcome", "notes"]) { if (upd[k]) x[k] = upd[k]; else delete x[k]; }
      x.t = upd.t;
      if (document.getElementById("re-status").value === "ended") x.status = "ended"; else delete x.status;
      editIdx = null; save(x.t === "war" ? "war" : "alliance"); return true;
    }
  },
};
