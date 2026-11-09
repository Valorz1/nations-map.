/* CHARACTERS — rulers, generals and heroes: gallery, profiles and the editor. */
import { R, byId, charById, isRuler, sortedByName } from "../model.js";
import { CHARS, GOV, persist } from "../store.js";
import { highlight } from "../map/engine.js";
import { esc, emblem, dot, viewHead, secHead, emptyState } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { portrait, PDEF, HAIR, HEAD, FACE } from "../ui/portrait.js";
import { confirmDialog, toast } from "../ui/feedback.js";
import { href, go, refresh } from "../ui/router.js";
import { mount, listMode } from "./common.js";

let q = "", nationFilter = "", draftPhoto, draft = null;

/* compact card used in dossiers and lists */
export function charCard(c) {
  const n = byId[c.nation];
  return `<li><a class="cc" href="${href("character", c.id)}">${portrait(c, 46)}<span class="ct"><b>${esc(c.name)}</b>${c.title ? `<span>${esc(c.title)}</span>` : n ? `<span>${esc(n.name)}</span>` : ""}</span>${isRuler(c) ? `<span class="pill gold sm">${icon("crown")}Ruler</span>` : ""}${icon("chev-right", "i-sm cc-go")}</a></li>`;
}

/* ---------------- gallery ---------------- */
function gallery(args, opts) {
  listMode(opts);
  const match = c => (!nationFilter || c.nation === nationFilter) && (!q || [c.name, c.title, c.position, byId[c.nation]?.name].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));
  const nationsWith = sortedByName(R.filter(r => CHARS.some(c => c.nation === r.id)));
  const opts2 = nationsWith.map(r => `<option value="${r.id}"${nationFilter === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("");
  const html = viewHead({
    eyebrow: "Characters", ico: "users", title: "Figures of the World",
    sub: `<span>${CHARS.length} ${CHARS.length === 1 ? "character" : "characters"} · rulers, generals and heroes</span>`,
    acts: `<a class="btn btn-sm btn-primary" href="${href("character", "new")}">${icon("plus")}Add character</a>`,
    tools: `<div class="searchbox">${icon("search")}<input id="cq" class="input" type="search" placeholder="Search by name, title or nation" value="${esc(q)}" aria-label="Search characters"></div>
      ${nationsWith.length > 1 ? `<select id="cn" class="select sel-auto" aria-label="Filter by nation"><option value="">All nations</option>${opts2}</select>` : ""}`,
  }) + `<div class="vb" id="charList">${galleryBody(match)}</div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}
function galleryBody(match) {
  if (!CHARS.length) return emptyState("No characters yet. Add the rulers, generals and heroes of your world, with a drawn portrait or a photo.", { title: "An empty hall", ico: "users", center: true, action: `<a class="btn btn-primary" href="${href("character", "new")}">${icon("plus")}Add the first character</a>` });
  const list = CHARS.filter(match);
  if (!list.length) return emptyState(`No one matches your search.`, { center: true, ico: "search", action: `<button type="button" class="btn btn-sm" data-act="clear">Clear filters</button>` });
  const groups = sortedByName(R.filter(r => list.some(c => c.nation === r.id))), loose = list.filter(c => !byId[c.nation]);
  const card = c => { const n = byId[c.nation]; return `<li><a class="cc-card" href="${href("character", c.id)}">
      <span class="cc-por">${portrait(c, 92)}</span>${isRuler(c) ? `<span class="pill gold sm cc-badge">${icon("crown")}Ruler</span>` : ""}
      <b>${esc(c.name)}</b><span class="cc-title">${c.title ? esc(c.title) : "&nbsp;"}</span>
      ${n ? `<span class="cc-n">${dot(n)}${esc(n.name)}</span>` : `<span class="cc-n muted">No nation</span>`}</a></li>`; };
  return groups.map(r => `<section class="sec">${secHead(`${esc(r.name)}`, String(list.filter(c => c.nation === r.id).length), `<a class="btn btn-xs btn-ghost" href="${href("nation", r.id, "people")}">Dossier${icon("arrow-right")}</a>`)}
      <ul class="cc-grid">${list.filter(c => c.nation === r.id).map(card).join("")}</ul></section>`).join("")
    + (loose.length ? `<section class="sec">${secHead("No nation", String(loose.length))}<ul class="cc-grid">${loose.map(card).join("")}</ul></section>` : "");
}

