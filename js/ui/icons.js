/* A small, consistent stroke-icon set (24×24, 1.8px stroke). */
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  maximize: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  legend: '<circle cx="5" cy="6.5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="17.5" r="1.6"/><path d="M10 6.5h10M10 12h10M10 17.5h10"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  "chev-right": '<path d="m9 6 6 6-6 6"/>',
  "chev-left": '<path d="m15 6-6 6 6 6"/>',
  "chev-down": '<path d="m6 9 6 6 6-6"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5A2.5 2.5 0 0 0 8 10.5M16 6h2.5A2.5 2.5 0 0 1 16 10.5M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14a5.5 5.5 0 0 1 4 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 13 3h3v3l-3.5 3.5"/><path d="m5 14 4 4M7 17l-3 3M3 19l2 2"/>',
  link: '<circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18v-1H13v1a2.5 2.5 0 0 0 3 2.4"/><path d="M7 4a2.5 2.5 0 0 0-2.5 2.5V17M9 10h4M9 13.5h4"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13"/><path d="M8.5 7.5h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z"/>',
  landmark: '<path d="M3 21h18M5 21v-9M9.5 21v-9M14.5 21v-9M19 21v-9M2.5 9.5 12 4l9.5 5.5h-19Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.6 3.2 7.8 7.5 9 4.3-1.2 7.5-4.4 7.5-9V6L12 3Z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  castle: '<path d="M4 21V9h3V6h2v3h2V6h2v3h2V6h2v3h3v12"/><path d="M10 21v-4a2 2 0 0 1 4 0v4M3 21h18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  scale: '<path d="M12 4v17M7 21h10M5 7h14M12 4l-1.5 3M12 4l1.5 3"/><path d="m5 7-3 7a3 3 0 0 0 6 0L5 7ZM19 7l-3 7a3 3 0 0 0 6 0l-3-7Z"/>',
  edit: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  play: '<path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.3v.1"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
  biohazard: '<circle cx="12" cy="12" r="2"/><path d="M12 3a5 5 0 0 0-2.5 9.3M12 3a5 5 0 0 1 2.5 9.3M4.2 16.5a5 5 0 0 0 7.8 1.2M4.2 16.5A5 5 0 0 1 9.5 12M19.8 16.5a5 5 0 0 1-7.8 1.2M19.8 16.5a5 5 0 0 0-5.3-4.2"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.4C5 10 9 8.4 9 3.5c3 1.8 4.2 4.4 4.2 6.6 1.1-.6 1.9-2 2-3.4 2.4 2 3.8 4.9 3.8 7.9 0 3.7-3.1 6.4-7 6.4Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  quill: '<path d="M20 4C11 4 6.5 9.5 5 20"/><path d="M20 4c0 8.5-6 12.5-12.5 12.5M9.5 12.5h5"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  sparkle: '<path d="M12 3c.8 4.4 2.6 6.2 7 7-4.4.8-6.2 2.6-7 7-.8-4.4-2.6-6.2-7-7 4.4-.8 6.2-2.6 7-7Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  medal: '<path d="M8 3h8l-2.5 6h-3L8 3Z"/><circle cx="12" cy="15" r="5.5"/><path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3.9-1.8Z"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  filter: '<path d="M3.5 5h17l-6.5 8v6l-4-2v-4L3.5 5Z"/>',
  sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
};

export function icon(name, cls = "") {
  const p = P[name] || P.dot;
  return `<svg class="i${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
}

/* Fill every element marked data-icon="name" (used by the static HTML shell). */
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => {
    if (el.dataset.iconDone) return;
    el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
    el.dataset.iconDone = "1";
  });
}
