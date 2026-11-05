"use client";

import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export const THEME_KEY = "cari-theme";
const EVENT = "cari-theme-change";

/** Script inline do <head>: aplica .dark/.light antes da primeira pintura. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d)}catch(e){}})()`;

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // sem storage: vale só nesta sessão
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (read() === "system") applyTheme("system");
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", onSystem);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, read, () => "system");
}

function subscribeSystem(cb: () => void) {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Tema efetivo ("light" | "dark"), para componentes de terceiros como o Toaster. */
export function useResolvedTheme(): "light" | "dark" {
  const pref = useThemePreference();
  return useSyncExternalStore(
    subscribeSystem,
    () => (pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"),
    () => "light",
  );
}