/* ---------------- profile ---------------- */
function profile(c, opts) {
  const n = byId[c.nation], g = n ? GOV[n.id] || {} : {}, ruler = isRuler(c);
  if (n) highlight(n.id, { withHost: false }); else highlight(null);
  const others = n ? CHARS.filter(x => x.nation === n.id && x.id !== c.id) : [];
  const block = (title, content, emptyText) => `<section class="sec">${secHead(title)}${content || `<p class="inline-empty">${emptyText}</p>`}</section>`;
  const html = `<header class="vh notabs char-h">
      <div class="vh-top"><a class="btn btn-xs btn-ghost back" href="${href("characters")}">${icon("chev-left")}Characters</a><span style="flex:1"></span>
        <div class="vh-acts"><a class="btn btn-xs" href="${href("character", c.id, "edit")}">${icon("edit")}Edit</a></div></div>
      <div class="ch-hero"><div class="ch-por">${portrait(c, 132)}</div>
        <div class="ch-t"><span class="eyebrow">${icon(ruler ? "crown" : "user")}${ruler ? "Head of state" : "Character profile"}</span>
          <h2 class="vh-title" tabindex="-1">${esc(c.name)}</h2>${c.title ? `<p class="ch-title">${esc(c.title)}</p>` : ""}
          <div class="vh-sub">${n ? `<a class="pill" href="${href("nation", n.id)}">${emblem(n, 16)}${esc(n.name)}</a>` : `<span class="pill dim">No nation</span>`}${g.gov ? `<span class="pill">${icon("landmark")}${esc(g.gov)}</span>` : ""}</div></div></div>
    </header>
    <div class="vb">
      ${block("Biography", c.bio && c.bio.length ? `<div class="prose">${c.bio.map(x => `<p>${esc(x)}</p>`).join("")}</div>` : "", "No biography yet. Use Edit to write one.")}
      ${block("Political position", c.position ? `<p class="lead">${esc(c.position)}</p>` : "", ruler ? `Rules ${esc(n.name)}${g.gov ? ` (${esc(g.gov)})` : ""}. No further detail recorded.` : "Not recorded yet.")}
      ${block("Achievements", c.achievements && c.achievements.length ? `<ul class="achv">${c.achievements.map(a => `<li>${icon("medal", "i-sm")}<span>${esc(a)}</span></li>`).join("")}</ul>` : "", "No achievements recorded yet.")}
      ${block("Historical importance", c.importance ? `<div class="prose quote"><p>${esc(c.importance)}</p></div>` : "", "Not recorded yet.")}
      ${n ? `<section class="sec">${secHead(`Also from ${esc(n.name)}`, others.length ? String(others.length) : "")}${others.length ? `<ul class="ccs">${others.map(charCard).join("")}</ul>` : `<p class="inline-empty">No one else yet.</p>`}
        <div class="btn-row"><a class="btn btn-sm" href="${href("character", "new", n.id)}">${icon("plus")}Add someone from ${esc(n.name)}</a></div></section>` : ""}
    </div>`;
  mount(html, opts, { size: "std", sheetTo: "half" });
}

