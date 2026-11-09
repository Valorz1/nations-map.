/* The map key — drawn with the same symbols the map uses. */
const sym = {
  rate: `<svg viewBox="0 0 44 26" width="44" height="26"><rect x="1" y="1" width="42" height="24" rx="1.5" fill="#fffdf7" stroke="#2c3240"/><path d="M1 13h42M20 1v12" stroke="#2c3240" stroke-width=".7"/><text x="5" y="10" font-size="5.5" font-weight="600" fill="#555c6b" font-family="IBM Plex Sans Condensed">RATE</text><text x="39" y="10.5" font-size="8" text-anchor="end" font-weight="600" fill="#1c212c" font-family="IBM Plex Mono">160</text><text x="22" y="21.5" font-size="5.5" text-anchor="middle" fill="#2c3240" font-family="IBM Plex Mono">M 98 · E 80</text></svg>`,
  cap: `<svg viewBox="0 0 26 26" width="26" height="26"><circle cx="13" cy="13" r="11" fill="#fff" stroke="#2c3240" stroke-width="1.4"/><text x="13" y="13.5" font-size="11" text-anchor="middle" dominant-baseline="central" font-weight="600" fill="#1f2430" font-family="IBM Plex Mono">8</text></svg>`,
  capSm: `<svg viewBox="0 0 26 26" width="26" height="26"><circle cx="13" cy="13" r="7.5" fill="#fff" stroke="#2c3240" stroke-width="1.3"/><text x="13" y="13.5" font-size="8" text-anchor="middle" dominant-baseline="central" font-weight="600" fill="#1f2430" font-family="IBM Plex Mono">4</text></svg>`,
  slash: `<svg viewBox="0 0 26 26" width="26" height="26"><circle cx="13" cy="13" r="11" fill="#fff" stroke="#2c3240" stroke-width="1.4"/><path d="M5.3 20.7 20.7 5.3" stroke="#2c3240" stroke-width="1.3"/></svg>`,
  dis: `<svg viewBox="0 0 26 26" width="26" height="26"><defs><pattern id="lgh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f1efe8"/><path d="M0 0v5" stroke="#3b4252" stroke-width="1.2"/></pattern></defs><path d="M3 18 9 5l14 3-3 13Z" fill="url(#lgh)" stroke="#3b4252"/></svg>`,
  res: `<svg viewBox="0 0 26 26" width="26" height="26"><defs><pattern id="lgr" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#f3e1e7"/><circle cx="2.5" cy="2.5" r=".9" fill="#8a4058"/></pattern></defs><path d="M4 12c0-5 5-8 10-7s8 5 7 9-6 8-11 7-6-4-6-9Z" fill="url(#lgr)" stroke="#3b4252" stroke-dasharray="3 2"/></svg>`,
  terr: `<svg viewBox="0 0 26 26" width="26" height="26"><rect x="2" y="5" width="10" height="16" rx="2" fill="#f0bfca" stroke="#3b4252"/><rect x="15" y="9" width="9" height="9" rx="2" fill="#f0bfca" stroke="#3b4252"/></svg>`,
  blight: `<svg viewBox="0 0 26 26" width="26" height="26"><rect x="2" y="3" width="22" height="20" rx="2" fill="#b3bc8f" stroke="#3b4252"/><circle cx="7" cy="8" r="1.4" fill="#4b5a2c"/><circle cx="17" cy="15" r="1.2" fill="#4b5a2c"/><circle cx="19" cy="7" r=".9" fill="#6d1f1f"/><circle cx="9" cy="18" r="2" fill="#5c6b36" opacity=".6"/></svg>`,
  war: `<svg viewBox="0 0 44 26" width="44" height="26"><path d="M3 18Q22 2 41 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/><path d="M3 18Q22 2 41 18" fill="none" stroke="#c0392b" stroke-width="2.6" stroke-dasharray="6 4" stroke-linecap="round"/><circle cx="22" cy="10" r="5" fill="#c0392b" stroke="#fff" stroke-width="1.4"/><path d="M20 8l4 4M24 8l-4 4" stroke="#fff" stroke-width="1.4"/></svg>`,
  ally: `<svg viewBox="0 0 44 26" width="44" height="26"><path d="M3 18Q22 2 41 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/><path d="M3 18Q22 2 41 18" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="10" r="5" fill="#2563eb" stroke="#fff" stroke-width="1.4"/><path d="M19.6 10h4.8M22 7.6v4.8" stroke="#fff" stroke-width="1.4"/></svg>`,
  dotj: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M2 20 13 13 24 6" stroke="#3b4252" stroke-width="1.4"/><circle cx="13" cy="13" r="3" fill="#2c3240"/></svg>`,
};

const ITEMS = [
  ["rate", "Ratings", "<b>Rate</b>, <b>M</b> (military power) and <b>E</b> (economic power), from the sketch."],
  ["cap", "Capital city", "The number is the infrastructure level. A nation can have several capitals."],
  ["capSm", "Smaller capital", "A smaller circle means a smaller population."],
  ["slash", "Destroyed city", "A slashed circle is a destroyed or disputed city."],
  ["dis", "Disputed area", "Hatched areas, marked DIS on the map."],
  ["res", "Resistance movement", "Dotted shapes: the Teddy and Lego Resistances."],
  ["terr", "Territory", "A shared colour means a territory belongs to that nation."],
  ["blight", "The Blight", "The green speckled zone, overrun by zombies."],
  ["war", "War", "Red dashed lines join nations at war."],
  ["ally", "Alliance", "Solid blue lines join allies."],
  ["dotj", "Junction dot", "Drawn on the sketch. Crossed-out notes were left off."],
];

export function legendHTML() {
  return `<ul class="legend">${ITEMS.map(([k, t, d]) => `<li><span class="lg-sym">${sym[k]}</span><span><b>${t}</b><small>${d}</small></span></li>`).join("")}</ul>`;
}
