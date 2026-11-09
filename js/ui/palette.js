/* Global search (press / or Ctrl+K): every nation, person, war, government,
   capital and moment, plus sections and map actions. */
import { buildIndex, search } from "../search.js";
import { SECTIONS } from "../views/sections.js";
import { openEntry } from "../views/encyclopedia.js";
import { esc } from "./dom.js";
import { icon } from "./icons.js";

let box, input, list, items = [], sel = 0, actions = [], lastFocus = null;
export const setActions = a => { actions = a; };

const GROUPS = [["sections", "Go to"], ["nations", "Nations"], ["territories", "Territories"], ["movements", "Movements & zones"], ["characters", "Characters"], ["governments", "Governments"], ["wars", "Wars"], ["alliances", "Alliances"], ["capitals", "Capitals"], ["events", "History"], ["actions", "Actions"]];

function results(q) {
  const secs = SECTIONS.map(s => ({ cat: "sections", type: "Section", title: s.label, sub: s.desc, href: "#/" + s.k, art: icon(s.ico) }));
  const acts = actions.map(a => ({ cat: "actions", type: "Action", title: a.title, sub: a.sub, art: icon(a.ico), run: a.run }));
  const idx = [...secs, ...buildIndex(), ...acts];
  if (!q) return [...secs, ...idx.filter(e => e.cat === "nations").slice(0, 5), ...acts];
  return search(q, idx).slice(0, 40);
}

function draw() {
  const q = input.value.trim();
  items = results(q);
  sel = Math.min(sel, Math.max(0, items.length - 1));
  if (!items.length) { list.innerHTML = `<li class="pl-empty">Nothing found for “${esc(q)}”. Try a nation, ruler, government or war.</li>`; input.removeAttribute("aria-activedescendant"); return; }
  let html = "", n = 0;
  for (const [k, label] of GROUPS) {
    const g = items.filter(e => e.cat === k); if (!g.length) continue;
    html += `<li class="pl-group" role="presentation">${label}</li>`;
    for (const e of g) {
      const i = items.indexOf(e);
      html += `<li class="pl-item" role="option" id="pl-${i}" data-i="${i}" aria-selected="${i === sel}"><span class="pl-ic">${e.art}</span><span class="pl-t"><b>${esc(e.title)}</b><small>${esc(e.sub || "")}</small></span><span class="pl-k">${esc(e.type)}</span></li>`;
      n++;
    }
  }
  list.innerHTML = html;
  input.setAttribute("aria-activedescendant", "pl-" + sel);
}
function move(d) {
  if (!items.length) return;
  sel = (sel + d + items.length) % items.length;
  list.querySelectorAll(".pl-item").forEach(el => el.setAttribute("aria-selected", +el.dataset.i === sel));
  const el = document.getElementById("pl-" + sel); el?.scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", "pl-" + sel);
}
function choose(i) {
  const e = items[i]; if (!e) return;
  closePalette(false);
  if (e.run) { e.run(); return; }
  if (e.cap) { openEntry({ preventDefault() {} }, { dataset: { capfly: `${e.r.id},${e.cap[0]},${e.cap[1]}` } }); return; }
  location.hash = e.href.replace(/^#/, "");
}

export function openPalette(q = "") {
  lastFocus = document.activeElement;
  box.hidden = false; input.value = q; sel = 0; draw();
  requestAnimationFrame(() => input.focus());
}
export function closePalette(restore = true) {
  if (box.hidden) return; box.hidden = true;
  if (restore && lastFocus && lastFocus.focus) lastFocus.focus();
}
export const paletteOpen = () => !box.hidden;

export function initPalette() {
  box = document.getElementById("palette"); input = document.getElementById("palQ"); list = document.getElementById("palList");
  input.addEventListener("input", () => { sel = 0; draw(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    else if (e.key === "Tab") { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
  });
  list.addEventListener("pointermove", e => { const it = e.target.closest(".pl-item"); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; list.querySelectorAll(".pl-item").forEach(el => el.setAttribute("aria-selected", +el.dataset.i === sel)); } });
  list.addEventListener("click", e => { const it = e.target.closest(".pl-item"); if (it) choose(+it.dataset.i); });
  box.addEventListener("click", e => { if (e.target.closest("[data-close-palette]")) closePalette(); });
}
