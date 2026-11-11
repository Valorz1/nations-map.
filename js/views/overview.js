/* OVERVIEW — the front page of the atlas. */
import { R, isTop, isTerritory, isMovement, allCapitals, rankOf, relActive, relTitle, byId, MAX } from "../model.js";
import { GOV, CHARS, TL, getPref, setPref } from "../store.js";
import { curRel } from "../map/engine.js";
import { viewedMoment } from "../map/timeline.js";
import { esc, plural, emblem, viewHead, secHead, emptyState, dot } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href } from "../ui/router.js";
import { mount, listMode } from "./common.js";
import { legendHTML } from "./legend.js";
import { SECTIONS } from "./sections.js";
import { worldTotals, estimate, short, money, whole } from "../estimates.js";
import { sortedNews, storyHTML, yearLabel } from "./news.js";

/* the record holders, from the estimated figures (nations only, territories counted with their owner) */
function records() {
  const rows = R.filter(r => isTop(r) && r.stats).map(r => ({ r, x: estimate(r) })).filter(o => o.x);
  const best = (f, lowest) => rows.filter(o => f(o) != null).sort((a, b) => (lowest ? f(a) - f(b) : f(b) - f(a)))[0];
  const out = [];
  const add = (ic, title, o, v) => { if (o) out.push([ic, title, o.r, v(o)]); };
  add("globe", "Largest land", best(o => o.x.km2), o => short(o.x.km2) + " km²");
  add("users", "Most people", best(o => o.x.pop), o => short(o.x.pop));
  add("grid", "Most crowded", best(o => o.x.density), o => whole(o.x.density) + " per km²");
  add("compass", "Emptiest", best(o => o.x.density, true), o => (o.x.density < 10 ? o.x.density.toFixed(1) : whole(o.x.density)) + " per km²");
  add("trend", "Biggest economy", best(o => o.x.gdp), o => money(o.x.gdp));
  add("star", "Richest people", best(o => o.x.perHead), o => "$" + whole(o.x.perHead) + " each");
  add("shield", "Largest army", best(o => o.x.troops), o => short(o.x.troops) + " soldiers");
  return out;
}

