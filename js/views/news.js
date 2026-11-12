/* NEWS — the world's news feed, and the in-world calendar.
   Nations publish announcements, declarations, treaties and reports here, each
   dated by the in-world year. Declaring a war or an alliance in Diplomacy posts
   a headline here by itself. Everything is saved with the rest of the world. */
import { R, byId, isTop, isTerritory, isMovement, sortedByName } from "../model.js";
import { NEWS, CAL, persist } from "../store.js";
import { esc, emblem, viewHead, secHead, emptyState, plural } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog, toast } from "../ui/feedback.js";
import { href, refresh } from "../ui/router.js";
import { mount, listMode } from "./common.js";

export const KINDS = [
  { k: "announcement", label: "Announcement", ico: "megaphone" },
  { k: "declaration", label: "Declaration", ico: "scroll" },
  { k: "war", label: "War report", ico: "swords" },
  { k: "treaty", label: "Treaty", ico: "handshake" },
  { k: "politics", label: "Politics", ico: "vote" },
  { k: "economy", label: "Economy", ico: "trend" },
  { k: "event", label: "Event", ico: "sparkle" },
];
const kind = k => KINDS.find(x => x.k === k) || KINDS[0];

/* ---- the calendar ---- */
export const yearLabel = (y = CAL.year) => `Year ${y}${CAL.era ? " " + CAL.era : ""}`;

/* ---- the feed ---- */
const newest = (a, b) => (b.y ?? 0) - (a.y ?? 0) || (b.at ?? 0) - (a.at ?? 0);
export const sortedNews = () => [...NEWS].sort(newest);
/* stories published by a nation or naming it */
export const newsAbout = id => sortedNews().filter(n => n.by === id || (n.about || []).includes(id));
/* add a story (the caller saves) */
export function postNews({ by = "", k = "announcement", h, b = "", about = [], y = CAL.year, auto = false }) {
  const item = { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), y, k, h, at: Date.now() };
  if (by) item.by = by; if (b) item.b = b; if (about.length) item.about = about; if (auto) item.auto = true;
  NEWS.push(item); return item;
}

