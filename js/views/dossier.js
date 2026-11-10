/* NATION DOSSIER — everything known about one nation, territory or movement. */
import { R, byId, MAX, METRICS, rankOf, avgOf, caps, infra, topLevel, terr, movements, neighbours, kindLabel, isRated,
  relationsOf, otherSide, relTitle, leaderChar, charsOf, statHistory, calcMax, isTop } from "../model.js";
import { EDITS, LORE, GOV, TL, persist, getPref, setPref } from "../store.js";
import { estimate, resourceTable, resourcesOf, tradeDeals, estimateHistory, DENSITY, short, money, whole, pct } from "../estimates.js";
import { LAND_TYPES } from "../map/geography.js";
import { openCard } from "../ui/card.js";
import { capName } from "../model.js";
import { drawCapNames } from "../map/engine.js";
import { highlight, flyToRegion, flyToPoint, drawTags, curRel } from "../map/engine.js";
import { tlPast, viewedMoment } from "../map/timeline.js";
import { esc, emblem, dot, flagHTML, okColour, secHead, emptyState, tabsHTML, tabKeys, signed, plural } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { bullet, sparkline } from "../ui/charts.js";
import { portrait } from "../ui/portrait.js";
import { confirmDialog } from "../ui/feedback.js";
import { href, refresh } from "../ui/router.js";
import { mount, nationSheet } from "./common.js";
import { charCard } from "./characters.js";
import { setSheet, mq, sheet } from "../ui/panel.js";

/* the land of each nation, matching what the Terrain view draws */
const LAND = {
  desert: ["Desert", "Dry sand country. Dunes cover almost all of it, and the Dune Rim mountains wall it off from Marbonese to the south. Very few people can live here."],
  marbonese: ["Grassland", "The biggest land on the map: wide open grassland, with the Greatwood in the east, Lake Marbon in the north, and the River Marbon as its whole eastern border with Elarion."],
  sherolean: ["Woods & mountains", "Green country with the Teddy Woods in the north and the Shero Peaks in the south. Two rivers cross it, one of them the Long River on its way to Baloonia."],
  baloonia: ["River lowland", "Small, rich and well watered. The Long River ends its journey here, passing through Lake Baloon before it leaves the map in the south-west corner."],
  blight: ["Dead land", "Poisoned, dead ground where almost nothing grows and almost nobody lives. The Blightwall Mountains hold it back from the lands to the south."],
  unknown: ["Unmapped", "Nobody has mapped these lands, so nothing is known about them."],
  marmite: ["Highland", "High, hilly ground under the Blightwall Mountains, with the Blight right behind it."],
  elarion: ["Hills & highland", "Rolling hills and highlands. The Blightwall Mountains guard the north, the River Marbon marks the west, and a river runs down to the lake of Elar Mere in the middle."],
  jungle: ["Jungle", "Thick jungle from edge to edge. It is hard to travel through and hard to farm, so few people live here."],
  fiveRivers: ["River country", "Named for the five rivers that rise in the Sunrise Mountains on its eastern edge. They join into the Long River, which flows west across the whole south of the map to Baloonia."],
  royalist: ["Farmland & hills", "Low hills and farmland, with the Long River running through the south."],
  mallies: ["Farmland & woods", "Farmland and woods on the banks of the Long River."],
  maxis: ["Dry plains", "Dry southern plains, with the Axis Ridge along the bottom edge of the map."],
  fuc: ["Wooded plains", "Wooded plains in the middle of the map, with the Long River along the southern side."],
  librebels: ["Woodland", "A small wooded pocket in the south, just below the Long River."],
};

let current = null, editing = null, govEditing = null, loreEditing = null, capEditing = null;

