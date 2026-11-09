/* Hash router: #/section/arg… — gives every view a link and back/forward support. */
const views = {};
let pending = null;
export const route = { name: "", args: [], path: "" };
const listeners = new Set();
export const onRoute = fn => listeners.add(fn);

export const register = (name, fn) => { views[name] = fn; };
const clean = p => String(p).replace(/^#?\/?/, "");
export const href = (...parts) => "#/" + parts.filter(x => x != null && x !== "").map(encodeURIComponent).join("/");

/* go("nation/elarion", {fly:false}) */
export function go(path, opts = {}) {
  path = clean(path);
  if (clean(location.hash) !== path) { pending = opts; location.hash = "/" + path; }
  else render(path, opts);
}
/* re-render the current view in place (after a save, timeline change…) */
export const refresh = () => render(route.path, { refresh: true });

function render(path, opts) {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  let [name, ...args] = parts;
  if (!views[name]) { name = "overview"; args = []; }
  const prev = route.name, prevPath = route.path;
  Object.assign(route, { name, args, path });
  const same = opts.refresh || prevPath === path;
  views[name](args, { ...opts, same, prev });
  listeners.forEach(fn => fn(route, prev));
}

export function initRouter() {
  addEventListener("hashchange", () => {
    const o = pending || { fly: true, fromList: true };
    pending = null;
    render(clean(location.hash), o);
  });
  render(clean(location.hash), { fly: true, initial: true });
}
