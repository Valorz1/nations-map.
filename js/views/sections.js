/* The top-level sections of the atlas, in navigation order. */
export const SECTIONS = [
  { k: "overview", label: "Overview", ico: "globe", desc: "The world at a glance", key: "1" },
  { k: "nations", label: "Nations", ico: "flag", desc: "Every nation, territory and movement", key: "2" },
  { k: "rankings", label: "Rankings", ico: "trophy", desc: "Power rankings and head-to-head comparisons", key: "3" },
  { k: "characters", label: "Characters", ico: "users", desc: "Rulers, generals and heroes", key: "4" },
  { k: "diplomacy", label: "Diplomacy", ico: "swords", desc: "Wars, alliances and relations", key: "5" },
  { k: "history", label: "History", ico: "history", desc: "The archive of saved moments", key: "6" },
  { k: "encyclopedia", label: "Encyclopedia", ico: "book", desc: "Browse everything in one place", key: "7" },
];
/* which section a route belongs to (for highlighting the nav) */
export const sectionOf = name => ({ nation: "nations", character: "characters", compare: "rankings" }[name] || name);