/* what the land is made of, counted from the terrain inside the border */
function landSection(r, est) {
  const total = Object.values(est.land).reduce((a, b) => a + b, 0) || 1;
  const parts = LAND_TYPES.map(([k, label, c]) => ({ k, label, c, f: est.land[k] / total })).filter(p => p.f > .005).sort((a, b) => b.f - a.f);
  return `<section class="sec">${secHead("Land & geography", LAND[r.id]?.[0] || "")}
    <div class="landbar" role="img" aria-label="Land: ${parts.map(p => `${p.label} ${pct(p.f)}`).join(", ")}">${parts.map(p => `<i style="width:${(p.f * 100).toFixed(1)}%;background:${p.c}" title="${p.label} ${pct(p.f)}"></i>`).join("")}</div>
    <ul class="landkey">${parts.map(p => `<li><i style="background:${p.c}"></i>${p.label} <b>${pct(p.f)}</b><small>${DENSITY[p.k] < 1 ? "almost nobody" : DENSITY[p.k] + " people/km²"}</small></li>`).join("")}</ul>
    ${LAND[r.id] ? `<p class="landtext">${esc(LAND[r.id][1])}</p>` : ""}
    <p class="hint">${icon("mountain", "i-xs")}<span>Counted from the terrain inside the border (open <b>Views → Terrain</b> to see it). Good land holds more people, so moving a border onto a river valley adds far more than moving it onto mountains.</span></p></section>`;
}
/* resources from the land, and trade along the roads */
function tradeSection(r, est) {
  const table = resourceTable(), res = resourcesOf(r, table), deals = tradeDeals(r, undefined, table);
  if (!res.length && !deals.length) return "";
  const mx = Math.max(.0001, ...res.map(q => q.share));
  return `<section class="sec">${secHead("Resources & trade", est.tradeBonus ? `+${Math.round(est.tradeBonus * 100)}% GDP from trade` : "")}
    ${res.length ? `<ul class="res">${res.map(q => `<li><span class="res-n"><i style="background:${q.res.color}"></i>${q.res.label}</span><span class="res-bar"><i style="width:${(q.share / mx * 100).toFixed(1)}%;background:${q.res.color}"></i></span><b>${pct(q.share)}</b><small>of the world's supply, from ${q.res.src}</small></li>`).join("")}</ul>` : ""}
    ${deals.length ? `<ul class="deals">${deals.map(d => { const p = byId[d.id]; return `<li class="${d.open ? "" : "closed"}"><a href="${href("nation", p.id)}">${emblem(p, 22)}<b>${esc(p.name)}</b></a><span>${d.open ? [d.sells && `sells ${d.sells.label.toLowerCase()}`, d.buys && `buys ${d.buys.label.toLowerCase()}`].filter(Boolean).join(" · ") || "general goods" : "route closed by war"}</span></li>`; }).join("")}</ul>`
      : `<p class="inline-empty">No road leads straight to a neighbour's capital, so there are no trade routes.</p>`}
    <p class="hint">${icon("info", "i-xs")}A trade route is a road from one of its capitals straight to a neighbour's. Each open route adds 3% to GDP, up to 15%${est.tradeValue ? ` (worth about ${money(est.tradeValue)} now)` : ""}. A war between the two closes the route.</p></section>`;
}
let tab = getPref("dossierTab", "overview");
const TABS = r => [["overview", "Overview", "compass"], ["government", "Government", "landmark"], ["people", "People", "users", charsOf(r.id).length],
  ["relations", "Relations", "swords", relCount(r)], ["history", "History", "scroll"]];
const relCount = r => { const x = relationsOf(r.id, curRel); return x.wars.length + x.allies.length; };

const chip = (r, cls = "") => `<a class="chip ${cls}" href="${href("nation", r.id)}">${dot(r, !!r.kind)}<span>${esc(r.name)}</span></a>`;

function render(args, opts) {
  const id = args[0], r = byId[id];
  if (!r) { location.hash = "#/nations"; return; }
  if (current !== id) { editing = null; govEditing = null; loreEditing = null; capEditing = null; }
  current = id;
  highlight(id);
  if (!opts.same) { nationSheet(opts); if (opts.fly) flyToRegion(id); }
  if (args[1] && TABS(r).some(t => t[0] === args[1])) tab = args[1];
  mount(head(r) + `<div class="vb" id="tp-${tab}" role="tabpanel" aria-labelledby="tab-${tab}">${body(r)}</div>`, opts, { size: "std" });
}

