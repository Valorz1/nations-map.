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

const tsym = {
  mt: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M3 20 11 6l8 14Z" fill="#f4eeda"/><path d="M11 6l8 14h-6.4l-.2-7Z" fill="#a39474"/><path d="M3 20 11 6l8 14" fill="none" stroke="#5b5140" stroke-width="1.3" stroke-linejoin="round"/><path d="M14 20l5-8 4 8" fill="#f4eeda" stroke="#5b5140" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
  hill: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M3 16Q9 7 15 16M12 20q5-8 11 0" fill="none" stroke="#7d7355" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  wood: `<svg viewBox="0 0 26 26" width="26" height="26"><g fill="#7fa868" stroke="#4c7340" stroke-width=".9"><circle cx="8" cy="10" r="4.2"/><circle cx="17" cy="9" r="4.6"/><circle cx="12" cy="17" r="4.4"/><circle cx="20" cy="17" r="3.6"/></g></svg>`,
  dune: `<svg viewBox="0 0 26 26" width="26" height="26"><rect x="2" y="3" width="22" height="20" rx="2" fill="#ecd9a6"/><path d="M5 11q3-4 6 0t6 0M9 18q3-4 6 0t6 0" fill="none" stroke="#b08f4e" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  road: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M2 20Q12 16 24 6" fill="none" stroke="#8a6a44" stroke-width="1.6" stroke-dasharray="4 3" stroke-linecap="round"/><path d="M4 5l9-2 1 6-9 2Z" fill="#e2d68a" stroke="#a8985a" stroke-width=".9"/><path d="M4.6 8.5l9-2" stroke="#b3a25c" stroke-width=".7"/><path d="M15 16l8 1-1 6-8-1Z" fill="#e2d68a" stroke="#a8985a" stroke-width=".9"/></svg>`,
  village: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 20v-7h8v7Z" fill="#f6efdc" stroke="#5b4a2e"/><path d="M2.5 13 8 7l5.5 6Z" fill="#b0563c" stroke="#5b4a2e" stroke-linejoin="round"/><path d="M15 21h9M17 21v-8M20 21v-5M23 21v-10M21.5 11h3" fill="none" stroke="#4a4a3a" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  marsh: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M3 12h9M5 12V8M7.5 12V6M10 12V8M13 21h9M15 21v-4M17.5 21v-6M20 21v-4" fill="none" stroke="#5f8a6a" stroke-width="1.3" stroke-linecap="round"/><path d="M19 11q1-4 0-7M19 4q-4-2-6 1M19 4q4-2 6 1M19 4q-2-3-5-3M19 4q2-3 5-3" fill="none" stroke="#3d6a35" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  mark: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M3 22v-9h5v9ZM1.5 13h8v-3h-2v1.2H6.2V10H4.8v1.2H3.5V10h-2Z" fill="#e9e2cf" stroke="#3d3a30" stroke-width=".9"/><path d="M12 22 17 12h3l5 10Z" fill="#6e6558" stroke="#3a342c" stroke-width=".9"/><path d="M17.5 12l1 5 1-3 .5-2Z" fill="#c8452c"/><circle cx="19" cy="7" r="2.6" fill="#8d8a84" opacity=".75"/></svg>`,
  water: `<svg viewBox="0 0 26 26" width="26" height="26"><path d="M2 8c6-4 8 6 13 3s5-4 9-2" fill="none" stroke="#3f7ca6" stroke-width="4" stroke-linecap="round"/><path d="M2 8c6-4 8 6 13 3s5-4 9-2" fill="none" stroke="#9ccbe8" stroke-width="2" stroke-linecap="round"/><ellipse cx="14" cy="19" rx="8" ry="3.6" fill="#9ccbe8" stroke="#3f7ca6" stroke-width="1.2"/></svg>`,
};
const TERRAIN_ITEMS = [
  ["mt", "Mountains", "High ranges, the tallest capped with snow. The five rivers rise in the far-eastern one."],
  ["hill", "Hills", "Rolling high ground around the ranges."],
  ["wood", "Forest & jungle", "Round crowns are leafy woods, pointed ones are pine. Darker, denser crowns are jungle."],
  ["road", "Roads & farmland", "Dashed roads join every capital. Little ploughed fields lie around each one."],
  ["village", "Villages & ruins", "A small house marks a village on the road. Broken columns are ruins in the Blight, beside its green toxic pools."],
  ["mark", "Landmarks", "Bridges where a road crosses a river, watchtowers along the edge of the Blight, mine entrances in the mountains, and the volcano Mount Cinder."],
  ["marsh", "Marsh & oasis", "Reeds grow around the lakes. The desert has cacti and one oasis with palm trees."],
  ["dune", "Desert", "Sand dunes of the Promised Land of the Desert."],
  ["water", "Rivers & lakes", "The five rivers join and flow west all the way to Baloonia. Another great river follows the Marbonese–Elarion border."],
];
/* key for the optional Terrain view (the landscape is invented to suit the nations' names) */
export function terrainLegendHTML() {
  return `<ul class="legend">${TERRAIN_ITEMS.map(([k, t, d]) => `<li><span class="lg-sym">${tsym[k]}</span><span><b>${t}</b><small>${d}</small></span></li>`).join("")}</ul>`;
}

export function legendHTML() {
  return `<ul class="legend">${ITEMS.map(([k, t, d]) => `<li><span class="lg-sym">${sym[k]}</span><span><b>${t}</b><small>${d}</small></span></li>`).join("")}</ul>`;
}
