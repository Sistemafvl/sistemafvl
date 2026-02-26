import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const UPDATE_INTERVAL = 60 * 1000; // 60 seconds

const PWAAutoUpdate = () => {
  const hasReloaded = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
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