function head(r) {
  const rk = rankOf(r, "rate"), g = GOV[r.id] || {}, past = viewedMoment();
  const pills = [];
  if (r.kind) pills.push(`<span class="pill dim">Resistance in</span><a class="pill" href="${href("nation", r.in)}">${dot(byId[r.in])}${esc(byId[r.in].name)}</a>`);
  else if (r.of) pills.push(`<span class="pill dim">Territory of</span><a class="pill" href="${href("nation", r.of)}">${dot(byId[r.of])}${esc(byId[r.of].name)}</a>`);
  if (rk) pills.push(`<span class="pill gold">${icon("trophy")}#${rk.rank} of ${rk.of} by Rate</span>`);
  if (r.tag) pills.push(`<span class="pill warn">${icon("biohazard")}${esc(r.tag)}</span>`);
  if (g.gov) pills.push(`<span class="pill">${icon("landmark")}${esc(g.gov)}</span>`);
  if (g.leader) pills.push(`<span class="pill">${icon("crown")}${esc(g.leader)}</span>`);
  return `<header class="vh dossier-h">
    <div class="vh-top"><a class="btn btn-xs btn-ghost back" href="${href("nations")}">${icon("chev-left")}Nations</a><span style="flex:1"></span>
      <div class="vh-acts">
        ${isRated(r) ? `<a class="icon-btn icon-btn-sm" href="${href("compare", r.id)}" aria-label="Compare ${esc(r.name)} with another nation" data-tip="Compare">${icon("scale")}</a>` : ""}
        ${r.stats?.m != null && !r.of && !r.kind ? `<a class="icon-btn icon-btn-sm" href="${href("war", r.id)}" aria-label="War simulator with ${esc(r.name)} attacking" data-tip="War simulator">${icon("swords")}</a>` : ""}
        ${r.kind ? "" : `<button type="button" class="icon-btn icon-btn-sm" data-act="card" aria-label="Nation card to save or print" data-tip="Nation card">${icon("card")}</button>`}
        <button type="button" class="icon-btn icon-btn-sm" data-act="zoom" aria-label="Zoom the map to ${esc(r.name)}" data-tip="Zoom to on map">${icon("target")}</button>
      </div></div>
    <div class="dh">${emblem(r, 58)}<div class="dh-t"><span class="eyebrow">${esc(kindLabel(r))} dossier</span>
      <h2 class="vh-title" tabindex="-1">${esc(r.name)}${flagHTML(g.flag)}</h2></div></div>
    ${pills.length ? `<div class="vh-sub">${pills.join("")}</div>` : ""}
    ${past ? `<div class="vh-sub"><span class="pill gold">${icon("history")}Viewing “${esc(past.name)}”</span></div>` : ""}
    ${tabsHTML(TABS(r).map(t => [t[0], t[1], t[2], t[3] || null]), tab, "Dossier sections")}
  </header>`;
}

function body(r) {
  return { overview: tabOverview, government: tabGov, people: tabPeople, relations: tabRelations, history: tabHistory }[tab](r);
}

