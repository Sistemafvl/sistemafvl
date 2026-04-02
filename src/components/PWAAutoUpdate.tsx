import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import VersionUpdateModal from "./VersionUpdateModal";

declare const __BUILD_VERSION__: string;

const VERSION_KEY = "app_build_version";
const RELOAD_FLAG = "app_version_reloaded";
const PREVIEW_CLEANUP_FLAG = "preview_sw_cleaned";
const GLOBAL_SYNC_KEY = "global_sync_stamp";
const GLOBAL_SYNC_STAMP = "2026-04-02-force-v2"; // Bump to force a one-time hard reset for all clients

// Don't run version polling in local dev — version.json doesn't exist in dev mode
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

const PWAAutoUpdate = () => {
  const hasRun = useRef(false);
  const [updating, setUpdating] = useState(false);

  // --- useRef guards to avoid stale closure bugs ---
  // isUpdatingRef: prevents multiple simultaneous update triggers
  const isUpdatingRef = useRef(false);
  // knownVersionRef: stores the version seen on initial load (in-memory baseline)
  const knownVersionRef = useRef<string | null>(null);

  // Build version check
  useEffect(() => {
    // Never run version polling in development — no version.json exists in dev
    if (IS_DEV) return;

    // 0. Global Hard Sync — forces all clients to purge cache once after a GLOBAL_SYNC_STAMP bump
    const lastSync = localStorage.getItem(GLOBAL_SYNC_KEY);
    if (lastSync !== GLOBAL_SYNC_STAMP) {
      const performHardSync = async () => {
        try {
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.unregister();
          }
          if ("caches" in window) {
            const keys = await caches.keys();
            for (const k of keys) await caches.delete(k);
          }
          localStorage.setItem(GLOBAL_SYNC_KEY, GLOBAL_SYNC_STAMP);
          window.location.reload();
        } catch (err) {
          console.error("[PWA] Global Sync failed:", err);
        }
      };
      performHardSync();
      return;
    }

    const current = typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : null;
    if (!current) return;

    const saved = localStorage.getItem(VERSION_KEY);
    const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);

    // If version changed since last load, auto-reload once immediately
    if (saved && saved !== current && !alreadyReloaded) {
      localStorage.setItem(VERSION_KEY, current);
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
      return;
    }

    localStorage.setItem(VERSION_KEY, current);
    sessionStorage.removeItem(RELOAD_FLAG);

    // On first check, store the remote version as baseline in memory
    // Only trigger update if the remote version CHANGES compared to this baseline
    const triggerUpdate = () => {
      if (isUpdatingRef.current) return; // GUARD: never trigger twice
      isUpdatingRef.current = true;
      setUpdating(true);
      // Show modal — user must click "Atualizar Agora"
    };

    const checkNewVersion = async () => {
      if (isUpdatingRef.current) return; // GUARD: stop all checks once updating
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) return;

        const data = await res.json();
        const remoteVersion: string | undefined = data?.version;
        if (!remoteVersion) return;

        // On first successful check, store this as the baseline — don't trigger yet
        if (knownVersionRef.current === null) {
          knownVersionRef.current = remoteVersion;
          console.log("[PWA] Versão base registrada:", remoteVersion);
          return;
        }

        // Only trigger if the remote version has changed since the baseline
        if (remoteVersion !== knownVersionRef.current) {
          console.log("[PWA] Nova versão detectada:", remoteVersion, "base:", knownVersionRef.current);
          triggerUpdate();
        }
      } catch (err) {
        console.warn("[PWA] Falha ao verificar versão:", err);
      }
    };

    // Check immediately on mount to establish baseline, then every 2 minutes
    checkNewVersion();
    const interval = setInterval(checkNewVersion, 2 * 60 * 1000);

    // Also check when user comes back to the tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkNewVersion();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // In preview/iframe: clean up stale SWs + caches once per session
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (isPreviewHost || isInIframe) {
      const alreadyCleaned = sessionStorage.getItem(PREVIEW_CLEANUP_FLAG);
      if (alreadyCleaned) return;

      const cleanup = async () => {
        let didClean = false;
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) {
            await r.unregister();
            didClean = true;
          }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) {
            await caches.delete(k);
            didClean = true;
          }
        }
        sessionStorage.setItem(PREVIEW_CLEANUP_FLAG, "1");
        if (didClean) window.location.reload();
      };
      cleanup().catch(console.error);
      return;
    }

    // Production: only register SW if /sw.js actually exists
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

  const handleUpdate = () => {
    localStorage.removeItem(VERSION_KEY);
    window.location.reload();
  };

  return (
    <VersionUpdateModal isOpen={updating} onUpdate={handleUpdate} />
  );
};

export default PWAAutoUpdate;