export function overview(args, opts) {
  listMode(opts);
  const rated = R.filter(r => r.stats?.rate != null).sort((a, b) => b.stats.rate - a.stats.rate || a.name.localeCompare(b.name));
  const nations = R.filter(r => isTop(r) && r.stats).length;
  const wars = curRel.filter(x => x.t === "war" && relActive(x)), allies = curRel.filter(x => x.t === "ally" && relActive(x));
  const past = viewedMoment();
  const tiles = [
    ["flag", nations, "Nations", href("nations")],
    ["pin", R.filter(isTerritory).length, "Territories", href("encyclopedia", "territories")],
    ["flame", R.filter(isMovement).length, "Resistance movements", href("encyclopedia", "movements")],
    ["castle", allCapitals().length, "Capital cities", href("rankings", "infrastructure")],
    ["users", CHARS.length, "Characters", href("characters")],
    ["swords", wars.length, wars.length === 1 ? "War" : "Wars", href("diplomacy")],
    ["link", allies.length, allies.length === 1 ? "Alliance" : "Alliances", href("diplomacy")],
    ["history", TL.length, "Saved moments", href("history")],
  ];
  const top3 = rated.slice(0, 3);
  const world = worldTotals();
  tiles.splice(2, 0, ["users", short(world.pop), "People (estimated)", href("rankings", "people")], ["trend", money(world.gdp), "World economy (est.)", href("rankings", "people")]);
  const news = sortedNews().slice(0, 3);
  const showIntro = getPref("introDismissed", false) !== true;

  const html = viewHead({
    eyebrow: "Atlas overview", ico: "globe", title: "The Known World",
    sub: `<a class="pill gold" href="${href("news")}">${icon("calendar")}${esc(yearLabel())}</a><span>An invented world of ${plural(nations, "nation")}, traced from a hand-drawn pencil map.</span>`,
  }) + `<div class="vb">
    ${past ? `<div class="callout">${icon("history")}<span>You're viewing the past: <b>${esc(past.name)}</b>${past.date ? ` (${esc(past.date)})` : ""}. Figures below are from that moment.</span></div>` : ""}
    <div class="btn-row quick"><a class="btn btn-sm" href="#/war">${icon("swords")}War simulator</a><a class="btn btn-sm" href="${href("rankings", "compare")}">${icon("scale")}Compare nations</a><a class="btn btn-sm" href="${href("rankings", "people")}">${icon("users")}People &amp; GDP</a></div>

    <section class="sec">${secHead("At a glance")}
      <div class="tiles">${tiles.map(([ic, v, k, h]) => `<a class="tile" href="${h}"><span class="ti">${icon(ic, "i-sm")}</span><span class="tv">${v}</span><span class="tk">${k}</span></a>`).join("")}</div>
    </section>

    <section class="sec">${secHead("Latest headlines", "", `<a class="btn btn-xs btn-ghost" href="${href("news")}">The World Herald${icon("arrow-right")}</a>`)}
      ${news.length ? `<ul class="stories">${news.map(n => storyHTML(n, { compact: true })).join("")}</ul>`
        : emptyState("No news yet. Nations can publish declarations, treaties and events in the World Herald.", { action: `<a class="btn btn-sm" href="${href("news")}">${icon("megaphone")}Publish the first story</a>` })}
    </section>

    <section class="sec">${secHead("Great powers", "", `<a class="btn btn-xs btn-ghost" href="${href("rankings")}">All rankings${icon("arrow-right")}</a>`)}
      <ol class="powers">${top3.map((r, i) => {
        const g = GOV[r.id] || {};
        return `<li><a class="power card click" href="${href("nation", r.id)}">
          <span class="medal m${i + 1}" aria-label="Rank ${i + 1}">${i + 1}</span>
          ${emblem(r, 38)}
          <span class="pw-t"><b>${esc(r.name)}</b><small>${[g.gov, g.leader && "ruled by " + g.leader].filter(Boolean).map(esc).join(" · ") || "Government not recorded"}</small></span>
          <span class="pw-v"><b>${r.stats.rate}</b><small>Rate</small></span></a></li>`;
      }).join("")}</ol>
    </section>

    <section class="sec">${secHead("World records", "estimated from the map", `<a class="btn btn-xs btn-ghost" href="${href("rankings", "people")}">All figures${icon("arrow-right")}</a>`)}
      <ul class="recs">${records().map(([ic, title, r, v]) => `<li><a class="rec" href="${href("nation", r.id)}"><span class="rec-ic">${icon(ic, "i-sm")}</span><span class="rec-t"><small>${title}</small><b>${esc(r.name)}</b></span><span class="rec-v">${v}</span></a></li>`).join("")}</ul>
    </section>

    <section class="sec">${secHead("Balance of power", "by Rate")}
      <ol class="balance" aria-label="Nations by Rate">${rated.map(r => {
        const rk = rankOf(r, "rate");
        return `<li><a href="${href("nation", r.id)}"><span class="bp-r">${rk.rank}</span><span class="bp-n">${dot(r)}<span>${esc(r.name)}</span></span>
          <span class="bp-bar"><i style="width:${(r.stats.rate / MAX.rate * 100).toFixed(1)}%"></i></span><b class="bp-v">${r.stats.rate}</b></a></li>`;
      }).join("")}</ol>
    </section>

    <section class="sec">${secHead("Current affairs", "", `<a class="btn btn-xs btn-ghost" href="${href("diplomacy")}">Diplomacy${icon("arrow-right")}</a>`)}
      ${wars.length || allies.length ? `<ul class="affairs">${[...wars, ...allies].slice(0, 6).map(x => `<li class="aff ${x.t}">
        <span class="aff-ic">${icon(x.t === "war" ? "swords" : "link", "i-sm")}</span>
        <span class="aff-t"><b>${esc(relTitle(x))}</b><small>${x.t === "war" ? "At war" : "Allied"}${x.started ? " since " + esc(x.started) : ""}</small></span>
        <span class="aff-p">${emblem(byId[x.a], 20)}${emblem(byId[x.b], 20)}</span></li>`).join("")}</ul>`
        : emptyState("The world is at peace: no wars or alliances have been recorded yet.", { action: `<a class="btn btn-sm" href="${href("diplomacy")}">${icon("plus")}Record a war or alliance</a>` })}
    </section>

    <section class="sec">${secHead("Explore the world")}
      <div class="explore">${SECTIONS.filter(s => s.k !== "overview").map(s => `<a class="exp card click" href="#/${s.k}"><span class="exp-ic">${icon(s.ico)}</span><b>${s.label}</b><small>${s.desc}</small></a>`).join("")}</div>
    </section>

    <details class="sec keybox"><summary>${secHead("Map key")}</summary>${legendHTML()}</details>
  </div>`;
  mount(html, opts, { size: "std", sheetTo: "full" });
}

export function overviewClick(e) {
  if (e.target.closest('[data-act="dismiss-intro"]')) { setPref("introDismissed", true); e.target.closest(".intro").remove(); return true; }
  return false;
}