/* ---------------- overview ---------------- */
function statCard(r, m) {
  const v = r.stats?.[m.k], na = v == null, rk = rankOf(r, m.k), avg = avgOf(m.k);
  return `<div class="stat ${m.cls}${na ? " na" : ""}"><div class="k"><span>${m.label}</span>${rk ? `<em class="${rk.rank === 1 ? "top" : ""}" title="Rank ${rk.rank} of ${rk.of}">#${rk.rank}</em>` : ""}</div>
    <div class="v">${na ? "—" : v}</div><div class="d">${na ? "Not on the sketch" : `<span class="${v >= avg ? "up" : "dn"}">${signed(Math.round(v - avg))}</span> vs world avg`}</div>
    ${bullet(v, { max: MAX[m.k], avg, color: m.color, label: m.long })}</div>`;
}
function tabOverview(r) {
  const s = r.stats || {}, cs = caps(r), past = tlPast();
  let ratings;
  if (editing === r.id) {
    ratings = `<form class="form" id="editForm"><div class="form-title">${icon("edit")}Edit ratings</div>
      <div class="stats">${METRICS.map(m => `<label class="stat ${m.cls} stat-edit"><span class="k">${m.label}</span><input id="ed-${m.k}" class="num-input" type="number" inputmode="numeric" min="0" step="1" value="${s[m.k] ?? ""}" placeholder="—" aria-label="${m.long}"></label>`).join("")}</div>
      <p class="hint">Leave a box empty for “no value”. Ranks and the map's rating tag update when you save.</p>
      <div class="form-acts"><button type="submit" class="btn btn-primary">${icon("check")}Save ratings</button><button type="button" class="btn" data-act="ed-cancel">Cancel</button><span class="spacer"></span>${EDITS[r.id] ? `<button type="button" class="btn btn-danger-ghost" data-act="ed-reset">${icon("undo")}Reset to sketch</button>` : ""}</div></form>`;
  } else if (isRated(r) || !r.kind) {
    ratings = `<div class="stats">${METRICS.map(m => statCard(r, m)).join("")}</div>
      <div class="btn-row">${past ? `<span class="hint">${icon("history", "i-xs")}Slide the timeline back to <b>Now</b> to edit ratings.</span>` : `<button type="button" class="btn btn-sm" data-act="ed-start">${icon("edit")}Edit ratings</button>`}
      ${EDITS[r.id] ? `<span class="hint">Edited · the sketch had Rate ${r.orig.rate ?? "—"}, Military ${r.orig.m ?? "—"}, Economy ${r.orig.e ?? "—"}</span>` : ""}</div>`;
  } else ratings = "";

  const capHTML = r.marks.length ? `<ul class="caps">${r.marks.map((m, i) => m[5]
      ? `<li class="cap"><span class="circ">⊘</span><span class="cap-t"><b>Destroyed / disputed city</b><small>Contested with the Teddy Resistance</small></span><button type="button" class="icon-btn icon-btn-sm" data-cap="${m[1]},${m[2]}" aria-label="Show on map" data-tip="Show on map">${icon("pin")}</button></li>`
      : `<li class="cap"><span class="circ${m[4] ? " x2" : ""}${m[3] ? " sm" : ""}">${m[0]}</span><span class="cap-t"><b>${capEditing === i ? `<form id="capForm" class="cap-form"><input class="input" id="capName" type="text" maxlength="40" value="${esc(capName(r, i))}" placeholder="Name this city" aria-label="City name"><button type="submit" class="btn btn-sm btn-primary">Save</button></form>` : `${esc(capName(r, i)) || (cs.length > 1 ? `Capital ${cs.indexOf(m) + 1}` : "Capital")} · infrastructure ${m[0]}`}</b><small>${m[3] ? "Smaller population" : "Larger population"}${m[4] ? " · disputed" : ""}${m[6] ? " · " + esc(m[6]) : ""}</small></span>
         <button type="button" class="icon-btn icon-btn-sm" data-act="cap-name" data-i="${i}" aria-label="Name this city" data-tip="${capName(r, i) ? "Rename this city" : "Name this city"}">${icon("edit")}</button>
         <button type="button" class="icon-btn icon-btn-sm" data-cap="${m[1]},${m[2]}" aria-label="Show this capital on the map" data-tip="Show on map">${icon("pin")}</button></li>`).join("")}</ul>` : "";
  const infraSummary = cs.length ? `<div class="infra"><div><b>${cs.length}</b><small>${cs.length === 1 ? "capital" : "capitals"}</small></div><div><b>${infra(r)}</b><small>total infrastructure</small></div><div><b>${topLevel(r)}</b><small>highest level</small></div><div><b>${cs.filter(m => !m[3]).length}</b><small>large population</small></div></div>` : "";

  const res = movements(r.id), ts = terr(r.id), nb = r.kind ? [] : neighbours(r.id);
  const est = estimate(r);
  const people = est ? `<section class="sec">${secHead("People & economy", "estimated")}
      <div class="infra est"><div><b>${short(est.pop)}</b><small>population</small></div><div><b>${money(est.gdp)}</b><small>economy (GDP)</small></div><div><b>${est.perHead == null ? "—" : "$" + whole(est.perHead)}</b><small>income per person</small></div><div><b>${short(est.km2)}</b><small>km² of land</small></div></div>
      <p class="hint">${icon("info", "i-xs")}About ${whole(est.density)} people per km², ${short(est.urban)} of them in the capital${caps(r).length === 1 ? "" : "s"}${est.terr ? `. Includes ${plural(est.terr, "territory", "territories")}` : ""}${est.gdp == null ? ". No Economy rating, so no GDP" : ""}. Worked out from the map: land area, the kind of land, the capitals, the Economy rating and trade. Move a border or edit a rating and these change.</p>
      ${est.troops != null ? `<div class="factline">${icon("shield", "i-sm")}<span>Army of about <b>${short(est.troops)}</b> soldiers <small>(${(est.troops / est.pop * 100).toFixed(1)}% of the people, from the Military rating)</small></span></div>` : ""}</section>` : "";
  const land = est ? landSection(r, est) + (r.of ? "" : tradeSection(r, est)) : "";
  return `${ratings ? `<section class="sec">${secHead("Power")}${ratings}</section>` : ""}${people}${land}
    ${r.kind ? "" : `<section class="sec">${secHead("Capitals & infrastructure", cs.length ? String(cs.length) : "")}
      ${r.marks.length ? infraSummary + capHTML : emptyState("No capitals are marked for this place on the sketch.")}
      <p class="hint">${icon("info", "i-xs")}The size of each capital's circle on the map shows whether its population is large or small.</p></section>`}
    ${ts.length ? `<section class="sec">${secHead("Territories", String(ts.length))}<div class="chips">${ts.map(t => chip(t)).join("")}</div></section>` : ""}
    ${res.length ? `<section class="sec">${secHead("Resistance movements", String(res.length))}<div class="chips">${res.map(t => chip(t)).join("")}</div></section>` : ""}
    ${nb.length ? `<section class="sec">${secHead("Shares borders with", String(nb.length))}<div class="chips">${nb.map(n => chip(byId[n])).join("")}</div></section>` : ""}`;
}

/* ---------------- government ---------------- */
function tabGov(r) {
  const g = GOV[r.id] || {}, hostR = r.of ? byId[r.of] : r.in ? byId[r.in] : null;
  if (govEditing === r.id) return `<form id="govForm" class="form"><div class="form-title">${icon("landmark")}Edit government</div>
    <label class="field"><span>Ruled by</span><input class="input" id="g-leader" type="text" value="${esc(g.leader || "")}" placeholder="e.g. Shero, the Senate, a council"></label>
    <label class="field"><span>Government type</span><input class="input" id="g-gov" type="text" list="govTypes" value="${esc(g.gov || "")}" placeholder="e.g. Monarchy"></label>
    <label class="field"><span>Flag colours</span><input class="input" id="g-flag" type="text" value="${esc((g.flag || []).join(", "))}" placeholder="e.g. red, white, #1d4ed8"><small>Separate colours with commas, top stripe first. The national emblem uses these colours. <span id="g-prev">${flagHTML(g.flag, true)}</span></small></label>
    <div class="field-row"><label class="field"><span>Founded</span><input class="input" id="g-founded" type="text" value="${esc(g.founded || "")}" placeholder="e.g. Year 412 after the Blight"></label>
    <label class="field"><span>Population</span><input class="input" id="g-pop" type="text" value="${esc(g.population || "")}" placeholder="e.g. about 2 million"></label></div>
    <datalist id="govTypes">${["Monarchy", "Democracy", "Dictatorship", "Republic", "Communist", "Conservative", "Liberalism", "Anarchy", "Authoritarianism", "Theocracy", "Military junta", "Tribal council", "Federation", "Empire"].map(x => `<option value="${x}">`).join("")}</datalist>
    <div class="form-acts"><button type="submit" class="btn btn-primary">${icon("check")}Save government</button><button type="button" class="btn" data-act="gov-cancel">Cancel</button></div></form>`;
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`, none = `<span class="ns">Not recorded</span>`;
  const has = g.leader || g.gov || (g.flag && g.flag.length) || g.founded || g.population;
  const ch = leaderChar(r);
  return `${!has && hostR ? `<div class="callout info">${icon("info")}<span>No separate government is recorded. It is governed by <a class="link-btn" href="${href("nation", hostR.id, "government")}">${esc(hostR.name)}</a>.</span></div>` : ""}
    <section class="sec">${secHead("Government")}
    <dl class="dl">${row("Ruled by", g.leader ? (ch ? `<a class="ruler" href="${href("character", ch.id)}">${portrait(ch, 28)}${esc(g.leader)}</a>` : esc(g.leader)) : none)}
      ${row("Government", g.gov ? `<span class="pill">${esc(g.gov)}</span>` : none)}
      ${row("Flag", g.flag && g.flag.length ? flagHTML(g.flag, true) : none)}
      ${row("Founded", g.founded ? esc(g.founded) : none)}
      ${row("Population", g.population ? esc(g.population) : none)}
      ${row("On the sketch", `<span class="serif-i">“${esc(r.asWritten)}”</span>`)}</dl>
    <div class="btn-row"><button type="button" class="btn btn-sm" data-act="gov-start">${icon("edit")}Edit government</button></div></section>
    ${ch ? `<section class="sec">${secHead("Head of state")}<ul class="ccs">${charCard(ch)}</ul></section>` : ""}`;
}

