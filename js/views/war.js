/* WAR ROOM — a what-if simulator: pick an attacker and a defender and see who
   would probably win. Nothing here changes the world; no war is declared.

   Each side's strength = soldiers x training x supply, plus help from allies.
     soldiers  estimated from population and the Military rating
     training  0.5 + Military rating / 100
     supply    richer nations equip their armies better (income per person)
     allies    each ally that is not also allied to the enemy sends 35%
   The defender then gets bonuses for rough land (mountains, forest, hills,
   jungle, desert), for a river on the shared border and for fortified
   capitals. An attacker with no shared border must march through other
   lands first and loses a fifth of its strength.                           */
import { R, byId, neighbours, relationsOf, otherSide, infra, isTop } from "../model.js";
import { GOV } from "../store.js";
import { curRel } from "../map/engine.js";
import { riverBorder } from "../map/geography.js";
import { estimate, short, whole, pct } from "../estimates.js";
import { esc, emblem, viewHead, secHead } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { href, go } from "../ui/router.js";
import { mount, listMode } from "./common.js";
import { highlight } from "../map/engine.js";

let A = null, D = null;
const pool = () => R.filter(r => isTop(r) && r.stats && r.stats.m != null).sort((a, b) => a.name.localeCompare(b.name));

function force(r, maxHead) {
  const x = estimate(r), m = r.stats.m || 0;
  const training = .5 + m / 100, supply = .8 + .4 * ((x.perHead || 0) / (maxHead || 1));
  return { r, x, soldiers: x.troops || 0, training, supply, power: (x.troops || 0) * training * supply };
}
export function simulate(aId, dId) {
  const maxHead = Math.max(1, ...pool().map(r => estimate(r).perHead || 0));
  const a = force(byId[aId], maxHead), d = force(byId[dId], maxHead);
  const alliesOf = (id, enemy) => relationsOf(id, curRel).allies.map(x => otherSide(x, id)).filter(o => o !== enemy && byId[o]?.stats?.m != null);
  const aAl = alliesOf(aId, dId), dAl = alliesOf(dId, aId), both = aAl.filter(o => dAl.includes(o));     // allied to both: stays out
  const help = list => list.filter(o => !both.includes(o)).map(o => ({ r: byId[o], power: force(byId[o], maxHead).power * .35 }));
  a.allies = help(aAl); d.allies = help(dAl);
  const land = d.x.land, total = Object.values(land).reduce((s, v) => s + v, 0) || 1;
  const rough = (land.mountain + .8 * land.jungle + .6 * land.forest + .6 * land.hills + .5 * land.desert) / total;
  const adjacent = neighbours(aId).includes(dId) || R.some(t => t.of === aId && neighbours(t.id).includes(dId)) || R.some(t => t.of === dId && neighbours(t.id).includes(aId));
  const factors = [];
  const terrain = Math.min(.35, rough * .6); if (terrain > .01) factors.push(["mountain", `${esc(d.r.name)} fights on rough ground`, `${pct(rough)} of its land is mountain, forest, hills, jungle or desert`, terrain, "d"]);
  const river = adjacent && riverBorder(aId, dId) ? .1 : 0; if (river) factors.push(["drop", "A river guards the border", "The River Marbon has to be crossed under fire", river, "d"]);
  const forts = Math.min(.15, infra(d.r) * .006); if (forts > .005) factors.push(["castle", "Fortified capitals", `Total infrastructure ${infra(d.r)} across its capitals`, forts, "d"]);
  const far = adjacent ? 0 : .2; if (far) factors.push(["compass", `${esc(a.r.name)} has no shared border`, "Its army must march through other lands first", far, "a-"]);
  if (both.length) factors.push(["link", "Allied to both sides", both.map(o => esc(byId[o].name)).join(", ") + " stay out of it", 0, "n"]);
  const sum = s => s.power + s.allies.reduce((t, x) => t + x.power, 0);
  const sa = sum(a) * (1 - far), sd = sum(d) * (1 + terrain + river + forts), k = 1.6;
  const chance = sa || sd ? Math.pow(sa, k) / (Math.pow(sa, k) + Math.pow(sd, k)) : .5;
  return { a, d, sa, sd, chance, factors, adjacent };
}

