/* Toasts, confirmation dialogs and icon-button tooltips. */
import { icon } from "./icons.js";
import { esc } from "./dom.js";

/* ---- toasts ---- */
export function toast(title, { sub = "", kind = "ok", ms = 3200 } = {}) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.setAttribute("role", kind === "err" ? "alert" : "status");
  t.innerHTML = `<span class="t-ic">${icon(kind === "err" ? "alert" : kind === "info" ? "info" : "check")}</span>
    <div class="t-b"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>
    <button type="button" class="icon-btn icon-btn-sm t-x" aria-label="Dismiss">${icon("x")}</button>`;
  const close = () => { if (t.classList.contains("out")) return; t.classList.add("out"); setTimeout(() => t.remove(), 230); };
  t.querySelector(".t-x").onclick = close;
  host.appendChild(t);
  while (host.children.length > 2) host.firstElementChild.remove();
  setTimeout(close, ms);
}

/* ---- dialogs ---- */
function openDialog(html, cls = "") {
  const d = document.getElementById("dlg");
  d.className = "dlg " + cls;
  d.innerHTML = html;
  d.showModal();
  return d;
}

export function confirmDialog({ title, body = "", ok = "Confirm", cancel = "Cancel", danger = false, ico }) {
  return new Promise(resolve => {
    const d = openDialog(`<form method="dialog">
      <div class="dlg-body"><span class="dlg-ic">${icon(ico || (danger ? "alert" : "info"))}</span>
        <div><h2>${esc(title)}</h2><p>${esc(body)}</p></div></div>
      <div class="dlg-acts"><button class="btn" value="cancel" type="submit">${esc(cancel)}</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" value="ok" type="submit">${esc(ok)}</button></div></form>`, danger ? "danger" : "");
    d.querySelector('[value="cancel"]').focus();
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
  });
}

export function infoDialog(title, innerHTML, ico = "info") {
  const d = openDialog(`<form method="dialog"><div class="dlg-body"><span class="dlg-ic">${icon(ico)}</span><div style="flex:1;min-width:0"><h2>${esc(title)}</h2>${innerHTML}</div></div>
    <div class="dlg-acts"><button class="btn btn-primary" value="ok" type="submit">Done</button></div></form>`);
  d.querySelector("button").focus();
}

/* ---- tooltips for [data-tip] (icon buttons) ---- */
export function initTooltips() {
  const box = document.createElement("div");
  box.className = "tipbox"; box.setAttribute("aria-hidden", "true");
  document.body.appendChild(box);
  let cur = null, timer = 0;
  const show = el => {
    if (matchMedia("(hover:none)").matches && !el.matches(":focus-visible")) return;
    cur = el; box.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect(), inRail = !!el.closest(".rail");
    box.classList.add("on");
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let x, y;
    if (inRail) { x = r.left - bw - 10; y = r.top + r.height / 2 - bh / 2; }
    else { x = r.left + r.width / 2 - bw / 2; y = r.bottom + 8; }
    x = Math.max(6, Math.min(innerWidth - bw - 6, x)); y = Math.max(6, Math.min(innerHeight - bh - 6, y));
    box.style.left = x + "px"; box.style.top = y + "px";
  };
  const hide = () => { cur = null; clearTimeout(timer); box.classList.remove("on"); };
  document.addEventListener("pointerover", e => {
    const el = e.target.closest("[data-tip]");
    if (el === cur) return; hide();
    if (el && e.pointerType === "mouse") timer = setTimeout(() => show(el), 280);
  });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-tip]"); hide(); if (el && el.matches(":focus-visible")) show(el); });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  addEventListener("scroll", hide, true);
}
