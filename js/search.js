/* One searchable index of everything in the world — shared by the global
   search palette and the Encyclopedia, so both always agree. */
import { capName, R, byId, kindLabel, isTerritory, isMovement, govTypes, relTitle, relActive, allCapitals, caps } from "./model.js";
import { CHARS, GOV, TL } from "./store.js";
import { curRel } from "./map/engine.js";
import { emblem } from "./ui/dom.js";
import { portrait } from "./ui/portrait.js";
import { icon } from "./ui/icons.js";
import { href } from "./ui/router.js";

export const CATS = [
  { k: "all", label: "Everything", ico: "book" },
  { k: "nations", label: "Nations", ico: "flag" },
  { k: "territories", label: "Territories", ico: "pin" },
  { k: "movements", label: "Movements & zones", ico: "flame" },
  { k: "characters", label: "Characters", ico: "users" },
  { k: "governments", label: "Governments", ico: "landmark" },
  { k: "wars", label: "Wars", ico: "swords" },
  { k: "alliances", label: "Alliances", ico: "link" },
  { k: "capitals", label: "Capitals", ico: "castle" },
  { k: "events", label: "Historical events", ico: "history" },
];

export function buildIndex() {
  const out = [];
  for (const r of R) {
    const g = GOV[r.id] || {};
    const cat = isTerritory(r) ? "territories" : (isMovement(r) || !r.stats) ? "movements" : "nations";
    const sub = r.of ? `Territory of ${byId[r.of].name}` : r.kind ? `Resistance movement in ${byId[r.in].name}` : [g.gov, g.leader && "ruled by " + g.leader, r.tag].filter(Boolean).join(" · ") || kindLabel(r);
    out.push({ cat, type: kindLabel(r), title: r.name, sub, href: href("nation", r.id), art: emblem(r, 26),
      keys: [r.asWritten, g.gov, g.leader, ...(r.lore || []), ...(r.sketch || [])].filter(Boolean).join(" "), r });
  }
  for (const c of CHARS) {
    const n = byId[c.nation];
    out.push({ cat: "characters", type: "Character", title: c.name || "Unnamed", sub: [c.title, n && n.name].filter(Boolean).join(" · ") || "Character",
      href: href("character", c.id), art: portrait(c, 28), keys: [c.title, c.position, ...(c.bio || []), ...(c.achievements || []), c.importance].filter(Boolean).join(" ") });
  }
  for (const [type, list] of govTypes()) {
    out.push({ cat: "governments", type: "Government", title: type, sub: `${list.length} ${list.length === 1 ? "nation" : "nations"}: ${list.map(r => r.name).join(", ")}`,
      href: href("encyclopedia", "governments", type), art: icon("landmark"), keys: list.map(r => r.name + " " + (GOV[r.id].leader || "")).join(" "), list });
  }
  curRel.forEach((x, i) => {
    if (!byId[x.a] || !byId[x.b]) return;
    const war = x.t === "war";
    out.push({ cat: war ? "wars" : "alliances", type: war ? "War" : "Alliance", title: relTitle(x),
      sub: `${byId[x.a].name} ${war ? "vs" : "and"} ${byId[x.b].name} · ${relActive(x) ? (war ? "ongoing" : "active") : "ended"}${x.started ? " · since " + x.started : ""}${x.outcome ? " · " + x.outcome : ""}`,
      href: href("diplomacy"), art: icon(war ? "swords" : "link"), keys: [x.notes, x.outcome].filter(Boolean).join(" "), rel: x, i });
  });
  for (const c of allCapitals()) {
    const n = caps(c.r).length, own = capName(c.r, c.r.marks.indexOf(c.m));
    out.push({ cat: "capitals", type: "Capital", title: own ? `${own} — capital of ${c.r.name}` : `${c.r.name} — ${n > 1 ? "capital " + (c.i + 1) : "capital"}`,
      sub: `Infrastructure level ${c.level} · ${c.small ? "smaller" : "larger"} population${c.disputed ? " · disputed" : ""}${c.note ? " · " + c.note : ""}`,
      href: href("nation", c.r.id), art: `<span class="circ${c.small ? " sm" : ""}${c.disputed ? " x2" : ""}">${c.level}</span>`, keys: "capital city", cap: [c.x, c.y], r: c.r });
  }
  TL.forEach((m, i) => out.push({ cat: "events", type: "Saved moment", title: m.name, sub: [m.date, m.description].filter(Boolean).join(" · ") || `Moment ${i + 1} on the timeline`, href: href("history"), art: icon("history"), keys: "", order: i }));
  curRel.forEach(x => { if (x.started && byId[x.a] && byId[x.b]) out.push({ cat: "events", type: x.t === "war" ? "War begins" : "Alliance formed", title: relTitle(x), sub: `${x.started}${x.ended ? " – " + x.ended : ""}`, href: href("diplomacy"), art: icon(x.t === "war" ? "swords" : "link"), keys: "", order: 1000 }); });
  for (const r of R) { const f = GOV[r.id]?.founded; if (f) out.push({ cat: "events", type: "Founding", title: `${r.name} founded`, sub: f, href: href("nation", r.id, "government"), art: emblem(r, 26), keys: "", order: 2000 }); }
  return out;
}

/* simple relevance: whole-title > title prefix > word prefix > contains > sub/keywords */
export function score(e, q) {
  if (!q) return 1;
  const t = e.title.toLowerCase(), s = (e.sub || "").toLowerCase(), k = (e.keys || "").toLowerCase();
  let best = 0;
  for (const w of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    let v = 0;
    if (t === w) v = 100; else if (t.startsWith(w)) v = 80; else if (new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t)) v = 60;
    else if (t.includes(w)) v = 40; else if (s.includes(w)) v = 20; else if (k.includes(w)) v = 8;
    if (!v) return 0; best += v;
  }
  return best;
}
export function search(q, list = buildIndex()) {
  return list.map(e => [e, score(e, q)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || a[0].title.localeCompare(b[0].title)).map(([e]) => e);
}

