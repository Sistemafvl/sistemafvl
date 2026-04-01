import { useEffect, useRef, useState } from "react";
import VersionUpdateModal from "./VersionUpdateModal";

declare const __BUILD_VERSION__: string;

const VERSION_KEY = "app_build_version";
const RELOAD_FLAG = "app_version_reloaded";
const PREVIEW_CLEANUP_FLAG = "preview_sw_cleaned";
const GLOBAL_SYNC_KEY = "global_sync_stamp";
const GLOBAL_SYNC_STAMP = "2026-04-01-22-30"; // Bump this to force a one-time hard reset for all clients

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
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Build version check — works in all environments
  useEffect(() => {
    // 0. Global Hard Sync check — forces all clients to purge everything once
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
           console.error("Global Sync failed:", err);
         }
       };
       performHardSync();
       return;
    }

    const current = typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : null;
    if (!current) return;

    const saved = localStorage.getItem(VERSION_KEY);
    const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);

    if (saved && saved !== current && !alreadyReloaded) {
      localStorage.setItem(VERSION_KEY, current);
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
      return;
    }

    localStorage.setItem(VERSION_KEY, current);
    sessionStorage.removeItem(RELOAD_FLAG);

    // Periodic check for new versions via /version.json (reliable — never cached by browser)
    const checkNewVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) return;

        const data = await res.json();
        const remoteVersion: string | undefined = data?.version;

        if (remoteVersion && remoteVersion !== current) {
          console.log("[PWA] Nova versão detectada:", remoteVersion, "atual:", current);
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.warn("[PWA] Falha ao verificar versão:", err);
      }
    };

    // Check immediately on mount, then every 2 minutes
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
  }, []);

  const handleUpdate = () => {
    localStorage.removeItem(VERSION_KEY);
    window.location.reload();
  };

  // In preview/iframe: clean up any stale SWs + caches once per session
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
        if (didClean) {
          window.location.reload();
        }
      };
      cleanup().catch(console.error);
      return;
    }

    // Production: only register SW if /sw.js actually exists
    if ("serviceWorker" in navigator) {
      fetch("/sw.js", { method: "HEAD" }).then((res) => {
        if (res.ok) {
          navigator.serviceWorker.register("/sw.js", { type: "classic" }).catch(console.error);
        } else {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
          });
        }
      }).catch(() => {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      });
    }
  }, []);

  return <VersionUpdateModal isOpen={showUpdateModal} onUpdate={handleUpdate} />;
};

export default PWAAutoUpdate;
