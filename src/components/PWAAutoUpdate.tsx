import { useEffect, useRef } from "react";

declare const __BUILD_VERSION__: string;

const IS_DEV = import.meta.env.DEV;

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

/** Wipe everything: SW, Cache API, localStorage version keys, IndexedDB */
async function hardReset() {
  try {
    // 1. Unregister all service workers
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    // 2. Clear Cache API
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    // 3. Clear version-related localStorage
    localStorage.removeItem("app_build_version");
    localStorage.removeItem("fvl-last-cache-clear");
    // 4. Delete IndexedDB
    try {
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      } else {
        indexedDB.deleteDatabase("fvl-offline");
      }
    } catch { /* indexedDB.databases not supported — try known DB */ 
      indexedDB.deleteDatabase("fvl-offline");
    }
  } catch (e) {
    console.error("[PWA] hardReset error:", e);
  }
}

const PWAAutoUpdate = () => {
  const isUpdating = useRef(false);
  const hasRunSW = useRef(false);

  // --- Version polling (production only) ---
  useEffect(() => {
    if (IS_DEV) return;

    const currentVersion =
      typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : null;
    if (!currentVersion) return;

    const doUpdate = async () => {
      if (isUpdating.current) return;
      isUpdating.current = true;
      console.log("[PWA] Nova versão detectada — atualizando…");
      await hardReset();
      // Force full page reload bypassing cache
      window.location.href = window.location.href.split("?")[0] + "?_v=" + Date.now();
    };

    const checkVersion = async () => {
      if (isUpdating.current) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const remote: string | undefined = data?.version;
        if (!remote) return;

        // Direct comparison: if remote differs from the JS bundle version → outdated
        if (remote !== currentVersion) {
          doUpdate();
        }
      } catch (err) {
        console.warn("[PWA] Falha ao verificar versão:", err);
      }
    };

    // Check immediately, then every 2 minutes
    checkVersion();
    const interval = setInterval(checkVersion, 2 * 60 * 1000);

    // Check when user returns to the tab
    const onVisible = () => {
      if (document.visibilityState === "visible") checkVersion();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- SW cleanup for preview/iframe; register in production ---
  useEffect(() => {
    if (hasRunSW.current) return;
    hasRunSW.current = true;

    if (isPreviewHost || isInIframe) {
      (async () => {
        let cleaned = false;
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) { await r.unregister(); cleaned = true; }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) { await caches.delete(k); cleaned = true; }
        }
        if (cleaned) window.location.reload();
      })().catch(console.error);
      return;
    }

    // Production: register SW only if sw.js exists
    if ("serviceWorker" in navigator) {
      fetch("/sw.js", { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            navigator.serviceWorker.register("/sw.js", { type: "classic" }).catch(console.error);
          } else {
            navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
          }
        })
        .catch(() => {
          navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
        });
    }
  }, []);

  return null; // No modal — auto-updates silently
};

export default PWAAutoUpdate;