/* one story, as a card */
export function storyHTML(n, { editable = false, compact = false } = {}) {
  const K = kind(n.k), by = byId[n.by], paras = String(n.b || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const others = (n.about || []).filter(id => id !== n.by && byId[id]);
  return `<li class="story k-${esc(n.k)}${compact ? " compact" : ""}" id="story-${esc(n.id)}">
    <div class="st-top"><span class="st-kind">${icon(K.ico, "i-xs")}${K.label}</span><span class="st-year">${esc(yearLabel(n.y))}</span>${n.auto ? `<span class="st-auto" title="Posted automatically from Diplomacy">auto</span>` : ""}</div>
    <h4 class="st-h">${esc(n.h)}</h4>
    ${!compact && paras.length ? `<div class="st-b">${paras.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
    <div class="st-foot">${by ? `<a class="st-by" href="${href("nation", by.id)}">${emblem(by, 18)}<span>${esc(by.name)}</span></a>` : `<span class="st-by world">${icon("globe", "i-xs")}<span>World desk</span></span>`}
      ${others.map(id => `<a class="st-also" href="${href("nation", id)}">${emblem(byId[id], 16)}<span>${esc(byId[id].name)}</span></a>`).join("")}
      ${editable ? `<span class="spacer"></span><button type="button" class="btn btn-xs btn-ghost" data-edit-news="${esc(n.id)}">${icon("edit")}Edit</button><button type="button" class="btn btn-xs btn-danger-ghost" data-del-news="${esc(n.id)}" aria-label="Delete “${esc(n.h)}”">${icon("trash")}</button>` : ""}</div>
  </li>`;
}

/* ---- the view ---- */
let fKind = "all", fBy = "", editId = null, draftBy = "", draftKind = "announcement";

function options(sel, none) {
  const grp = (label, list) => list.length ? `<optgroup label="${label}">${sortedByName(list).map(r => `<option value="${r.id}"${sel === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</optgroup>` : "";
  return `<option value="">${none}</option>` + grp("Nations & areas", R.filter(r => isTop(r) && r.id !== "unknown")) + grp("Territories", R.filter(isTerritory)) + grp("Resistance movements", R.filter(isMovement));
}
const kindOptions = sel => KINDS.map(K => `<option value="${K.k}"${sel === K.k ? " selected" : ""}>${K.label}</option>`).join("");

function storyForm(n) {
  const e = !!n, v = n || { by: draftBy, k: draftKind, y: CAL.year, h: "", b: "", about: [] }, also = (v.about || []).find(id => id !== v.by) || "";
  return `<form class="form news-form" id="${e ? "newsEdit" : "newsForm"}" ${e ? `data-id="${esc(n.id)}"` : ""}>
    <div class="form-title">${icon(e ? "edit" : "quill")}${e ? "Edit story" : "Publish a story"}</div>
    <div class="field-row"><label class="field"><span>Published by</span><select class="select" id="nw-by">${options(v.by, "World desk (no nation)")}</select></label>
      <label class="field"><span>Kind of story</span><select class="select" id="nw-k">${kindOptions(v.k)}</select></label></div>
    <label class="field"><span>Headline</span><input class="input" id="nw-h" type="text" maxlength="160" required value="${esc(v.h)}" placeholder="e.g. Elarion opens the northern passes to trade"></label>
    <label class="field"><span>Story <em class="opt">optional</em></span><textarea class="textarea" id="nw-b" rows="${e ? 5 : 3}" placeholder="What happened, who said what, what comes next… Leave a blank line between paragraphs.">${esc(v.b || "")}</textarea></label>
    <div class="field-row"><label class="field"><span>Year</span><input class="input" id="nw-y" type="number" step="1" value="${v.y ?? CAL.year}"></label>
      <label class="field"><span>Also involves <em class="opt">optional</em></span><select class="select" id="nw-also">${options(also, "Nobody else")}</select></label></div>
    <div class="form-acts"><button type="submit" class="btn btn-primary">${icon(e ? "check" : "megaphone")}${e ? "Save story" : "Publish"}</button>${e ? `<button type="button" class="btn" data-act="news-cancel">Cancel</button>` : ""}</div></form>`;
}

function render(args, opts) {
  listMode(opts);
  if (!opts.same) { fBy = args[0] && byId[args[0]] ? args[0] : ""; if (fBy) draftBy = fBy; }
  const all = sortedNews();
  const list = all.filter(n => (fKind === "all" || n.k === fKind) && (!fBy || n.by === fBy || (n.about || []).includes(fBy)));
  const years = [...new Set(list.map(n => n.y))];
  const thisYear = all.filter(n => n.y === CAL.year).length;
  const html = viewHead({
    eyebrow: "World news", ico: "news", title: "The World Herald",
    sub: `<span class="pill gold">${icon("calendar")}${esc(yearLabel())}</span><span>${plural(all.length, "story", "stories")} · ${thisYear} this year</span>`,
  }) + `<div class="vb">
    <section class="cal card" aria-label="In-world calendar">
      <div class="cal-now"><small>The current year</small><b>${esc(yearLabel())}</b></div>
      <div class="cal-acts">
        <button type="button" class="btn btn-sm" data-act="year-back" aria-label="Go back one year">${icon("chev-left")}</button>
        <button type="button" class="btn btn-sm btn-primary" data-act="year-next">${icon("calendar")}Advance to ${esc(yearLabel(CAL.year + 1))}</button>
      </div>
      <label class="cal-era"><span>Era</span><input class="input" id="cal-era" type="text" maxlength="16" value="${esc(CAL.era)}" placeholder="e.g. AB, of the Blight"></label>
      <p class="hint">${icon("info", "i-xs")}<span>New stories, wars and alliances are dated with the current year. Advance it whenever a round of the roleplay ends.</span></p>
    </section>
    ${storyForm()}
    <section class="sec">${secHead("Headlines", list.length ? String(list.length) : "")}
      <div class="news-filters">
        <div class="seg" role="group" aria-label="Kind of story"><button type="button" data-nk="all" aria-pressed="${fKind === "all"}">All</button>${KINDS.map(K => `<button type="button" data-nk="${K.k}" aria-pressed="${fKind === K.k}">${icon(K.ico, "i-xs")}${K.label}</button>`).join("")}</div>
        <select class="select" id="nf-by" aria-label="Only stories about one nation">${options(fBy, "Every nation")}</select>
      </div>
      ${list.length ? years.map(y => `<h4 class="news-year"><span>${esc(yearLabel(y))}</span></h4><ul class="stories">${list.filter(n => n.y === y).map(n => editId === n.id ? `<li class="story editing">${storyForm(n)}</li>` : storyHTML(n, { editable: true })).join("")}</ul>`).join("")
        : emptyState(all.length ? "No stories match these filters." : "The presses are quiet. Publish the first story: a declaration, a treaty, a royal wedding, a famine…", { ico: "news", center: true })}
    </section>
  </div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}

function readForm() {
  const v = id => document.getElementById(id).value.trim(), by = v("nw-by"), also = v("nw-also"), y = Math.round(+v("nw-y"));
  return { by, k: v("nw-k"), h: v("nw-h"), b: document.getElementById("nw-b").value.replace(/\r/g, "").trim(), about: [by, also].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i), y: Number.isFinite(y) ? y : CAL.year };
}

export const newsView = {
  render,
  click(e) {
    const nk = e.target.closest("[data-nk]"); if (nk) { fKind = nk.dataset.nk; refresh(); return true; }
    const ed = e.target.closest("[data-edit-news]"); if (ed) { editId = ed.dataset.editNews; refresh(); document.getElementById("newsEdit")?.scrollIntoView({ block: "center", behavior: "smooth" }); return true; }
    const dl = e.target.closest("[data-del-news]");
    if (dl) {
      const i = NEWS.findIndex(n => n.id === dl.dataset.delNews); if (i < 0) return true;
      confirmDialog({ title: `Delete “${NEWS[i].h}”?`, body: "The story is removed from the news feed.", ok: "Delete", danger: true }).then(ok => { if (!ok) return; NEWS.splice(i, 1); persist("news"); refresh(); });
      return true;
    }
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "news-cancel") { editId = null; refresh(); return true; }
    if (a === "year-next" || a === "year-back") {
      CAL.year += a === "year-next" ? 1 : -1; persist("calendar", { quiet: true }); refresh();
      toast(a === "year-next" ? `${yearLabel()} begins` : `Back to ${yearLabel()}`, { kind: "info", sub: "New stories and wars are dated with this year" });
      return true;
    }
  },
  change(e) {
    if (e.target.id === "nf-by") { fBy = e.target.value; history.replaceState(null, "", href("news", fBy)); refresh(); return true; }
    if (e.target.id === "cal-era") { CAL.era = e.target.value.trim(); persist("calendar"); refresh(); return true; }
    if (e.target.id === "nw-by" && e.target.closest("#newsForm")) { draftBy = e.target.value; return true; }
    if (e.target.id === "nw-k" && e.target.closest("#newsForm")) { draftKind = e.target.value; return true; }
  },
  submit(e) {
    if (e.target.id === "newsForm") {
      const v = readForm(); if (!v.h) { toast("Write a headline first", { kind: "err" }); return true; }
      postNews(v); persist("story"); fKind = "all"; refresh();
      return true;
    }
    if (e.target.id === "newsEdit") {
      const n = NEWS.find(x => x.id === e.target.dataset.id), v = readForm(); if (!n) return true;
      if (!v.h) { toast("A story needs a headline", { kind: "err" }); return true; }
      Object.assign(n, { y: v.y, k: v.k, h: v.h }); for (const k of ["by", "b"]) { if (v[k]) n[k] = v[k]; else delete n[k]; }
      if (v.about.length) n.about = v.about; else delete n.about;
      editId = null; persist("story"); refresh(); return true;
    }
  },
};