function render(args, opts) {
  listMode(opts);
  const P = pool();
  if (args[0] && byId[args[0]]?.stats?.m != null) A = args[0];
  if (args[1] && byId[args[1]]?.stats?.m != null) D = args[1];
  if (!A || !byId[A]) A = P[0]?.id;
  if (!D || !byId[D] || D === A) D = (neighbours(A).map(n => byId[n]).find(n => P.includes(n)) || P.find(r => r.id !== A))?.id;
  const head = viewHead({ eyebrow: "War room", ico: "swords", title: "War Simulator", sub: `<span>A what-if. Nothing here changes the world.</span>` });
  if (!A || !D) { mount(head + `<div class="vb"><p class="inline-empty">At least two nations need a Military rating.</p></div>`, opts, { size: "wide", sheetTo: "full" }); return; }
  const s = simulate(A, D), pa = Math.round(s.chance * 100), win = s.chance >= .5 ? s.a : s.d, odds = Math.max(pa, 100 - pa);
  const sel = (id, v) => `<select id="${id}" class="select" aria-label="${id === "wa" ? "Attacker" : "Defender"}">${P.map(r => `<option value="${r.id}"${r.id === v ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select>`;
  const verdict = odds < 56 ? "Too close to call. This war could go either way."
    : `<b>${esc(win.r.name)}</b> ${odds >= 85 ? "would win easily" : odds >= 70 ? "would very likely win" : "has the edge"}${win === s.d ? ", holding off the attack" : ""}.`;
  const side = (f, cls, role) => `<div class="war-side ${cls}"><a class="ws-h" href="${href("nation", f.r.id)}">${emblem(f.r, 44)}<span><small>${role}</small><b>${esc(f.r.name)}</b><em>${esc(GOV[f.r.id]?.leader ? "led by " + GOV[f.r.id].leader : GOV[f.r.id]?.gov || "")}</em></span></a>
      <dl class="ws-f"><div><dt>Soldiers</dt><dd>${short(f.soldiers)}</dd></div><div><dt>Training</dt><dd>×${f.training.toFixed(2)}</dd></div><div><dt>Supply</dt><dd>×${f.supply.toFixed(2)}</dd></div><div><dt>Own strength</dt><dd>${short(f.power)}</dd></div></dl>
      <p class="ws-al">${f.allies.length ? `${icon("link", "i-xs")}Allies send help: ${f.allies.map(x => `${esc(x.r.name)} (+${short(x.power)})`).join(", ")}` : `${icon("link", "i-xs")}No allies join in`}</p></div>`;
  mount(head + `<div class="vb">
    <div class="war-pick"><label><span>Attacker</span>${sel("wa", A)}</label><button type="button" class="icon-btn" data-act="war-swap" aria-label="Swap attacker and defender" data-tip="Swap sides">${icon("swap")}</button><label><span>Defender</span>${sel("wd", D)}</label></div>
    <div class="war card">
      <div class="war-odds" role="img" aria-label="${esc(s.a.r.name)} ${pa} percent, ${esc(s.d.r.name)} ${100 - pa} percent"><b>${pa}%</b><div class="wo-bar"><i style="width:${pa}%"></i></div><b>${100 - pa}%</b></div>
      <div class="cmp-verdict">${icon("scale", "i-sm")}<span>${verdict}</span></div>
      <div class="war-sides">${side(s.a, "a", "Attacker")}${side(s.d, "d", "Defender")}</div>
    </div>
    <section class="sec">${secHead("What decides it")}
      ${s.factors.length ? `<ul class="war-factors">${s.factors.map(([ic, t, sub, v, who]) => `<li><span class="wf-ic">${icon(ic, "i-sm")}</span><span class="wf-t"><b>${t}</b><small>${sub}</small></span>${v ? `<span class="wf-v ${who === "d" ? "d" : "a"}">${who === "d" ? "Defender +" : "Attacker −"}${Math.round(v * 100)}%</span>` : ""}</li>`).join("")}</ul>` : `<p class="inline-empty">Open ground, a shared border and no forts: it comes down to the armies alone.</p>`}
      <p class="foot-note">${icon("info", "i-xs")}Final strength: ${esc(s.a.r.name)} ${short(s.sa)} against ${esc(s.d.r.name)} ${short(s.sd)}. Soldiers come from population and the Military rating, supply from income per person, and allies send 35% of their own strength. Change a rating, an alliance or a border and the odds change too.</p>
    </section>
    <div class="btn-row"><a class="btn btn-sm" href="${href("compare", A, D)}">${icon("scale")}Compare these two</a><a class="btn btn-sm btn-ghost" href="${href("diplomacy")}">${icon("swords")}Wars &amp; alliances</a></div>
  </div>`, opts, { size: "wide", sheetTo: "full" });
  highlight(D, { withHost: false });
}

export const warView = {
  render,
  click(e) {
    if (e.target.closest("[data-act='war-swap']")) { [A, D] = [D, A]; go(`war/${A}/${D}`, { keepFocus: true }); return true; }
  },
  change(e) {
    if (e.target.id !== "wa" && e.target.id !== "wd") return;
    if (e.target.id === "wa") A = e.target.value; else D = e.target.value;
    if (A === D) { const o = pool().find(r => r.id !== A); if (e.target.id === "wa") D = o.id; else A = o.id; }
    go(`war/${A}/${D}`, { keepFocus: true }); return true;
  },
};
