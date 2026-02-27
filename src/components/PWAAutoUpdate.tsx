import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

declare const __BUILD_VERSION__: string;

const UPDATE_INTERVAL = 60 * 1000;
const VERSION_KEY = "app_build_version";
const RELOAD_FLAG = "app_version_reloaded";

const PWAAutoUpdate = () => {
  const hasReloaded = useRef(false);

  // Build version check — forces reload once when a new bundle is loaded
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

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Immediate check on registration
        registration.update();

        // Periodic checks
        setInterval(() => {
          registration.update();
        }, UPDATE_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh && !hasReloaded.current) {
      hasReloaded.current = true;
      toast.info("Atualizando sistema...");
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default PWAAutoUpdate;