/* ---------------- editor ---------------- */
function lookFields(p) {
  const col = (k, l) => `<label class="cf"><input type="color" id="cl-${k}" value="${p[k]}"><span>${l}</span></label>`;
  const sel = (k, l, opts) => `<label class="field"><span>${l}</span><select class="select" id="cl-${k}">${opts.map(([v, t]) => `<option value="${v}"${p[k] === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
  return `<div class="cols">${col("skin", "Skin")}${col("hair", "Hair")}${col("outfit", "Outfit")}${col("accent", "Accent")}${col("bg", "Background")}</div>${sel("hairStyle", "Hairstyle", HAIR)}${sel("head", "Headwear", HEAD)}${sel("face", "Face", FACE)}`;
}
function editor(c, isNew, opts) {
  highlight(null);
  const p = Object.assign({}, PDEF, c.look || {});
  if (draftPhoto === undefined) draftPhoto = c.photo || null;
  const nopts = sortedByName(R).map(r => `<option value="${r.id}"${c.nation === r.id ? " selected" : ""}>${esc(r.name)}</option>`).join("");
  const html = viewHead({ eyebrow: isNew ? "New character" : "Edit character", ico: "edit", title: isNew ? "A new figure" : esc(c.name),
      close: isNew ? href("characters") : href("character", c.id) })
    + `<div class="vb"><form id="charForm" class="char-form" novalidate>
      <div class="cf-side card card-pad">
        <div class="cprev" id="cprev">${portrait({ ...c, photo: draftPhoto }, 148)}</div>
        <p class="field-label">Photo</p>
        <div class="btn-row"><label class="btn btn-sm" for="cf-photo">${icon("upload")}${draftPhoto ? "Change photo" : "Upload photo"}</label><input id="cf-photo" type="file" accept="image/*" hidden>${draftPhoto ? `<button type="button" class="btn btn-sm btn-ghost" data-act="nophoto">Use drawn portrait</button>` : ""}</div>
        <p class="hint">A photo replaces the drawn portrait. It's cropped to a circle and shrunk to keep the map fast.</p>
        <p class="field-label">Drawn portrait</p>${lookFields(p)}
      </div>
      <div class="cf-main">
        <label class="field"><span>Name <em class="req">required</em></span><input class="input" id="cf-name" type="text" value="${esc(c.name || "")}" placeholder="e.g. Shero" aria-required="true"><small class="err" id="cf-err" hidden>Give this character a name.</small></label>
        <label class="field"><span>Title</span><input class="input" id="cf-title" type="text" value="${esc(c.title || "")}" placeholder="e.g. Dictator of the Sherolean Empire"></label>
        <label class="field"><span>Nation</span><select class="select" id="cf-nation"><option value="">No nation</option>${nopts}</select></label>
        <label class="field"><span>Political position</span><input class="input" id="cf-position" type="text" value="${esc(c.position || "")}" placeholder="e.g. Supreme commander and head of state"></label>
        <label class="field"><span>Biography</span><textarea class="textarea" id="cf-bio" rows="6" placeholder="Who are they? What have they done? Leave a blank line between paragraphs.">${esc((c.bio || []).join("\n\n"))}</textarea></label>
        <label class="field"><span>Achievements</span><textarea class="textarea" id="cf-ach" rows="4" placeholder="One achievement per line">${esc((c.achievements || []).join("\n"))}</textarea><small>One per line.</small></label>
        <label class="field"><span>Historical importance</span><textarea class="textarea" id="cf-imp" rows="3" placeholder="Why do they matter to the history of the world?">${esc(c.importance || "")}</textarea></label>
      </div>
      <div class="form-acts cf-acts"><button type="submit" class="btn btn-primary">${icon("check")}Save character</button><a class="btn" href="${isNew ? href("characters") : href("character", c.id)}" data-act="cancel">Cancel</a><span class="spacer"></span>${isNew ? "" : `<button type="button" class="btn btn-danger-ghost" data-act="delete">${icon("trash")}Delete</button>`}</div>
    </form></div>`;
  mount(html, opts, { size: "wide", sheetTo: "full" });
}

function readLook() { const g = k => document.getElementById("cl-" + k)?.value; return { skin: g("skin"), hair: g("hair"), outfit: g("outfit"), accent: g("accent"), bg: g("bg"), hairStyle: g("hairStyle"), head: g("head"), face: g("face") }; }
const preview = () => { const pv = document.getElementById("cprev"); if (pv) pv.innerHTML = portrait({ name: document.getElementById("cf-name").value, look: readLook(), photo: draftPhoto }, 148); };

/* ---------------- routes ---------------- */
export const charactersView = { render: gallery,
  input(e) { if (e.target.id === "cq") { q = e.target.value.trim(); rerenderList(); return true; } },
  change(e) { if (e.target.id === "cn") { nationFilter = e.target.value; rerenderList(); return true; } },
  click(e) { if (e.target.closest('[data-act="clear"]')) { q = ""; nationFilter = ""; refresh(); return true; } },
};
function rerenderList() {
  const match = c => (!nationFilter || c.nation === nationFilter) && (!q || [c.name, c.title, c.position, byId[c.nation]?.name].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));
  document.getElementById("charList").innerHTML = galleryBody(match);
}

