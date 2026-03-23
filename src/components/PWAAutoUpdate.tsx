import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

declare const __BUILD_VERSION__: string;

const UPDATE_INTERVAL = 60 * 1000;
const VERSION_KEY = "app_build_version";
const RELOAD_FLAG = "app_version_reloaded";

const PWAAutoUpdate = () => {
  const hasReloaded = useRef(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Build version check
  useEffect(() => {
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
  }, []);

  // Register SW using vanilla API
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { type: "classic" });
        registrationRef.current = registration;

        // Check for updates immediately
        registration.update();

        // Periodic checks
        const interval = setInterval(() => {
          registration.update();
        }, UPDATE_INTERVAL);

        // Listen for new SW waiting
        registration.addEventListener("updatefound", () => {
          const newSW = registration.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              setNeedRefresh(true);
            }
          });
        });

        return () => clearInterval(interval);
      } catch (error) {
        console.error("SW registration error:", error);
      }
    };

    registerSW();
  }, []);

  // Auto-update when refresh needed
  useEffect(() => {
    if (needRefresh && !hasReloaded.current) {
      hasReloaded.current = true;
      toast.info("Atualizando sistema...");
      const waiting = registrationRef.current?.waiting;
      if (waiting) {
        waiting.postMessage({ type: "SKIP_WAITING" });
      }
      setTimeout(() => window.location.reload(), 1000);
    }
  }, [needRefresh]);

  return null;
};

export default PWAAutoUpdate;