/* ---------------- people ---------------- */
function tabPeople(r) {
  const cs = charsOf(r.id), ruler = leaderChar(r);
  return `<section class="sec">${secHead("Characters & important figures", cs.length ? String(cs.length) : "")}
    ${cs.length ? `<ul class="ccs">${[...cs].sort((a, b) => (b === ruler) - (a === ruler)).map(c => charCard(c)).join("")}</ul>`
      : emptyState(`No characters from ${esc(r.name)} have been recorded yet.`, { ico: "users" })}
    <div class="btn-row"><a class="btn btn-sm" href="${href("character", "new", r.id)}">${icon("plus")}Add a character</a></div></section>`;
}

/* ---------------- relations ---------------- */
function tabRelations(r) {
  const { wars, allies, past } = relationsOf(r.id, curRel);
  const involved = new Set([...wars, ...allies].map(x => otherSide(x, r.id)));
  const neutral = R.filter(x => isTop(x) && x.stats && x.id !== r.id && !involved.has(x.id));
  const relRow = (x, cls) => { const o = byId[otherSide(x, r.id)]; return `<li class="relcard ${cls}"><a href="${href("nation", o.id)}">${emblem(o, 26)}<span class="rc-t"><b>${esc(o.name)}</b><small>${esc(relTitle(x))}${x.started ? " · since " + esc(x.started) : ""}${x.status === "ended" && x.outcome ? " · " + esc(x.outcome) : ""}</small></span></a></li>`; };
  return `<div class="rel-sum"><div class="rs war"><b>${wars.length}</b><small>${icon("swords", "i-xs")}Enemies</small></div><div class="rs ally"><b>${allies.length}</b><small>${icon("link", "i-xs")}Allies</small></div><div class="rs"><b>${neutral.length}</b><small>Neutral</small></div></div>
    <section class="sec">${secHead("At war with")}${wars.length ? `<ul class="relcards">${wars.map(x => relRow(x, "war")).join("")}</ul>` : `<p class="inline-empty">Not at war with anyone.</p>`}</section>
    <section class="sec">${secHead("Allied with")}${allies.length ? `<ul class="relcards">${allies.map(x => relRow(x, "ally")).join("")}</ul>` : `<p class="inline-empty">No alliances recorded.</p>`}</section>
    ${past.length ? `<section class="sec">${secHead("Past conflicts & ended alliances")}<ul class="relcards">${past.map(x => relRow(x, "ended")).join("")}</ul></section>` : ""}
    ${neutral.length && !r.kind ? `<details class="sec neutral-box"><summary>${secHead("Neutral towards", String(neutral.length))}</summary><div class="chips">${neutral.map(n => chip(n, "neutral")).join("")}</div></details>` : ""}
    <div class="btn-row">${tlPast() ? `<span class="hint">${icon("history", "i-xs")}Slide the timeline to Now to change relations.</span>` : `<a class="btn btn-sm" href="${href("diplomacy", r.id)}">${icon("swords")}Manage wars &amp; alliances</a>`}</div>`;
}