export const characterView = {
  render(args, opts) {
    const [id, sub] = args;
    if (id === "new") {
      if (!opts.same || !draft) { draftPhoto = undefined; draft = { id: "c" + Date.now().toString(36), name: "", title: "", nation: sub && byId[sub] ? sub : "", look: { ...PDEF }, bio: [] }; }
      editor(draft, true, opts); return;
    }
    const c = charById(id);
    if (!c) { toast("That character no longer exists", { kind: "info" }); go("characters"); return; }
    if (sub === "edit") { if (!opts.same) draftPhoto = undefined; editor(c, false, opts); return; }
    draftPhoto = undefined; profile(c, opts);
  },
  input(e) { if (e.target.id && /^(cl-|cf-name)/.test(e.target.id)) { preview(); if (e.target.id === "cf-name") document.getElementById("cf-err").hidden = true; return true; } },
  change(e) {
    if (e.target.id && e.target.id.startsWith("cl-")) { preview(); return true; }
    if (e.target.id === "cf-photo" && e.target.files[0]) {
      const f = e.target.files[0], img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => {
        const S = 320, cv = document.createElement("canvas"); cv.width = cv.height = S; const m = Math.min(img.width, img.height), cx = cv.getContext("2d");
        cx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(url); draftPhoto = cv.toDataURL("image/jpeg", .82);
        preview(); toast("Photo ready", { kind: "info", sub: "Save the character to keep it" });
      };
      img.onerror = () => toast("That image couldn't be read", { kind: "err" });
      img.src = url; return true;
    }
  },
  click(e) {
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "nophoto") { draftPhoto = null; preview(); e.target.closest("button").remove(); return true; }
    if (a === "cancel") { draftPhoto = undefined; draft = null; return false; }
    if (a === "delete") {
      const [id] = location.hash.replace(/^#\/character\//, "").split("/"); const c = charById(decodeURIComponent(id));
      confirmDialog({ title: `Delete ${c ? c.name : "this character"}?`, body: "Their profile, biography and portrait will be removed. This can't be undone.", ok: "Delete character", danger: true }).then(ok => {
        if (!ok) return; const i = CHARS.findIndex(x => x.id === c.id); if (i >= 0) CHARS.splice(i, 1);
        persist("characters", { quiet: true }); toast(`${c.name} was deleted`, { kind: "info" }); go("characters");
      });
      return true;
    }
  },
  submit(e) {
    if (e.target.id !== "charForm") return;
    const v = k => document.getElementById("cf-" + k).value.trim(), name = v("name");
    if (!name) { document.getElementById("cf-err").hidden = false; document.getElementById("cf-name").focus(); return true; }
    const [idPart] = location.hash.replace(/^#\/character\//, "").split("/");
    const isNew = idPart === "new", id = isNew ? draft.id : decodeURIComponent(idPart);
    const lines = s => s.replace(/\r/g, "").split("\n").map(x => x.trim()).filter(Boolean);
    const data = { name, title: v("title"), nation: document.getElementById("cf-nation").value, look: readLook(),
      bio: document.getElementById("cf-bio").value.replace(/\r/g, "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean),
      position: v("position"), achievements: lines(document.getElementById("cf-ach").value), importance: v("imp") };
    ["position", "importance"].forEach(k => { if (!data[k]) delete data[k]; });
    if (!data.achievements.length) delete data.achievements;
    let c = charById(id); if (!c) { c = { id }; CHARS.push(c); }
    ["position", "importance", "achievements"].forEach(k => { if (!(k in data)) delete c[k]; });
    Object.assign(c, data); if (draftPhoto) c.photo = draftPhoto; else delete c.photo;
    draftPhoto = undefined; draft = null;
    persist(isNew ? "new character" : "character");
    go(`character/${c.id}`);
    return true;
  },
};
