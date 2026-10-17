"use client";
import { Moon, Sun } from "lucide-react";

export const themeStorageKey = "commons-theme";

// Runs in <head> before paint: applies a saved choice, otherwise the system
// preference applies through CSS.
export const themeScript = `(function(){try{var t=localStorage.getItem("${themeStorageKey}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.getAttribute("data-theme") ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {}
  }
  // Both icons render; CSS shows the one for the active theme, so the server
  // markup never mismatches the client.
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Switch light or dark theme"
      title="Switch theme"
    >
      <Moon size={16} className="theme-icon-dark" aria-hidden />
      <Sun size={16} className="theme-icon-light" aria-hidden />
    </button>
  );
}
