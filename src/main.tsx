import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";

// Daily maintenance: clear SW, Cache API, and IndexedDB once per day
(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const lastClear = localStorage.getItem("fvl-last-cache-clear");
  if (lastClear === today) return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    // Clear IndexedDB
    try {
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        for (const db of dbs) { if (db.name) indexedDB.deleteDatabase(db.name); }
      } else {
        indexedDB.deleteDatabase("fvl-offline");
      }
    } catch {
      indexedDB.deleteDatabase("fvl-offline");
    }

    localStorage.setItem("fvl-last-cache-clear", today);
    console.log("[cache] Daily auto-clear completed:", today);

    if (lastClear) {
      window.location.reload();
      return;
    }
  } catch (e) {
    console.error("[cache] Auto-clear failed:", e);
  }
})();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <App />
  </ThemeProvider>
);