/* ---------------- history & lore ---------------- */
function tabHistory(r) {
  const lore = r.lore && r.lore.length ? r.lore : null;
  const loreBlock = loreEditing === r.id
    ? `<form id="loreForm" class="form"><div class="form-title">${icon("quill")}${lore ? "Edit lore" : "Add lore"}</div>
        <textarea id="loreText" class="textarea" rows="9" aria-label="Lore for ${esc(r.name)}" placeholder="Write the history, rulers, wars, alliances… Leave a blank line between paragraphs.">${esc((r.lore || []).join("\n\n"))}</textarea>
        <div class="form-acts"><button type="submit" class="btn btn-primary">${icon("check")}Save lore</button><button type="button" class="btn" data-act="lore-cancel">Cancel</button></div></form>`
    : `${lore ? `<div class="prose quote">${lore.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : emptyState(`No lore has been written for ${esc(r.name)} yet.`, { ico: "quill" })}
       <div class="btn-row"><button type="button" class="btn btn-sm" data-act="lore-start">${icon("edit")}${lore ? "Edit lore" : "Write lore"}</button></div>`;
  const series = isRated(r) && TL.length ? METRICS.map(m => ({ m, s: statHistory(r, m.k) })).filter(x => x.s.filter(p => p.v != null).length >= 2) : [];
  return `<section class="sec">${secHead("Lore")}${loreBlock}</section>
    ${isRated(r) ? `<section class="sec">${secHead("Power over time")}${series.length ? `<div class="sparks">${series.map(({ m, s }) => {
      const vals = s.filter(p => p.v != null), first = vals[0].v, last = vals[vals.length - 1].v;
      return `<div class="spark-card"><div class="sp-h"><span>${m.label}</span><b>${last}</b><em class="${last >= first ? "up" : "dn"}">${signed(last - first)}</em></div>${sparkline(s, { color: m.hex, name: m.long })}<div class="sp-x"><span>${esc(s[0].label)}</span><span>Now</span></div></div>`;
    }).join("")}</div>` : `<p class="inline-empty">${TL.length ? "Ratings haven't changed across the saved moments." : `Save moments on the <a class="link-btn" href="${href("history")}">timeline</a> to track how this nation's power changes.`}</p>`}</section>` : ""}
    ${peopleHistory(r)}
    <section class="sec">${secHead("Notes from the original sketch")}
      <p class="hint">Written on the sketch as <span class="serif-i">“${esc(r.asWritten)}”</span></p>
      ${r.sketch.length ? `<ul class="notes">${r.sketch.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="inline-empty">No extra notes on the sketch.</p>`}</section>`;
}

/* population and economy at every saved moment (borders, ratings and wars of the day) */
function peopleHistory(r) {
  if (!estimate(r)) return "";
  if (!TL.length) return `<section class="sec">${secHead("People & economy over time")}<p class="inline-empty">Save moments on the <a class="link-btn" href="${href("history")}">timeline</a> to see this nation's population and economy grow or shrink.</p></section>`;
  const h = estimateHistory(r);
  const cards = [["pop", "Population", "#b98a2b", short], ["gdp", "Economy (GDP)", "#3a9fd8", money]].map(([k, label, color, fmt]) => {
    const s = h.map(p => ({ label: p.label, v: p[k] })), vals = s.filter(p => p.v != null); if (vals.length < 2) return "";
    const first = vals[0].v, last = vals[vals.length - 1].v, ch = first ? (last - first) / first : 0;
    return `<div class="spark-card"><div class="sp-h"><span>${label}</span><b>${fmt(last)}</b><em class="${last >= first ? "up" : "dn"}">${Math.abs(ch) < .0005 ? "±0%" : (ch > 0 ? "+" : "−") + pct(Math.abs(ch))}</em></div>${sparkline(s, { color, name: label })}<div class="sp-x"><span>${esc(s[0].label)}</span><span>Now</span></div></div>`;
  }).join("");
  return `<section class="sec">${secHead("People & economy over time", "estimated")}${cards ? `<div class="sparks">${cards}</div>` : `<p class="inline-empty">Not enough data yet.</p>`}
    <p class="hint">${icon("info", "i-xs")}Worked out again for each saved moment, using the borders, ratings and wars of that day.</p></section>`;
}

