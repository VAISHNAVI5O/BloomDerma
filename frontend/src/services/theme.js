// Light / dark mode. The choice is stored in the browser and applied as <html data-theme="dark">.
const KEY = "bloomderma-theme";

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  try { localStorage.setItem(KEY, theme === "dark" ? "dark" : "light"); } catch { /* private mode */ }
}

/** Call once before the first render so there is no flash of the wrong theme. */
export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
}

export function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}
