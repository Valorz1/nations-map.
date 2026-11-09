/* Character portraits — an uploaded photo, or a drawn portrait built from a
   few choices. Unchanged from the original so every portrait looks the same. */
import { esc } from "./dom.js";

export const HAIR = [["short", "Short"], ["long", "Long"], ["swept", "Swept back"], ["bun", "Tied up"], ["bald", "Bald"]];
export const HEAD = [["none", "None"], ["crown", "Crown"], ["cap", "Military cap"], ["helmet", "Helmet"], ["hood", "Hood"], ["laurel", "Laurel wreath"], ["circlet", "Circlet"]];
export const FACE = [["none", "Clean-shaven"], ["beard", "Beard"], ["moustache", "Moustache"], ["scar", "Scar"]];
export const PDEF = { skin: "#e2b48f", hair: "#3b2a20", outfit: "#2f3e63", accent: "#d4a73a", bg: "#cfd6e4", hairStyle: "short", head: "none", face: "none" };

let pid = 0;
export function portrait(c, size) {
  const p = Object.assign({}, PDEF, c.look || {}), u = "p" + (++pid);
  if (c.photo && /^data:image\/(jpeg|png|webp);base64,/.test(c.photo)) return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="Portrait of ${esc(c.name || "character")}"><defs><clipPath id="${u}"><circle cx="50" cy="50" r="48"/></clipPath></defs><image href="${c.photo}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#${u})"/><circle cx="50" cy="50" r="48" fill="none" stroke="${p.accent}" stroke-width="3"/></svg>`;
  const dk = h => { try { const n = parseInt(h.slice(1), 16); return "rgb(" + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(v * .72)).join(",") + ")"; } catch (e) { return h; } };
  let back = "", front = "", hat = "", face = "";
  if (p.hairStyle === "long") back = `<path d="M30,40 C28,20 72,20 70,40 L74,78 C64,84 36,84 26,78Z" fill="${p.hair}"/>`;
  if (p.hairStyle === "short") front = `<path d="M32,42 C30,22 70,22 68,42 C66,34 58,30 50,30 C42,30 34,34 32,42Z" fill="${p.hair}"/>`;
  if (p.hairStyle === "long") front = `<path d="M32,44 C30,22 70,22 68,44 C64,33 56,29 50,29 C44,29 36,33 32,44Z" fill="${p.hair}"/>`;
  if (p.hairStyle === "swept") front = `<path d="M31,40 C30,20 72,18 70,38 C64,30 54,27 44,30 C38,32 34,35 31,40Z" fill="${p.hair}"/><path d="M40,28 C50,22 62,24 68,32" stroke="${dk(p.hair)}" stroke-width="1.2" fill="none"/>`;
  if (p.hairStyle === "bun") front = `<circle cx="50" cy="19" r="7" fill="${p.hair}"/><path d="M32,42 C30,23 70,23 68,42 C65,33 57,29 50,29 C43,29 35,33 32,42Z" fill="${p.hair}"/>`;
  if (p.face === "beard") face = `<path d="M34,48 C35,64 44,70 50,70 C56,70 65,64 66,48 C62,58 56,60 50,60 C44,60 38,58 34,48Z" fill="${p.hair}"/>`;
  if (p.face === "moustache") face = `<path d="M42,55 C46,52 49,53 50,55 C51,53 54,52 58,55 C54,57 52,56 50,56 C48,56 46,57 42,55Z" fill="${p.hair}"/>`;
  if (p.face === "scar") face = `<path d="M58,36 L63,50" stroke="#8a3b3b" stroke-width="1.6" stroke-linecap="round"/><path d="M59,40l3,-1M60,44l3,-1" stroke="#8a3b3b" stroke-width="1"/>`;
  if (p.head === "crown") hat = `<path d="M33,30 L35,15 L42,23 L50,11 L58,23 L65,15 L67,30Z" fill="${p.accent}" stroke="${dk(p.accent)}" stroke-width="1.2"/><circle cx="50" cy="24" r="2.2" fill="#b3263b"/><rect x="33" y="27" width="34" height="4" fill="${dk(p.accent)}"/>`;
  if (p.head === "cap") hat = `<path d="M30,31 C30,17 70,17 70,31Z" fill="${p.outfit}"/><rect x="29" y="29" width="42" height="5" rx="2" fill="${dk(p.outfit)}"/><path d="M33,34 L67,34 L60,38 L40,38Z" fill="#1e1e22"/><circle cx="50" cy="25" r="3" fill="${p.accent}"/>`;
  if (p.head === "helmet") hat = `<path d="M29,40 C28,16 72,16 71,40 L66,40 C64,28 36,28 34,40Z" fill="${p.accent}" stroke="${dk(p.accent)}" stroke-width="1.2"/><rect x="48" y="30" width="4" height="22" rx="1.5" fill="${dk(p.accent)}"/><path d="M50,14 C56,8 62,10 64,16" stroke="#9b2d2d" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  if (p.head === "hood") hat = `<path d="M25,62 C22,24 78,24 75,62 L68,62 C70,36 30,36 32,62Z" fill="${p.outfit}" stroke="${dk(p.outfit)}" stroke-width="1"/>`;
  if (p.head === "laurel") hat = [0, 1, 2, 3, 4].map(i => `<ellipse cx="${34 + i * 2.2}" cy="${36 - i * 3.6}" rx="2.4" ry="4.6" transform="rotate(${-40 + i * 8} ${34 + i * 2.2} ${36 - i * 3.6})" fill="#5a8f3e"/><ellipse cx="${66 - i * 2.2}" cy="${36 - i * 3.6}" rx="2.4" ry="4.6" transform="rotate(${40 - i * 8} ${66 - i * 2.2} ${36 - i * 3.6})" fill="#5a8f3e"/>`).join("");
  if (p.head === "circlet") hat = `<path d="M32,33 C40,29 60,29 68,33" stroke="${p.accent}" stroke-width="2.6" fill="none"/><path d="M50,27 l3,4 l-3,4 l-3,-4Z" fill="${p.accent}" stroke="${dk(p.accent)}" stroke-width=".8"/>`;
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="Portrait of ${esc(c.name || "character")}"><defs><clipPath id="${u}"><circle cx="50" cy="50" r="48"/></clipPath></defs>
  <g clip-path="url(#${u})"><rect width="100" height="100" fill="${p.bg}"/><circle cx="50" cy="50" r="40" fill="#fff" opacity=".18"/>${back}
  <path d="M8,104 C8,78 28,70 50,70 C72,70 92,78 92,104Z" fill="${p.outfit}"/>
  <path d="M40,70 L50,86 L60,70" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="68" cy="84" r="3.4" fill="${p.accent}" stroke="${dk(p.accent)}" stroke-width=".8"/>
  <rect x="44" y="58" width="12" height="14" fill="${dk(p.skin)}"/>
  <ellipse cx="50" cy="45" rx="17" ry="20" fill="${p.skin}"/>
  <ellipse cx="33" cy="47" rx="3" ry="4.5" fill="${p.skin}"/><ellipse cx="67" cy="47" rx="3" ry="4.5" fill="${p.skin}"/>
  ${face}
  <path d="M40,40 L46,39 M54,39 L60,40" stroke="${p.hair}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="43.5" cy="45" rx="1.9" ry="2.3" fill="#23202a"/><ellipse cx="56.5" cy="45" rx="1.9" ry="2.3" fill="#23202a"/>
  <path d="M50,47 L48.5,53 L51,53" stroke="${dk(p.skin)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  ${p.face === "beard" ? "" : `<path d="M45.5,58 C48,59.5 52,59.5 54.5,58" stroke="#8a4f45" stroke-width="1.5" fill="none" stroke-linecap="round"/>`}
  ${front}${hat}</g><circle cx="50" cy="50" r="48" fill="none" stroke="${dk(p.bg)}" stroke-width="2"/></svg>`;
}