/* ---------------- actions ---------------- */
function rerender() { refresh(); }
async function commitRatings() { editing = null; calcMax(); drawTags(); persist("ratings"); rerender(); }

function setTab(k) {
  tab = k; setPref("dossierTab", k);
  editing = govEditing = loreEditing = null;
  history.replaceState(null, "", href("nation", current) + (k === "overview" ? "" : "/" + k));
  refresh();
  document.getElementById("tab-" + k)?.focus({ preventScroll: true });
  document.querySelector(".vh .tabs [aria-selected=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export const dossierView = {
  render,
  click(e) {
    const t = e.target.closest("[data-tab]"); if (t) { setTab(t.dataset.tab); return true; }
    const cap = e.target.closest("[data-cap]"); if (cap) { const [x, y] = cap.dataset.cap.split(",").map(Number); flyToPoint(x, y); return true; }
    const cn = e.target.closest("[data-act='cap-name']"); if (cn) { capEditing = capEditing === +cn.dataset.i ? null : +cn.dataset.i; rerender(); document.getElementById("capName")?.focus(); return true; }
    const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
    if (a === "zoom") { flyToRegion(current); return true; }
    if (a === "card") { openCard(byId[current], LAND[current]?.[1] || ""); return true; }
    if (a === "ed-start") { editing = current; rerender(); if (mq.matches && sheet === "peek") setSheet("half"); document.getElementById("ed-rate")?.focus(); return true; }
    if (a === "ed-cancel") { editing = null; rerender(); return true; }
    if (a === "ed-reset") {
      confirmDialog({ title: "Reset ratings to the sketch?", body: "Rate, Military and Economy go back to the values written on the original sketch.", ok: "Reset ratings" }).then(ok => {
        if (!ok) return; const r = byId[current]; delete EDITS[current];
        r.stats = r.orig.rate == null && r.orig.m == null && r.orig.e == null ? null : Object.assign(r.stats || {}, r.orig); commitRatings();
      }); return true;
    }
    if (a === "gov-start") { govEditing = current; rerender(); if (mq.matches && sheet !== "full") setSheet("full"); const f = document.getElementById("g-leader"); f && (f.focus(), f.scrollIntoView({ block: "center" })); return true; }
    if (a === "gov-cancel") { govEditing = null; rerender(); return true; }
    if (a === "lore-start") { loreEditing = current; rerender(); if (mq.matches) setSheet("full"); const t2 = document.getElementById("loreText"); t2 && (t2.focus(), t2.scrollIntoView({ block: "center" })); return true; }
    if (a === "lore-cancel") { loreEditing = null; rerender(); return true; }
  },
  keydown(e) { return tabKeys(e); },
  input(e) {
    if (e.target.id === "g-flag") { const c = e.target.value.split(",").map(x => x.trim()).filter(Boolean).filter(okColour).slice(0, 6); document.getElementById("g-prev").innerHTML = flagHTML(c, true); return true; }
  },
  submit(e) {
    const id = e.target.id;
    if (id === "editForm") {
      const r = byId[current], v = {};
      for (const k of ["rate", "m", "e"]) { const x = document.getElementById("ed-" + k).value.trim(); v[k] = x === "" ? null : Math.max(0, Math.round(+x)); }
      EDITS[current] = v; r.stats = Object.assign({ x: r.label.x, y: r.label.y + r.label.l.length * r.label.s * .55 + 34 }, r.stats || {}, v); commitRatings(); return true;
    }
    if (id === "capForm") {
      const g = GOV[current] || (GOV[current] = {}), names = g.capNames || (g.capNames = {}), v = document.getElementById("capName").value.trim();
      if (v) names[capEditing] = v; else delete names[capEditing];
      if (!Object.keys(names).length) delete g.capNames; if (!Object.keys(g).length) delete GOV[current];
      capEditing = null; drawCapNames(); persist("city name"); rerender(); return true;
    }
    if (id === "govForm") {
      const v = k => document.getElementById("g-" + k).value.trim(), flag = v("flag").split(",").map(x => x.trim()).filter(Boolean).filter(okColour).slice(0, 6);
      const g = { ...(GOV[current] || {}), leader: v("leader"), gov: v("gov"), flag, founded: v("founded"), population: v("pop") };
      Object.keys(g).forEach(k => { if (!g[k] || (Array.isArray(g[k]) && !g[k].length)) delete g[k]; });
      if (Object.keys(g).length) GOV[current] = g; else delete GOV[current];
      govEditing = null; persist("government details"); rerender(); return true;
    }
    if (id === "loreForm") {
      const r = byId[current], paras = document.getElementById("loreText").value.replace(/\r/g, "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
      if (paras.length) { LORE[current] = paras; r.lore = paras; } else { delete LORE[current]; r.lore = null; }
      loreEditing = null; persist("lore"); rerender(); return true;
    }
  },
};
export const dossierCurrent = () => current;
