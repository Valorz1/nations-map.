/* Small rendering helpers shared by every view. */
import { icon } from "./icons.js";
import { GOV } from "../store.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const okColour = c => { try { return CSS.supports("color", c); } catch (e) { return true; } };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function shade(hex, f) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return hex;
  return "rgb(" + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f)))).join(",") + ")";
}

export const dot = (r, dashed) => `<span class="dot${dashed ? " dashed" : ""}" style="background:${esc(r.fill)}"></span>`;

export function flagHTML(cols, big) {
  return cols && cols.length ? `<span class="flag${big ? " big" : ""}">${cols.map(c => `<i style="background:${esc(c)}"></i>`).join("")}</span>` : "";
}

/* ---- national emblem ----
   A heraldic shield. If the nation has flag colours recorded they are used as
   the field; otherwise the shield takes the nation's map colour and initials. */
let eid = 0;
export function monogram(name) {
  const clean = String(name).replace(/\(.*?\)/g, " ").trim();
  if (/^[?]+$/.test(clean)) return "?";
  const caps = clean.replace(/[.\s]/g, "");
  if (/^[A-Z]{2,4}$/.test(caps)) return caps.slice(0, 3);
  const words = clean.replace(/[.]/g, " ").split(/\s+/).filter(w => w && !/^(of|the|and)$/i.test(w));
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}
export function emblem(r, size = 40) {
  const g = GOV[r.id] || {}, flag = g.flag && g.flag.length ? g.flag : null, u = "em" + (++eid);
  const w = size, h = Math.round(size * 1.15), mono = monogram(r.name);
  const shield = "M4 3.5h32v18.5c0 11.2-8.2 18.3-16 21.3C12.2 40.3 4 33.2 4 22Z";
  const field = flag
    ? flag.map((c, i) => `<rect x="0" y="${(46 / flag.length) * i}" width="40" height="${46 / flag.length + .5}" fill="${esc(c)}"/>`).join("")
    : `<rect width="40" height="46" fill="url(#${u}g)"/><path d="M4 3.5h32v8H4z" fill="#fff" opacity=".18"/>`;
  const fs = mono.length > 2 ? 10.5 : 14.5;
  return `<svg class="emblem" width="${w}" height="${h}" viewBox="0 0 40 46" aria-hidden="true">
    <defs><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${esc(r.fill)}"/><stop offset="1" stop-color="${shade(r.fill, .78)}"/></linearGradient>
    <clipPath id="${u}c"><path d="${shield}"/></clipPath></defs>
    <g clip-path="url(#${u}c)">${field}<path d="M20 3.5V46" stroke="#fff" stroke-opacity=".12"/></g>
    ${flag ? "" : `<text x="20" y="24.5" text-anchor="middle" dominant-baseline="central" font-family="Spectral SC, Georgia, serif" font-weight="700" font-size="${fs}" fill="#1b2130" fill-opacity=".86" letter-spacing=".5">${esc(mono)}</text>`}
    <path d="${shield}" fill="none" stroke="#d6a644" stroke-width="1.8" ${r.kind ? 'stroke-dasharray="3 2.2"' : ""}/>
    <path d="M6.6 6h26.8v16c0 9.6-7 15.8-13.4 18.4C13.6 37.8 6.6 31.6 6.6 22Z" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>
  </svg>`;
}

/* ---- view scaffolding ---- */
export function viewHead({ eyebrow, ico, title, sub = "", acts = "", tools = "", tabs = "", close }) {
  return `<header class="vh${tabs ? "" : " notabs"}">
    <div class="vh-top"><span class="eyebrow">${ico ? icon(ico) : ""}${esc(eyebrow)}</span><div class="vh-acts">${acts}${close ? `<a class="icon-btn icon-btn-sm" href="${close}" aria-label="Close" data-tip="Close">${icon("x")}</a>` : ""}</div></div>
    <h2 tabindex="-1" class="vh-title">${title}</h2>
    ${sub ? `<div class="vh-sub">${sub}</div>` : ""}
    ${tools ? `<div class="vh-tools">${tools}</div>` : ""}
    ${tabs}
  </header>`;
}
export const secHead = (title, extra = "", act = "") =>
  `<div class="sh"><h3>${title}${extra ? ` <span class="count">${extra}</span>` : ""}</h3>${act ? `<span class="sh-act">${act}</span>` : ""}</div>`;

export const emptyState = (text, { title = "", ico = "", action = "", center = false } = {}) =>
  `<div class="empty${center ? " center" : ""}">${ico ? `<span class="e-ic">${icon(ico)}</span>` : ""}${title ? `<b>${esc(title)}</b>` : ""}<p>${text}</p>${action}</div>`;

export function tabsHTML(list, active, name) {
  return `<div class="tabs" role="tablist" aria-label="${esc(name)}">${list.map(([k, label, ico, count]) =>
    `<button class="tab" role="tab" type="button" id="tab-${k}" data-tab="${k}" aria-selected="${k === active}" aria-controls="tp-${k}" tabindex="${k === active ? 0 : -1}">${ico ? icon(ico) : ""}${esc(label)}${count != null ? `<span class="count">${count}</span>` : ""}</button>`).join("")}</div>`;
}
/* arrow-key movement between tabs (roving tabindex) */
export function tabKeys(e) {
  const t = e.target.closest('[role="tab"]'); if (!t) return false;
  const all = [...t.parentElement.querySelectorAll('[role="tab"]')], i = all.indexOf(t);
  let j = null;
  if (e.key === "ArrowRight") j = (i + 1) % all.length;
  else if (e.key === "ArrowLeft") j = (i - 1 + all.length) % all.length;
  else if (e.key === "Home") j = 0; else if (e.key === "End") j = all.length - 1;
  if (j == null) return false;
  e.preventDefault(); all[j].focus(); all[j].click(); return true;
}

export function when(ts) {
  if (!ts) return "";
  const d = new Date(ts), s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const signed = n => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "±0");
